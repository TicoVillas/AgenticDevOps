import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseLifecycleArgs } from '../../tools/lib/lifecycle/cli.mjs';
import { executeLifecycleCommand } from '../../tools/lib/lifecycle/engine.mjs';
import { createLifecycleHarness, treeDigest } from './harness.mjs';

test('canonical engine plans, applies with durable evidence, and repeats as zero-mutation NO_CHANGE', async () => {
  const value = await createLifecycleHarness();
  try {
    const planned = await value.plan();
    assert.equal(planned.ok, true);
    assert.equal(planned.status, 'READY');
    assert.equal(planned.result.plan.mutable_actions.length, 1);
    const applied = await value.apply(planned);
    assert.equal(applied.ok, true);
    assert.equal(applied.status, 'COMPLETED');
    assert.equal(applied.result.applied.status, 'VERIFIED');
    assert.equal(applied.result.lock_retained, false);
    assert.equal(await readFile(resolve(value.roots.destination, 'managed/file.txt'), 'utf8'), value.payload.toString('utf8'));
    assert.equal(applied.result.event_log.sanitized, true);
    const artifacts = await readdir(resolve(value.roots.state, 'operations', value.operationId, 'artifacts'));
    for (const expected of ['event-log.json', 'plan.json', 'receipt.json']) assert.equal(artifacts.includes(expected), true);

    const repeatedPlan = await value.plan();
    assert.equal(repeatedPlan.result.plan.mutable_actions.length, 0);
    const stateBefore = await treeDigest(value.roots.state);
    const repeated = await value.apply(repeatedPlan);
    assert.equal(repeated.status, 'NO_CHANGE');
    assert.equal(repeated.result.mutations, 0);
    assert.equal(repeated.result.state_written, false);
    assert.equal(await treeDigest(value.roots.state), stateBefore);
  } finally { await value.cleanup(); }
});

test('artifact authorization cannot prevail over destination divergence', async () => {
  const value = await createLifecycleHarness();
  try {
    const planned = await value.plan();
    const authorization = await value.authorize(planned);
    await mkdir(resolve(value.roots.destination, 'managed'), { recursive: true });
    await writeFile(resolve(value.roots.destination, 'managed/file.txt'), 'state changed after plan');
    await assert.rejects(executeLifecycleCommand(parseLifecycleArgs(['install', ...value.baseArgs, '--apply', '--authorization', authorization.path]), value.runtime), (error) => /DIVERGED/.test(error.code));
    assert.equal(await readFile(resolve(value.roots.destination, 'managed/file.txt'), 'utf8'), 'state changed after plan');
  } finally { await value.cleanup(); }
});

test('fault injection matrix produces no blind retry and retains writer only for uncertain effects', async () => {
  const expectations = new Map([
    ['before-intent', ['BLOCKED', 'NO_EFFECT', false]],
    ['after-intent', ['PARTIAL_KNOWN', 'PARTIAL_KNOWN', true]],
    ['before-write', ['PARTIAL_KNOWN', 'PARTIAL_KNOWN', true]],
    ['after-stage-write', ['PARTIAL_KNOWN', 'PARTIAL_KNOWN', true]],
    ['before-sync', ['PARTIAL_KNOWN', 'PARTIAL_KNOWN', true]],
    ['after-sync', ['PARTIAL_KNOWN', 'PARTIAL_KNOWN', true]],
    ['before-rename', ['PARTIAL_KNOWN', 'PARTIAL_KNOWN', true]],
    ['after-rename', ['PARTIAL', 'PARTIAL', true]],
    ['after-write', ['PARTIAL', 'PARTIAL', true]],
    ['before-receipt', ['PARTIAL', null, true]],
    ['after-receipt', ['PARTIAL', null, true]],
  ]);
  for (const [point, [topStatus, appliedStatus, lockRetained]] of expectations) {
    let injections = 0;
    const value = await createLifecycleHarness({ faultInjector: async (event) => { if (event.point === point) { injections += 1; throw new Error(`INJECTED_${point}`); } } });
    try {
      const planned = await value.plan();
      const result = await value.apply(planned);
      assert.equal(result.status, topStatus, point);
      if (appliedStatus) assert.equal(result.result.applied.status, appliedStatus, point);
      assert.equal(result.result.lock_retained, lockRetained, point);
      assert.equal(injections, 1, `${point} must not retry`);
    } finally { await value.cleanup(); }
  }
});

test('uncertain operation reconcile is read-only and reports observed effect', async () => {
  const value = await createLifecycleHarness({ faultInjector: async (event) => { if (event.point === 'after-rename') throw new Error('INJECTED_AFTER_RENAME'); } });
  try {
    const result = await value.apply(await value.plan());
    assert.equal(result.status, 'PARTIAL');
    const beforeDestination = await treeDigest(value.roots.destination);
    const beforeState = await treeDigest(value.roots.state);
    const reconciled = await executeLifecycleCommand(parseLifecycleArgs(['reconcile', ...value.baseArgs]), value.runtime);
    assert.equal(reconciled.ok, true);
    assert.equal(reconciled.result.read_only, true);
    assert.equal(reconciled.result.observations[0].classification, 'APPLIED_VERIFIED');
    assert.equal(await treeDigest(value.roots.destination), beforeDestination);
    assert.equal(await treeDigest(value.roots.state), beforeState);
  } finally { await value.cleanup(); }
});

test('update delegates to the same planner/applier and creates a verified backup before replacement', async () => {
  const value = await createLifecycleHarness({ destinationPayload: 'known managed predecessor\n' });
  try {
    const planned = await value.plan('update');
    assert.equal(planned.result.plan.mutable_actions[0].action, 'BACKUP_UPDATE');
    const applied = await value.apply(planned, 'update');
    assert.equal(applied.status, 'COMPLETED');
    assert.equal(await readFile(resolve(value.roots.destination, 'managed/file.txt'), 'utf8'), value.payload.toString('utf8'));
    const backupManifest = await readFile(resolve(value.roots.state, 'operations', value.operationId, 'backup-manifest.yaml'), 'utf8');
    assert.match(backupManifest, /verified: true/);
  } finally { await value.cleanup(); }
});