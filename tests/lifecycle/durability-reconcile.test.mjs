import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createNodeFilesystemAdapter } from '../../adapters/lifecycle/node-filesystem.mjs';
import { atomicReplaceFile } from '../../tools/lib/lifecycle/atomic-writer.mjs';
import { assertNoBlindRetry, assertPurgeAllowed, reconcileUncertainReadOnly } from '../../tools/lib/lifecycle/reconcile.mjs';
import { acquireOperationLock, createDurableJournalStore, initializeOperationState, observeOperationLock, releaseOperationLock } from '../../tools/lib/lifecycle/state-store.mjs';
import { clock, sha256, treeDigest } from './harness.mjs';

async function fixture() {
  const sandbox = await mkdtemp(resolve(tmpdir(), 'agentic-m5-durable-'));
  const stateRoot = resolve(sandbox, 'state');
  const destinationRoot = resolve(sandbox, 'destination');
  await Promise.all([mkdir(stateRoot, { mode: 0o700 }), mkdir(destinationRoot, { mode: 0o700 })]);
  return { sandbox, stateRoot, destinationRoot, fs: createNodeFilesystemAdapter(), cleanup: () => rm(sandbox, { recursive: true, force: true }) };
}

test('destination lock is exclusive across operation classes and stale is observation-only', async () => {
  const value = await fixture();
  try {
    const first = await acquireOperationLock({ fs: value.fs, stateRoot: value.stateRoot, operationId: 'install-lock-0001', operationClass: 'INSTALL', sessionId: 'session-lock-0001', processId: 1001, clock, isProcessActive: () => true });
    await assert.rejects(acquireOperationLock({ fs: value.fs, stateRoot: value.stateRoot, operationId: 'update-lock-0002', operationClass: 'UPDATE', sessionId: 'session-lock-0002', processId: 1002, clock, isProcessActive: () => true }), /ACTIVE_OPERATION_LOCK/);
    const stale = await observeOperationLock({ fs: value.fs, stateRoot: value.stateRoot, operationClass: 'ROLLBACK', isProcessActive: () => false });
    assert.equal(stale.state, 'STALE_OBSERVED');
    assert.equal(stale.removal_authorized, false);
    await assert.rejects(releaseOperationLock({ fs: value.fs, lockHandle: first, operationRoot: value.stateRoot, outcome: 'UNKNOWN', reconciliationStatus: 'UNRECONCILED' }), /UNCERTAIN_LOCK_MUST_REMAIN/);
    assert.equal((await observeOperationLock({ fs: value.fs, stateRoot: value.stateRoot, operationClass: 'INSTALL', isProcessActive: () => false })).present, true);
  } finally { await value.cleanup(); }
});

test('durable journal records fsynced intent before an effect', async () => {
  const value = await fixture();
  try {
    const { operationRoot } = await initializeOperationState({ fs: value.fs, stateRoot: value.stateRoot, operationId: 'install-journal-0001' });
    const store = createDurableJournalStore({ fs: value.fs, operationRoot });
    const journal = { schema_version: 1, operation_id: 'install-journal-0001', manifest_sha256: 'a'.repeat(64), snapshot_sha256: 'b'.repeat(64), status: 'PLANNED', entries: [{ sequence: 1, item_id: 'managed', path: 'managed/file.txt', action: 'CREATE', state: 'PLANNED', intent_recorded_at: clock().toISOString(), before_sha256: null, after_sha256: null, error_code: null }] };
    const result = await store.recordIntent(journal, journal.entries[0]);
    assert.equal(result.journal.entries[0].intent_fsynced, true);
    assert.equal(result.durable.fsynced, true);
    const disk = JSON.parse(await readFile(result.durable.path, 'utf8'));
    assert.equal(disk.event.type, 'INTENT');
    assert.equal(disk.journal.entries[0].intent_fsynced, true);
  } finally { await value.cleanup(); }
});

