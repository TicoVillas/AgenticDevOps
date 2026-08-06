import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';
import { applyMigration, loadMigrationDescriptor, migrateV1, migrationDescriptorNames } from '../../tools/lib/migrations.mjs';

const HASH = 'a'.repeat(64);
const fixtures = (name, suffix) => readYaml(resolve(frameworkRoot, `tests/fixtures/migrations/${name}.${suffix}.json`));
const selection_ref = { reference: 'selection.json', sha256: HASH };
const release_binding = { release_id: 'release-310', version: '3.1.0', tag: 'v3.1.0', commit_sha: 'a'.repeat(40), manifest_sha256: HASH };
const releaseMigrationContext = {
  asset_inventory_sha256: HASH,
  checksums: { name: 'SHA256SUMS', sha256: 'b'.repeat(64), algorithm: 'SHA-256', serialization: 'LOWERCASE_HEX_TWO_SPACES_NAME_LF' },
  signing: { algorithm: 'Ed25519', key_id: 'release-test-only-01', fingerprint_sha256: 'c'.repeat(64), manifest_signature: { name: 'release-manifest-v3.1.0.json.sig', encoding: 'base64' }, checksums_signature: { name: 'SHA256SUMS.sig', encoding: 'base64' } },
  sbom: { schema_version: 1, name: 'sbom.spdx.json', format: 'SPDX_JSON', media_type: 'application/spdx+json', sha256: 'd'.repeat(64) },
};
const contexts = {
  artifact: { selection_ref },
  transition: { selection_ref },
  distribution: { release_binding },
  backup: { origin_operation: { operation_id: 'operation-001', operation_class: 'UPDATE' } },
  journal: { plan_sha256: HASH },
  receipt: { release_binding, plan_sha256: HASH, journal_sha256: 'b'.repeat(64), platform: { platform_id: 'linux-x86-64', validation_status: 'SYNTHETICALLY_VALIDATED' } },
  'release-manifest': releaseMigrationContext,
};

test('seven v1 migrations produce deterministic expected fixtures without mutating input', async () => {
  assert.deepEqual(migrationDescriptorNames, ['artifact', 'transition', 'distribution', 'backup', 'journal', 'receipt', 'release-manifest']);
  for (const name of migrationDescriptorNames) {
    const legacy = await fixtures(name, 'legacy');
    const original = structuredClone(legacy);
    const descriptor = await loadMigrationDescriptor(name);
    const first = applyMigration(legacy, descriptor, contexts[name]);
    const second = applyMigration(legacy, descriptor, contexts[name]);
    assert.deepEqual(first, await fixtures(name, 'expected'), name);
    assert.deepEqual(second, first, name);
    assert.deepEqual(legacy, original, `${name} mutated input`);
  }
});

test('transition migration fails closed without explicit selection context and preserves existing authority', async () => {
  const legacy = await fixtures('transition', 'legacy');
  legacy.authority = { explicit: true };
  const descriptor = await loadMigrationDescriptor('transition');
  assert.throws(() => applyMigration(legacy, descriptor), /MIGRATION_CONTEXT_REQUIRED:selection_ref/);
  assert.throws(() => applyMigration(legacy, descriptor, { selection_ref: undefined }), /MIGRATION_CONTEXT_INVALID:selection_ref/);
  const migrated = applyMigration(legacy, descriptor, { selection_ref });
  assert.deepEqual(migrated.authority, { explicit: true });
  assert.deepEqual(migrated.selection_ref, selection_ref);
});

test('migrateV1 validates the final target and rejects context conflicts', async () => {
  const artifact = await fixtures('artifact', 'legacy');
  assert.deepEqual(await migrateV1('artifact', artifact, { selection_ref }), await fixtures('artifact', 'expected'));
  await assert.rejects(migrateV1('transition', await fixtures('transition', 'legacy'), { selection_ref }), /MIGRATION_TARGET_INVALID/);
  const descriptor = await loadMigrationDescriptor('transition');
  const conflicting = { ...(await fixtures('transition', 'legacy')), selection_ref: { reference: 'other', sha256: 'b'.repeat(64) } };
  assert.throws(() => applyMigration(conflicting, descriptor, { selection_ref }), /MIGRATION_CONTEXT_CONFLICT:selection_ref/);
});
