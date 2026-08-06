import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createNodeFilesystemAdapter } from '../../adapters/lifecycle/node-filesystem.mjs';
import { canonicalSha256 } from '../../tools/lib/canonical-json.mjs';
import { buildLifecycleEvidenceIndex, buildLifecycleEventLogFromJournal } from '../../tools/lib/lifecycle/event-evidence.mjs';
import { assertRetentionPlanIsReadOnly, planLifecycleRetention } from '../../tools/lib/lifecycle/retention-planner.mjs';
import { createDurableJournalStore, initializeOperationState } from '../../tools/lib/lifecycle/state-store.mjs';
import { applyUninstall, planUninstall } from '../../tools/lib/lifecycle/uninstall.mjs';
import { loadRetentionPolicy } from '../../tools/lib/retention.mjs';
import { validateBySchemaId } from '../../tools/lib/schema.mjs';
import { clock, sha256 } from './harness.mjs';

async function fixture() {
  const sandbox = await mkdtemp(resolve(tmpdir(), 'agentic-m5-uninstall-'));
  const destinationRoot = resolve(sandbox, 'destination');
  const stateRoot = resolve(sandbox, 'state');
  await Promise.all([mkdir(resolve(destinationRoot, 'managed'), { recursive: true }), mkdir(stateRoot)]);
  const managed = Buffer.from('managed exact\n');
  const modifiedOriginal = Buffer.from('managed old\n');
  await writeFile(resolve(destinationRoot, 'managed/remove.txt'), managed);
  await writeFile(resolve(destinationRoot, 'managed/preserve.txt'), 'user modified\n');
  await writeFile(resolve(destinationRoot, 'unmanaged.txt'), 'never remove\n');
  const receipt = {
    actions: [
      { sequence: 1, item_id: 'remove', path: 'managed/remove.txt', action: 'CREATE', state: 'VERIFIED', before_sha256: null, after_sha256: sha256(managed), verified: true },
      { sequence: 2, item_id: 'preserve', path: 'managed/preserve.txt', action: 'CREATE', state: 'VERIFIED', before_sha256: null, after_sha256: sha256(modifiedOriginal), verified: true },
    ],
  };
  return { sandbox, destinationRoot, stateRoot, fs: createNodeFilesystemAdapter(), receipt, managed, cleanup: () => rm(sandbox, { recursive: true, force: true }) };
}

test('uninstall removes only exact managed bytes, preserves user-modified and unmanaged files, and writes tombstone', async () => {
  const value = await fixture();
  try {
    const operationId = 'uninstall-synthetic-0001';
    const receiptSha256 = canonicalSha256(value.receipt);
    const plan = await planUninstall({ fs: value.fs, destinationRoot: value.destinationRoot, receipt: value.receipt, receiptSha256, operationId, clock });
    assert.equal(plan.decision, 'CHECKPOINT_REQUIRED');
    assert.deepEqual(plan.preserved_paths, ['managed/preserve.txt']);
    const { operationRoot } = await initializeOperationState({ fs: value.fs, stateRoot: value.stateRoot, operationId });
    const result = await applyUninstall({ fs: value.fs, destinationRoot: value.destinationRoot, operationRoot, plan, authorizationValidated: true, journalStore: createDurableJournalStore({ fs: value.fs, operationRoot }), clock });
    assert.equal(result.status, 'COMPLETED');
    assert.deepEqual(result.removed_paths, ['managed/remove.txt']);
    assert.equal(result.tombstone.reconciliation_status, 'RECONCILED');
    await assert.rejects(readFile(resolve(value.destinationRoot, 'managed/remove.txt')), { code: 'ENOENT' });
    assert.equal(await readFile(resolve(value.destinationRoot, 'managed/preserve.txt'), 'utf8'), 'user modified\n');
    assert.equal(await readFile(resolve(value.destinationRoot, 'unmanaged.txt'), 'utf8'), 'never remove\n');
  } finally { await value.cleanup(); }
});

