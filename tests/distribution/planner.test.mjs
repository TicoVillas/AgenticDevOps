import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { planDistribution } from '../../tools/lib/distribution.mjs';
import { frameworkRoot } from '../../tools/lib/io.mjs';

const HASH = 'a'.repeat(64);

async function inputs() {
  const manifest = YAML.parse(await readFile(resolve(frameworkRoot, 'adapters/kiro/distribution-manifest.yaml'), 'utf8'));
  const sourceById = new Map(manifest.source_catalog.map((source) => [source.id, source]));
  const snapshot = {
    snapshot_sha256: 'b'.repeat(64),
    items: manifest.managed_items.map((item) => ({
      id: item.id,
      expected_sha256: sourceById.get(item.source_id).sha256 ?? HASH,
      destination_observation: { sha256: sourceById.get(item.source_id).sha256 ?? HASH },
      state: 'IDENTICAL',
    })),
    retirements: manifest.legacy_retirements.map((retirement) => ({
      path: retirement.path,
      state: 'ABSENT',
      observation: { presence: 'ABSENT', sha256: null },
    })),
  };
  return { manifest, snapshot };
}

const plan = (value, overrides = {}) => planDistribution({
  ...value,
  authorization: { current: true, snapshot_sha256: value.snapshot.snapshot_sha256 },
  manifest_sha256: HASH,
  lock_sha256: HASH,
  package_sha256: HASH,
  ...overrides,
});

test('second synthetic execution plans 64 NO_CHANGE and zero mutation', async () => {
  const value = await inputs();
  const before = structuredClone(value);
  const result = plan(value);
  const managedActions = result.actions.filter((action) => !action.item_id.startsWith('retire:'));
  assert.equal(result.decision, 'CHECKPOINT_REQUIRED');
  assert.equal(result.dry_run_decision, 'CHECKPOINT_REQUIRED');
  assert.equal(managedActions.length, 64);
  assert.ok(managedActions.every((action) => action.action === 'NO_CHANGE'));
  assert.equal(result.mutable_actions.length, 0);
  assert.equal(result.backup_set.length, 0);
  assert.equal(result.actions.at(-1).item_id, 'skill-bootstrap');
  assert.deepEqual(value, before, 'planner must not mutate inputs');
});

test('planner orders create/update, retirement and self-update deterministically', async () => {
  const value = await inputs();
  value.snapshot.items.find((item) => item.id === 'core-workflow-router').state = 'ABSENT';
  value.snapshot.items.find((item) => item.id === 'policy-context').state = 'MANAGED_OUTDATED';
  value.snapshot.retirements[0] = {
    path: value.manifest.legacy_retirements[0].path,
    state: 'LEGACY_ACTIVE_CONFLICT',
    observation: { sha256: value.manifest.legacy_retirements[0].baseline_sha256 },
  };
  const first = plan(value);
  const second = plan(value);
  assert.deepEqual(first, second);
  assert.equal(first.actions.at(-1).item_id, 'skill-bootstrap');
  assert.equal(first.actions.find((action) => action.item_id === 'core-workflow-router').action, 'CREATE');
  assert.equal(first.actions.find((action) => action.item_id === 'policy-context').action, 'BACKUP_UPDATE');
  assert.equal(first.actions.find((action) => action.item_id.startsWith('retire:')).action, 'BACKUP_RETIRE');
  assert.deepEqual(first.backup_set.sort(), [
    'policies/ContextPolicy.md',
    'steering/workflow-core.md',
  ].sort());
  assert.ok(first.rollback_preview.some((entry) => entry.strategy === 'REMOVE_IF_APPLIED_HASH_MATCHES'));
  assert.ok(first.rollback_preview.some((entry) => entry.strategy === 'RESTORE_VERIFIED_BACKUP'));
});

test('planner fails closed for uncontrolled state and unknown partial effect', async () => {
  const value = await inputs();
  value.snapshot.items[0].state = 'UNMANAGED_PRESENT';
  let result = plan(value);
  assert.equal(result.decision, 'BLOCKED');
  assert.equal(result.blocked_actions[0].action, 'BLOCKED');

  value.snapshot.items[0].state = 'UNKNOWN_PARTIAL';
  result = plan(value);
  assert.equal(result.decision, 'BLOCKED');
  assert.equal(result.dry_run_decision, 'BLOCKED');
  assert.ok(result.blocked_actions.some((action) => action.state === 'UNKNOWN_PARTIAL'));
});

test('planner binds authorization and evidence and blocks divergent snapshot', async () => {
  const value = await inputs();
  const result = plan(value, {
    authorization: { current: true, snapshot_sha256: 'c'.repeat(64) },
  });
  assert.equal(result.decision, 'CHECKPOINT_REQUIRED');
  assert.equal(result.dry_run_decision, 'BLOCKED');
  assert.deepEqual(result.bindings, {
    manifest_sha256: HASH,
    lock_sha256: HASH,
    package_sha256: HASH,
    snapshot_sha256: value.snapshot.snapshot_sha256,
    authorization_snapshot_sha256: 'c'.repeat(64),
  });
});

test('planner exposes explicit stop criteria and prohibited real operations', async () => {
  const value = await inputs();
  const result = plan(value);
  assert.ok(result.stop_criteria.includes('SNAPSHOT_DIVERGED'));
  assert.ok(result.stop_criteria.includes('SELF_UPDATE_COMPLETED'));
  assert.deepEqual(result.operations_not_authorized, [
    'GLOBAL_APPLY',
    'REAL_LEGACY_RETIREMENT',
    'REAL_SELF_UPDATE',
    'RESTART',
    'POST_RESTART_VALIDATION',
    'ROLLBACK',
    'GIT',
    'REMOTE',
  ]);
  assert.equal(Object.hasOwn(result, 'apply'), false);
  assert.equal(Object.hasOwn(result, 'filesystem'), false);
});
