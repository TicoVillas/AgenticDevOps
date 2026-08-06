import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { buildAssetInventory, canonicalManifestBytes, inventoryBinding, serializeChecksums, sha256Bytes, signDetached } from '../../tools/lib/release.mjs';
import { canonicalSha256 } from '../../tools/lib/canonical-json.mjs';
import { createInstallerStaging } from '../../tools/lib/installer/staging.mjs';
import { encodeOfflineBundle } from '../../tools/lib/installer/downloader.mjs';
import { ephemeralKey, NOW } from '../release/helpers.mjs';

export { NOW };

export function fileMember(path, data = `synthetic:${path}\n`) {
  const bytes = Buffer.from(data);
  return { path, type: 'FILE', size: bytes.length, sha256: sha256Bytes(bytes), data_base64: bytes.toString('base64') };
}

export async function installerFixture({ members = [fileMember('core/runtime.txt'), fileMember('skills/example/SKILL.md')] } = {}) {
  const key = ephemeralKey();
  const archiveBytes = Buffer.from(`${JSON.stringify({ schema_version: 1, members })}\n`);
  const sbomBytes = Buffer.from('{"spdxVersion":"SPDX-2.3","name":"synthetic-m7"}\n');
  const payloadAssets = [
    { name: 'framework-v3.1.0.synthetic.json', bytes: archiveBytes, media_type: 'application/json', class: 'RUNTIME' },
    { name: 'sbom.spdx.json', bytes: sbomBytes, media_type: 'application/spdx+json', class: 'SBOM' },
  ];
  const inventory = buildAssetInventory(payloadAssets);
  const checksumsBytes = serializeChecksums(inventory);
  const sbom = inventory.find((asset) => asset.name === 'sbom.spdx.json');
  const manifest = {
    schema_version: 1,
    release_id: 'release-310',
    version: '3.1.0',
    tag: 'v3.1.0',
    commit_sha: 'a'.repeat(40),
    repository: 'TicoVillas/AgenticDevOps',
    assets: inventory,
    asset_inventory_sha256: inventoryBinding(inventory),
    checksums: { name: 'SHA256SUMS', sha256: sha256Bytes(checksumsBytes), algorithm: 'SHA-256', serialization: 'LOWERCASE_HEX_TWO_SPACES_NAME_LF' },
    signing: { algorithm: 'Ed25519', key_id: key.keyId, fingerprint_sha256: key.fingerprint, manifest_signature: { name: 'release-manifest-v3.1.0.json.sig', encoding: 'base64' }, checksums_signature: { name: 'SHA256SUMS.sig', encoding: 'base64' } },
    sbom: { schema_version: 1, name: sbom.name, format: 'SPDX_JSON', media_type: sbom.media_type, sha256: sbom.sha256 },
    lock_sha256: 'b'.repeat(64),
    runtime: { node_major: 24, package_manager: 'npm' },
    platform_support: ['linux-x86-64'],
    build_identity: 'build:release-310',
    validation_status: 'DRAFT',
  };
  const manifestBytes = canonicalManifestBytes(manifest);
  const trustStore = { schema_version: 1, trust_store_id: 'release-trust-test-only', version: 1, generated_at: NOW, key_events_sha256: canonicalSha256([]), keys: [{ key_id: key.keyId, algorithm: 'Ed25519', fingerprint_sha256: key.fingerprint, public_key_spki_base64: key.publicKeySpkiBase64, valid_from: '2026-08-01T00:00:00Z', status: 'ACTIVE' }] };
  const manifestEnvelope = await signDetached({ target: 'MANIFEST', targetName: 'release-manifest-v3.1.0.json', bytes: manifestBytes, keyId: key.keyId, fingerprintSha256: key.fingerprint, signer: key.signer });
  const checksumsEnvelope = await signDetached({ target: 'CHECKSUMS', targetName: 'SHA256SUMS', bytes: checksumsBytes, keyId: key.keyId, fingerprintSha256: key.fingerprint, signer: key.signer });
  const named = [
    ['release-manifest-v3.1.0.json', manifestBytes],
    ['release-manifest-v3.1.0.json.sig', Buffer.from(`${JSON.stringify(manifestEnvelope)}\n`)],
    ['SHA256SUMS', checksumsBytes],
    ['SHA256SUMS.sig', Buffer.from(`${JSON.stringify(checksumsEnvelope)}\n`)],
    ['release-trust-store.json', Buffer.from(`${JSON.stringify(trustStore)}\n`)],
    ...payloadAssets.map((asset) => [asset.name, asset.bytes]),
  ];
  const identity = Object.fromEntries(['release_id', 'version', 'tag', 'commit_sha', 'repository'].map((field) => [field, manifest[field]]));
  const roles = { manifest: named[0][0], manifest_signature: named[1][0], checksums: named[2][0], checksums_signature: named[3][0], trust_store: named[4][0], payload_archive: payloadAssets[0].name };
  const artifacts = named.map(([name, bytes]) => ({ name, bytes: Buffer.from(bytes) }));
  const request = {
    identity,
    reference: 'releases/download/v3.1.0/assets',
    asset_identities: artifacts.map(({ name, bytes }) => ({ name, sha256: sha256Bytes(bytes), size: bytes.length })),
    artifact_roles: roles,
  };
  return { identity, request, download: { identity, artifacts, artifact_roles: roles }, manifest, manifestBytes };
}

export function injectedTransport(fixture, { error = null } = {}) {
  const byName = new Map(fixture.download.artifacts.map((asset) => [asset.name, asset.bytes]));
  const calls = [];
  return {
    calls,
    async readExactRelease(input) { calls.push(['release', input]); if (error) throw error; return fixture.identity; },
    async readExactAsset(input) { calls.push(['asset', input.asset_identity.name]); if (error) throw error; return byName.get(input.asset_identity.name); },
  };
}

export async function stagingHarness() {
  const sandbox = await mkdtemp(resolve(tmpdir(), 'agentic-m7-installer-'));
  const destination = resolve(sandbox, 'destination');
  await mkdir(destination, { mode: 0o700 });
  const staging = resolve(sandbox, 'staging');
  await createInstallerStaging({ stagingRoot: staging, forbiddenRoots: [destination] });
  return { sandbox, destination, staging, cleanup: () => rm(sandbox, { recursive: true, force: true }) };
}

export async function writeOfflineFixture(staging, fixture) {
  const path = resolve(staging, 'release.bundle.json');
  await writeFile(path, encodeOfflineBundle(fixture.download), { flag: 'wx', mode: 0o600 });
  return path;
}
