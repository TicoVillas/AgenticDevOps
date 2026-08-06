import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';
import { validateBySchemaId, validateSchemaRegistry } from '../../tools/lib/schema.mjs';
import {
  assertExactReleaseIdentity,
  assertImmutableReleaseReference,
  buildAssetInventory,
  canonicalManifestBytes,
  inventoryBinding,
  parseChecksums,
  serializeChecksums,
  validateReleaseManifestBindings,
  verifyAssetInventory,
} from '../../tools/lib/release.mjs';
import { fixtureAssets, releaseFixture } from './helpers.mjs';

const templateNames = ['release-manifest', 'release-metadata', 'release-asset-inventory', 'release-signature', 'release-sbom-reference', 'release-trust-store', 'release-key-event', 'release-compensating-control', 'release-immutability-decision', 'release-key-incident'];

test('M4 schema registry compiles and all release templates validate', async () => {
  const registry = await validateSchemaRegistry();
  assert.equal(registry.ok, true, registry.errors.join('\n'));
  for (const name of templateNames) {
    const document = await readYaml(resolve(frameworkRoot, 'contracts/templates', `${name}.yaml`));
    const result = await validateBySchemaId(document, `urn:agentic-devops:${name}:3.0`);
    assert.equal(result.ok, true, `${name}: ${result.errors.join('; ')}`);
  }
});

test('schemas reject extra fields, mandatory attestation, incomplete signatures, and implicit immutability approval', async () => {
  const metadata = await readYaml(resolve(frameworkRoot, 'contracts/templates/release-metadata.yaml'));
  metadata.attestation.blocking = true;
  assert.equal((await validateBySchemaId(metadata, 'urn:agentic-devops:release-metadata:3.0')).ok, false);
  const signature = await readYaml(resolve(frameworkRoot, 'contracts/templates/release-signature.yaml'));
  delete signature.fingerprint_sha256;
  assert.equal((await validateBySchemaId(signature, 'urn:agentic-devops:release-signature:3.0')).ok, false);
  const control = await readYaml(resolve(frameworkRoot, 'contracts/templates/release-compensating-control.yaml'));
  control.approval_status = 'DRAFT';
  assert.equal((await validateBySchemaId(control, 'urn:agentic-devops:release-compensating-control:3.0')).ok, false);
  const trust = await readYaml(resolve(frameworkRoot, 'contracts/templates/release-trust-store.yaml'));
  trust.unexpected = true;
  assert.equal((await validateBySchemaId(trust, 'urn:agentic-devops:release-trust-store:3.0')).ok, false);
});

test('asset inventory and SHA256SUMS are deterministic, canonical, and round-trip', async () => {
  const assets = await fixtureAssets();
  const first = buildAssetInventory(assets);
  const second = buildAssetInventory([...assets].reverse());
  assert.deepEqual(first, second);
  assert.deepEqual(first.map((asset) => asset.name), ['asset-alpha.txt', 'sbom.spdx.json']);
  assert.equal(inventoryBinding(first), inventoryBinding(second));
  const checksums = serializeChecksums(first);
  assert.equal(checksums.at(-1), 0x0a);
  assert.deepEqual(parseChecksums(checksums), first.map(({ name, sha256 }) => ({ name, sha256 })));
  assert.throws(() => parseChecksums(Buffer.from(checksums.toString('utf8').replaceAll('\n', '\r\n'))), /CHECKSUMS_NON_CANONICAL_LINE_ENDING/);
  assert.throws(() => parseChecksums(Buffer.from([...checksums.toString('utf8').trimEnd().split('\n')].reverse().join('\n') + '\n')), /CHECKSUMS_NOT_SORTED/);
  assert.throws(() => parseChecksums(Buffer.from('malformed\n')), /MALFORMED_CHECKSUM_LINE/);
});

test('asset verification detects tamper, missing, unexpected, duplicate, and unsafe assets', async () => {
  const assets = await fixtureAssets();
  const inventory = buildAssetInventory(assets);
  assert.equal(verifyAssetInventory(assets, inventory).ok, true);
  const tampered = structuredClone(assets); tampered[0].bytes = Buffer.from('tampered');
  assert.throws(() => verifyAssetInventory(tampered, inventory), /ASSET_(?:SIZE|HASH)_MISMATCH/);
  assert.throws(() => verifyAssetInventory(assets.slice(1), inventory), /MISSING_ASSET/);
  assert.throws(() => verifyAssetInventory([...assets, { name: 'extra.txt', bytes: Buffer.from('extra') }], inventory), /UNEXPECTED_ASSET/);
  assert.throws(() => buildAssetInventory([...assets, structuredClone(assets[0])]), /DUPLICATE_ASSET/);
  for (const name of ['../escape', '/absolute', 'a\\b', 'a//b', 'a\0b']) assert.throws(() => buildAssetInventory([{ name, bytes: Buffer.from('x') }]), /UNSAFE_ASSET_NAME/);
});

test('manifest bindings enforce exact SemVer tag, inventory, SBOM, separated signatures and LF bytes', async () => {
  const { manifest } = await releaseFixture();
  assert.equal(validateReleaseManifestBindings(manifest).ok, true);
  assert.equal(canonicalManifestBytes(manifest).at(-1), 0x0a);
  const wrongTag = structuredClone(manifest); wrongTag.tag = 'v3.1.1';
  assert.throws(() => validateReleaseManifestBindings(wrongTag), /SEMVER_TAG_MISMATCH/);
  const wrongInventory = structuredClone(manifest); wrongInventory.asset_inventory_sha256 = '0'.repeat(64);
  assert.throws(() => validateReleaseManifestBindings(wrongInventory), /ASSET_INVENTORY_BINDING_MISMATCH/);
  const wrongSbom = structuredClone(manifest); wrongSbom.sbom.sha256 = '0'.repeat(64);
  assert.throws(() => validateReleaseManifestBindings(wrongSbom), /SBOM_BINDING_MISMATCH/);
  const sameSignature = structuredClone(manifest); sameSignature.signing.checksums_signature.name = sameSignature.signing.manifest_signature.name;
  assert.throws(() => validateReleaseManifestBindings(sameSignature), /SIGNATURE_ASSETS_NOT_SEPARATE/);
});

test('exact identity rejects any divergence and mutable release references', async () => {
  const { manifest } = await releaseFixture();
  const expected = Object.fromEntries(['release_id', 'version', 'tag', 'commit_sha', 'repository'].map((field) => [field, manifest[field]]));
  assert.equal(assertExactReleaseIdentity(manifest, expected), true);
  for (const field of Object.keys(expected)) {
    const changed = { ...manifest, [field]: field === 'commit_sha' ? 'b'.repeat(40) : `${manifest[field]}-changed` };
    assert.throws(() => assertExactReleaseIdentity(changed, expected), /RELEASE_IDENTITY_MISMATCH/);
  }
  assert.equal(assertImmutableReleaseReference('releases/download/v3.1.0/manifest.json'), 'releases/download/v3.1.0/manifest.json');
  for (const reference of ['refs/heads/main', 'raw.githubusercontent.com/org/repo/main/file', 'main', 'download?ref=main']) assert.throws(() => assertImmutableReleaseReference(reference), /MUTABLE_RELEASE_REFERENCE/);
});