test('uninstall fault after removal is PARTIAL and never emits a false tombstone', async () => {
  const value = await fixture();
  try {
    const operationId = 'uninstall-synthetic-0002';
    const receiptSha256 = canonicalSha256(value.receipt);
    const plan = await planUninstall({ fs: value.fs, destinationRoot: value.destinationRoot, receipt: value.receipt, receiptSha256, operationId, clock });
    const { operationRoot } = await initializeOperationState({ fs: value.fs, stateRoot: value.stateRoot, operationId });
    const result = await applyUninstall({ fs: value.fs, destinationRoot: value.destinationRoot, operationRoot, plan, authorizationValidated: true, journalStore: createDurableJournalStore({ fs: value.fs, operationRoot }), clock, faultInjector: async ({ point }) => { if (point === 'after-write') throw new Error('INJECTED_AFTER_WRITE'); } });
    assert.equal(result.status, 'PARTIAL');
    assert.equal(result.tombstone, null);
    assert.equal(result.journal.reconciliation.status, 'UNRECONCILED');
  } finally { await value.cleanup(); }
});

test('retention planner consumes a synthetic copy of the sole policy and authorizes no deletion', async () => {
  const value = await fixture();
  try {
    const policyRoot = resolve(value.sandbox, 'policy-source');
    await mkdir(resolve(policyRoot, 'policies'), { recursive: true });
    const policyText = await readFile(new URL('../../policies/OperationalRetentionPolicy.md', import.meta.url), 'utf8');
    await writeFile(resolve(policyRoot, 'policies/OperationalRetentionPolicy.md'), policyText);
    const policy = await loadRetentionPolicy(policyRoot);
    const old = new Date(clock().getTime() - (policy.backups.successful_versions.minimum_days + 1) * 86_400_000).toISOString();
    const records = [
      { id: 'journal-1', kind: 'journals' },
      { id: 'uncertain-1', kind: 'backup', outcome: policy.legal_holds.outcomes[0], retention_class: 'SUCCESSFUL_VERSION', success_rank: policy.backups.successful_versions.minimum_count + 1, created_at: old },
      { id: 'eligible-1', kind: 'backup', retention_class: 'SUCCESSFUL_VERSION', success_rank: policy.backups.successful_versions.minimum_count + 1, created_at: old },
    ];
    const plan = await planLifecycleRetention({ policyRoot, records, now: clock() });
    assert.equal(assertRetentionPlanIsReadOnly(plan), true);
    assert.equal(plan.actions.find((entry) => entry.record_id === 'journal-1').decision, 'RETAIN');
    assert.equal(plan.actions.find((entry) => entry.record_id === 'uncertain-1').reason_code, 'LEGAL_HOLD');
    assert.equal(plan.actions.find((entry) => entry.record_id === 'eligible-1').decision, 'ELIGIBLE_FOR_SEPARATELY_AUTHORIZED_PURGE');
    assert.equal(plan.operations_not_authorized.includes('PURGE'), true);
  } finally { await value.cleanup(); }
});

test('event log and evidence index are schema-valid and redact unsafe paths and URIs', async () => {
  const journal = {
    status: 'UNKNOWN',
    entries: [{ sequence: 1, item_id: 'managed', path: '/home/example/private.txt', action: 'CREATE', state: 'UNKNOWN', before_sha256: null, after_sha256: null, error_code: 'UNKNOWN_EFFECT' }],
  };
  const eventLog = buildLifecycleEventLogFromJournal({ operationId: 'install-evidence-0001', operationClass: 'INSTALL', journal, clock, limitations: ['token=github_pat_not_real'] });
  assert.equal(eventLog.events[1].logical_path, '[REDACTED]');
  assert.equal(JSON.stringify(eventLog).includes('github_pat_not_real'), false);
  const evidence = buildLifecycleEvidenceIndex({ evidenceId: 'evidence-lifecycle-0001', commitSha: 'a'.repeat(40), createdAt: clock(), artifacts: [{ id: 'event-log', kind: 'TEST', result: 'PASS', document: eventLog, uri: 'authorization=Bearer hidden' }], limitations: ['prompt=private instructions'] });
  assert.equal(JSON.stringify(evidence).includes('hidden'), false);
  assert.equal(JSON.stringify(evidence).includes('private instructions'), false);
  const eventValidation = await validateBySchemaId(eventLog, 'urn:agentic-devops:lifecycle-event-log:3.0');
  const evidenceValidation = await validateBySchemaId(evidence, 'urn:agentic-devops:evidence-index:3.0');
  assert.equal(eventValidation.ok, true, eventValidation.errors.join('\n'));
  assert.equal(evidenceValidation.ok, true, evidenceValidation.errors.join('\n'));
});