test('atomic writer fault boundaries classify observable destination effects without blind cleanup', async () => {
  const points = ['before-write', 'after-stage-write', 'before-sync', 'after-sync', 'before-rename', 'after-rename', 'after-write'];
  for (const point of points) {
    const value = await fixture();
    try {
      const bytes = Buffer.from(`payload-${point}`);
      let calls = 0;
      await assert.rejects(atomicReplaceFile({ fs: value.fs, root: value.destinationRoot, relativePath: 'managed/file.txt', bytes, expectedSha256: sha256(bytes), operationId: 'install-atomic-0001', sequence: 1, faultInjector: async (event) => { if (event.point === point) { calls += 1; throw new Error(`INJECTED_${point}`); } } }), (error) => error.lifecyclePoint === point);
      assert.equal(calls, 1);
      let present = true;
      try { await readFile(resolve(value.destinationRoot, 'managed/file.txt')); } catch (error) { if (error.code === 'ENOENT') present = false; else throw error; }
      assert.equal(present, ['after-rename', 'after-write'].includes(point), point);
    } finally { await value.cleanup(); }
  }
});

test('atomic writer rejects unsupported primitive and synthetic symlink ancestry', async () => {
  const value = await fixture();
  try {
    const unsupported = createNodeFilesystemAdapter({ atomicRenameSupported: false });
    await assert.rejects(atomicReplaceFile({ fs: unsupported, root: value.destinationRoot, relativePath: 'x.txt', bytes: Buffer.from('x'), expectedSha256: sha256('x'), operationId: 'install-atomic-0002', sequence: 1 }), /ATOMICITY_UNSUPPORTED/);
    await mkdir(resolve(value.sandbox, 'outside'));
    await symlink(resolve(value.sandbox, 'outside'), resolve(value.destinationRoot, 'linked'));
    await assert.rejects(atomicReplaceFile({ fs: value.fs, root: value.destinationRoot, relativePath: 'linked/x.txt', bytes: Buffer.from('x'), expectedSha256: sha256('x'), operationId: 'install-atomic-0003', sequence: 1 }), /DESTINATION_ANCESTOR_UNSAFE/);
  } finally { await value.cleanup(); }
});

test('reconcile is byte-for-byte read-only and uncertain state forbids blind retry and purge', async () => {
  const value = await fixture();
  try {
    const plan = { mutable_actions: [{ item_id: 'managed', path: 'managed/file.txt', action: 'CREATE', source_sha256: sha256('new'), before_sha256: null }] };
    const journal = { status: 'UNKNOWN', entries: [{ item_id: 'managed', path: 'managed/file.txt', state: 'UNKNOWN' }] };
    const beforeDestination = await treeDigest(value.destinationRoot);
    const beforeState = await treeDigest(value.stateRoot);
    const reconciliation = await reconcileUncertainReadOnly({ fs: value.fs, destinationRoot: value.destinationRoot, plan, journal, clock });
    assert.equal(reconciliation.read_only, true);
    assert.equal(reconciliation.decision, 'RECONCILED_REQUIRES_NEW_AUTHORIZATION');
    assert.equal(reconciliation.observations[0].classification, 'NO_EFFECT_VERIFIED');
    assert.equal(await treeDigest(value.destinationRoot), beforeDestination);
    assert.equal(await treeDigest(value.stateRoot), beforeState);
    assert.throws(() => assertNoBlindRetry({ journal, reconciliation: null, authorizationValidated: true }), /BLIND_RETRY_PROHIBITED/);
    assert.throws(() => assertNoBlindRetry({ journal, reconciliation, authorizationValidated: false }), /NEW_AUTHORIZATION_REQUIRED/);
    assert.equal(assertNoBlindRetry({ journal, reconciliation, authorizationValidated: true }), true);
    assert.throws(() => assertPurgeAllowed({ journal, reconciliation }), /UNCERTAIN_STATE_PURGE_PROHIBITED/);
  } finally { await value.cleanup(); }
});
