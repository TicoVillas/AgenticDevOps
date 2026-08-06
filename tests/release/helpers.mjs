import { generateKeyPairSync, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalSha256 } from '../../tools/lib/canonical-json.mjs';
import { frameworkRoot } from '../../tools/lib/io.mjs';
import {
  buildAssetInventory,
  canonicalManifestBytes,
  inventoryBinding,
  publicKeyFingerprint,
  publicKeySpkiBase64,
  serializeChecksums,
  sha256Bytes,
  signDetached,
} from '../../tools/lib/release.mjs';

export const NOW = '2026-08-02T00:00:00Z';
export const KEY_ID = 'release-test-only-01';

export async function fixtureAssets() {
  const root = resolve(frameworkRoot, 'tests/fixtures/release-crypto');
  return [
    { name: 'sbom.spdx.json', bytes: await readFile(resolve(root, 'sbom.spdx.json')), media_type: 'application/spdx+json', class: 'SBOM' },
    { name: 'asset-alpha.txt', bytes: await readFile(resolve(root, 'asset-alpha.txt')), media_type: 'text/plain', class: 'RUNTIME' },
  ];
}

export function ephemeralKey(keyId = KEY_ID) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    keyId,
    publicKey,
    privateKey,
    fingerprint: publicKeyFingerprint(publicKey),
    publicKeySpkiBase64: publicKeySpkiBase64(publicKey),
    signer: async (bytes) => sign(null, bytes, privateKey),
  };
}

export async function releaseFixture({ key = ephemeralKey(), status = 'ACTIVE', validFrom = '2026-08-01T00:00:00Z', validUntil, revokedAt, revocationReason } = {}) {
  const assets = await fixtureAssets();
  const inventory = buildAssetInventory(assets);
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
  const record = { key_id: key.keyId, algorithm: 'Ed25519', fingerprint_sha256: key.fingerprint, public_key_spki_base64: key.publicKeySpkiBase64, valid_from: validFrom, status };
  if (validUntil !== undefined) record.valid_until = validUntil;
  if (revokedAt !== undefined) record.revoked_at = revokedAt;
  if (revocationReason !== undefined) record.revocation_reason = revocationReason;
  const trustStore = { schema_version: 1, trust_store_id: 'release-trust-test-only', version: 1, generated_at: NOW, key_events_sha256: canonicalSha256([]), keys: [record] };
  const manifestBytes = canonicalManifestBytes(manifest);
  const manifestEnvelope = await signDetached({ target: 'MANIFEST', targetName: 'release-manifest-v3.1.0.json', bytes: manifestBytes, keyId: key.keyId, fingerprintSha256: key.fingerprint, signer: key.signer });
  const checksumsEnvelope = await signDetached({ target: 'CHECKSUMS', targetName: 'SHA256SUMS', bytes: checksumsBytes, keyId: key.keyId, fingerprintSha256: key.fingerprint, signer: key.signer });
  return { assets, inventory, checksumsBytes, manifest, manifestBytes, manifestEnvelope, checksumsEnvelope, key, trustStore };
}
