import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRetentionPolicy, retentionDecision, scanRetentionSourceOfTruth, validateRetention } from '../../tools/lib/retention.mjs';

const now = new Date('2027-01-01T00:00:00.000Z');
const daysAgo = (days) => new Date(now.getTime() - days * 86_400_000).toISOString();

test('retention policy is the valid single source and consumers contain no copied values', async () => {
  const result = await validateRetention();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.ok(result.scannedConsumers > 0);
});

test('indefinite records and uncertain or unreconciled operations are always held', async () => {
  const policy = await loadRetentionPolicy();
  for (const kind of Object.keys(policy.records)) assert.deepEqual(retentionDecision({ kind }, policy, { now }), { retain: true, reason: 'INDEFINITE' });
  for (const outcome of policy.legal_holds.outcomes) assert.equal(retentionDecision({ kind: 'backup', outcome }, policy, { now }).reason, 'LEGAL_HOLD');
  for (const reconciliation_status of policy.legal_holds.reconciliation_states) assert.equal(retentionDecision({ kind: 'backup', reconciliation_status }, policy, { now }).reason, 'LEGAL_HOLD');
  assert.equal(retentionDecision({ kind: 'backup', legal_hold: { active: true, reason: 'MANUAL' }, retention_class: 'SUCCESSFUL_VERSION', success_rank: 99, created_at: daysAgo(999) }, policy, { now }).reason, 'LEGAL_HOLD');
});

test('successful-version and post-uninstall clock boundaries are read from policy', async () => {
  const policy = await loadRetentionPolicy();
  const successful = policy.backups.successful_versions;
  assert.equal(retentionDecision({ kind: 'backup', retention_class: 'SUCCESSFUL_VERSION', success_rank: successful.minimum_count, created_at: daysAgo(successful.minimum_days + 1) }, policy, { now }).retain, true);
  assert.equal(retentionDecision({ kind: 'backup', retention_class: 'SUCCESSFUL_VERSION', success_rank: successful.minimum_count + 1, created_at: daysAgo(successful.minimum_days - 1) }, policy, { now }).retain, true);
  assert.equal(retentionDecision({ kind: 'backup', retention_class: 'SUCCESSFUL_VERSION', success_rank: successful.minimum_count + 1, created_at: daysAgo(successful.minimum_days) }, policy, { now }).retain, false);
  assert.equal(retentionDecision({ kind: 'backup', retention_class: 'POST_UNINSTALL', created_at: daysAgo(policy.backups.post_uninstall_days - 1) }, policy, { now }).retain, true);
  assert.equal(retentionDecision({ kind: 'backup', retention_class: 'POST_UNINSTALL', created_at: daysAgo(policy.backups.post_uninstall_days) }, policy, { now }).retain, false);
  assert.equal(retentionDecision({ kind: 'backup', retention_class: 'INSTALLATION_ORIGINAL', installation_active: true, created_at: daysAgo(500) }, policy, { now }).reason, 'INSTALLATION_ORIGINAL');
});

test('source-of-truth scan rejects duplicated retention literals in consumers', async () => {
  const policy = await loadRetentionPolicy();
  const copied = `const minimumRetentionDays = ${policy.backups.successful_versions.minimum_days};`;
  const errors = scanRetentionSourceOfTruth([{ path: 'tools/lib/planner.mjs', text: copied }], policy);
  assert.equal(errors.length, 1);
  assert.deepEqual(scanRetentionSourceOfTruth([{ path: 'tools/lib/planner.mjs', text: 'const days = policy.backups.successful_versions.minimum_days;' }], policy), []);
});
