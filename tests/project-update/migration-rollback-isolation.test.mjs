import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { canonicalSha256 } from '../../tools/lib/canonical-json.mjs';
import { rollbackProjectUpdate } from '../../tools/lib/project-update/engine.mjs';
import { backProjectProfileV2ToV1, forwardProjectProfileV1ToV2, loadProjectMigrationCatalog } from '../../tools/lib/project-update/migrations.mjs';
import { reconcileProjectUpdateReadOnly } from '../../tools/lib/project-update/reconcile.mjs';
import { treeDigest } from '../lifecycle/harness.mjs';
import { createProjectHarness, rollbackAuthorization } from './harness.mjs';

test('versioned field-aware migration runs forward/back deterministically and matches fixtures', async () => {
  const value = await createProjectHarness();
  try {
    const contractsRoot = resolve(import.meta.dirname, '../../contracts');
    const loaded = await loadProjectMigrationCatalog({ fs: value.fs, contractsRoot });
    assert.equal(loaded.descriptors[0].id, 'project-profile-v1-to-v2');
    const fixtureRoot = resolve(contractsRoot, 'migrations/project-update/fixtures');
    const input = YAML.parse(await readFile(resolve(fixtureRoot, 'forward-input.yaml'), 'utf8'));
    const expected = YAML.parse(await readFile(resolve(fixtureRoot, 'forward-expected.yaml'), 'utf8'));
    const expectedContext = YAML.parse(await readFile(resolve(fixtureRoot, 'rollback-context.yaml'), 'utf8'));
    const first = forwardProjectProfileV1ToV2(input);
    const second = forwardProjectProfileV1ToV2(input);
    assert.deepEqual(first, second);
    assert.deepEqual(first.document, expected);
    assert.deepEqual(first.rollback_context, expectedContext);
    assert.deepEqual(backProjectProfileV2ToV1(first.document, first.rollback_context), input);
    assert.deepEqual(first.document.user_extension, input.user_extension);
  } finally { await value.cleanup(); }
});

test('rollback requires fresh rollback-only authorization and verified backup', async () => {
  const value = await createProjectHarness();
  try {
    const planned = await value.plan();
    const applied = await value.apply(planned);
    const snapshot = await value.snapshot();
    const rollback = rollbackAuthorization({ harness: value, plan: planned.plan, snapshot, backupManifest: applied.result.backup_manifest });
    const result = await rollbackProjectUpdate({ runtime: value.runtime, plan: planned.plan, backupManifest: applied.result.backup_manifest, ...rollback });
    assert.equal(result.status, 'ROLLED_BACK');
    const restored = YAML.parse(await readFile(resolve(value.roots.project, '.agentic/application-profile.yaml'), 'utf8'));
    assert.equal(restored.impact, 'LOW');
    assert.deepEqual(restored.user_extension, { owner: 'synthetic-user', preserve: true });
    assert.match(result.receipt.receipt_id, /^project-receipt-rollback-/);
  } finally { await value.cleanup(); }

  const tampered = await createProjectHarness();
  try {
    const planned = await tampered.plan();
    const applied = await tampered.apply(planned);
    const backup = applied.result.backup_manifest.entries[0];
    await writeFile(resolve(tampered.roots.state, 'operations', planned.plan.operation_id, backup.backup_path), 'tampered backup');
    const snapshot = await tampered.snapshot();
    const rollback = rollbackAuthorization({ harness: tampered, plan: planned.plan, snapshot, backupManifest: applied.result.backup_manifest });
    await assert.rejects(rollbackProjectUpdate({ runtime: tampered.runtime, plan: planned.plan, backupManifest: applied.result.backup_manifest, ...rollback }), /PROJECT_BACKUP_UNVERIFIED/);
  } finally { await tampered.cleanup(); }
});

test('global receipt fixture remains byte-identical and is never used as a project receipt', async () => {
  const value = await createProjectHarness();
  try {
    const before = await readFile(value.globalReceiptPath);
    const planned = await value.plan();
    const applied = await value.apply(planned);
    const snapshot = await value.snapshot();
    const rollback = rollbackAuthorization({ harness: value, plan: planned.plan, snapshot, backupManifest: applied.result.backup_manifest });
    await rollbackProjectUpdate({ runtime: value.runtime, plan: planned.plan, backupManifest: applied.result.backup_manifest, ...rollback });
    const after = await readFile(value.globalReceiptPath);
    assert.deepEqual(after, before);
    assert.deepEqual(after, value.globalFixtureBytes);
    assert.notEqual(applied.result.receipt.receipt_id, JSON.parse(before).receipt_id);
    assert.equal(applied.result.receipt.receipt_id.startsWith('project-receipt-'), true);
  } finally { await value.cleanup(); }
});

test('reconcile of uncertain project state is byte-for-byte read-only and does not authorize retry', async () => {
  const value = await createProjectHarness({ faultInjector: async ({ point }) => { if (point === 'after-rename') throw new Error('INJECTED_PARTIAL'); } });
  try {
    const planned = await value.plan();
    const { result } = await value.apply(planned);
    assert.equal(result.status, 'PARTIAL');
    const beforeProject = await treeDigest(value.roots.project);
    const beforeState = await treeDigest(value.roots.state);
    const beforeGlobal = await treeDigest(value.roots.global);
    const reconciled = await reconcileProjectUpdateReadOnly({ fs: value.fs, projectRoot: value.roots.project, plan: planned.plan, journal: result.journal, clock: value.runtime.clock });
    assert.equal(reconciled.read_only, true);
    assert.equal(reconciled.resume_authorized, false);
    assert.equal(reconciled.operations_not_authorized.includes('GIT_COMMIT'), true);
    assert.equal(reconciled.operations_not_authorized.includes('RETRY'), true);
    assert.equal(await treeDigest(value.roots.project), beforeProject);
    assert.equal(await treeDigest(value.roots.state), beforeState);
    assert.equal(await treeDigest(value.roots.global), beforeGlobal);
  } finally { await value.cleanup(); }
});
