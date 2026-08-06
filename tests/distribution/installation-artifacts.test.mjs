import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { validateBySchemaId } from '../../tools/lib/schema.mjs';
import {
  assertInjectedInstallationRoots,
  buildInstallationReceipt,
  createInstallationJournal,
  createOperationContext,
  createVerifiedBackup,
  transitionJournalEntry,
  verifyBackupManifest,
} from '../../tools/lib/installation.mjs';

const HASH = 'a'.repeat(64);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const clock = () => new Date('2026-07-28T12:00:00.000Z');

async function fixture() {
  const sandbox = await mkdtemp(resolve(tmpdir(), 'agentic-install-artifacts-'));
  const destinationRoot = resolve(sandbox, 'destination');
  const backupRoot = resolve(sandbox, 'backups');
  await mkdir(resolve(destinationRoot, 'policies'), { recursive: true });
  await mkdir(resolve(destinationRoot, 'skills/workflow-bootstrap'), { recursive: true });
  const policyBytes = Buffer.from('old-policy\n');
  const skillBytes = Buffer.from('old-skill\n');
  await writeFile(resolve(destinationRoot, 'policies/ContextPolicy.md'), policyBytes);
  await writeFile(resolve(destinationRoot, 'skills/workflow-bootstrap/SKILL.md'), skillBytes);
  const bindings = {
    manifest_sha256: HASH,
    lock_sha256: 'b'.repeat(64),
    package_sha256: 'c'.repeat(64),
    snapshot_sha256: 'd'.repeat(64),
    authorization_snapshot_sha256: 'd'.repeat(64),
  };
  const actions = [
    { sequence: 1, item_id: 'policy-context', path: 'policies/ContextPolicy.md', phase: 'SUPPORT', state: 'MANAGED_OUTDATED', action: 'BACKUP_UPDATE', before_sha256: hash(policyBytes), source_sha256: 'e'.repeat(64) },
    { sequence: 2, item_id: 'core-new', path: 'core/new.md', phase: 'SUPPORT', state: 'ABSENT', action: 'CREATE', before_sha256: null, source_sha256: 'f'.repeat(64) },
    { sequence: 3, item_id: 'skill-bootstrap', path: 'skills/workflow-bootstrap/SKILL.md', phase: 'SELF_UPDATE', state: 'MANAGED_OUTDATED', action: 'BACKUP_UPDATE', before_sha256: hash(skillBytes), source_sha256: '1'.repeat(64) },
  ];
  const plan = {
    decision: 'CHECKPOINT_REQUIRED',
    dry_run_decision: 'CHECKPOINT_REQUIRED',
    bindings,
    actions,
    mutable_actions: actions,
  };
  const context = createOperationContext({ destinationRoot, backupRoot, plan, operationId: 'install-test-0001', clock });
  return { sandbox, destinationRoot, backupRoot, plan, context };
}

async function cleanup(value) {
  await rm(value.sandbox, { recursive: true, force: true });
}

test('operation context requires explicit disjoint roots and binds the approved plan', async () => {
  const value = await fixture();
  try {
    assert.equal(value.context.operation_id, 'install-test-0001');
    assert.equal(value.context.bindings.snapshot_sha256, value.plan.bindings.snapshot_sha256);
    assert.throws(() => assertInjectedInstallationRoots({ destinationRoot: value.destinationRoot, backupRoot: resolve(value.destinationRoot, 'backup') }), /ROOTS_MUST_BE_EXTERNAL_AND_DISJOINT/);
    assert.throws(() => createOperationContext({ destinationRoot: value.destinationRoot, plan: value.plan }), /BACKUP_ROOT_MUST_BE_ABSOLUTE/);
  } finally {
    await cleanup(value);
  }
});

test('backup copies and verifies bytes before producing a valid manifest', async () => {
  const value = await fixture();
  try {
    const manifest = await createVerifiedBackup({ context: value.context, plan: value.plan, clock });
    assert.equal(manifest.entries.length, 2);
    assert.ok(manifest.entries.every((entry) => entry.verified));
    assert.equal((await validateBySchemaId(manifest, 'urn:agentic-devops:distribution-backup-manifest:3.0')).ok, true);
    assert.equal(await verifyBackupManifest({ context: value.context, manifest }), true);
    const firstBackup = resolve(value.context.operationRoot, manifest.entries[0].backup_path);
    await writeFile(firstBackup, 'corrupted');
    await assert.rejects(verifyBackupManifest({ context: value.context, manifest }), /BACKUP_ENTRY_INCONSISTENT/);
  } finally {
    await cleanup(value);
  }
});

test('journal enforces intent-first transitions and verification hashes', async () => {
  const value = await fixture();
  try {
    let journal = createInstallationJournal({ context: value.context, plan: value.plan });
    assert.equal((await validateBySchemaId(journal, 'urn:agentic-devops:installation-journal:3.0')).ok, true);
    assert.throws(() => transitionJournalEntry(journal, { itemId: 'policy-context', to: 'VERIFIED', afterSha256: HASH, clock }), /INVALID_JOURNAL_TRANSITION/);
    journal = transitionJournalEntry(journal, { itemId: 'policy-context', to: 'BACKED_UP', clock });
    journal = transitionJournalEntry(journal, { itemId: 'policy-context', to: 'APPLYING', clock });
    journal = transitionJournalEntry(journal, { itemId: 'policy-context', to: 'APPLIED', afterSha256: HASH, clock });
    assert.throws(() => transitionJournalEntry(journal, { itemId: 'policy-context', to: 'VERIFIED', clock }), /VERIFICATION_HASH_REQUIRED/);
    journal = transitionJournalEntry(journal, { itemId: 'policy-context', to: 'VERIFIED', afterSha256: HASH, clock });
    assert.equal(journal.entries[0].state, 'VERIFIED');
    assert.equal((await validateBySchemaId(journal, 'urn:agentic-devops:installation-journal:3.0')).ok, true);
  } finally {
    await cleanup(value);
  }
});

test('pre-restart receipt records only verified actions and keeps self-update pending', async () => {
  const value = await fixture();
  try {
    let journal = createInstallationJournal({ context: value.context, plan: value.plan });
    journal = transitionJournalEntry(journal, { itemId: 'policy-context', to: 'APPLYING', clock });
    journal = transitionJournalEntry(journal, { itemId: 'policy-context', to: 'APPLIED', afterSha256: HASH, clock });
    journal = transitionJournalEntry(journal, { itemId: 'policy-context', to: 'VERIFIED', afterSha256: HASH, clock });
    journal = transitionJournalEntry(journal, { itemId: 'core-new', to: 'APPLYING', clock });
    journal = transitionJournalEntry(journal, { itemId: 'core-new', to: 'APPLIED', afterSha256: HASH, clock });
    const receipt = buildInstallationReceipt({ context: value.context, plan: value.plan, journal });
    assert.deepEqual(receipt.actions.map((action) => action.item_id), ['policy-context']);
    assert.ok(receipt.actions_not_executed.includes('EXECUTED_UNVERIFIED:core-new'));
    assert.ok(receipt.actions_not_executed.includes('PENDING:skill-bootstrap'));
    assert.equal(receipt.pending_action, 'skill-bootstrap');
    assert.equal((await validateBySchemaId(receipt, 'urn:agentic-devops:installation-receipt:3.0')).ok, true);

    let falseJournal = transitionJournalEntry(journal, { itemId: 'skill-bootstrap', to: 'APPLYING', clock });
    falseJournal = transitionJournalEntry(falseJournal, { itemId: 'skill-bootstrap', to: 'APPLIED', afterSha256: HASH, clock });
    assert.throws(() => buildInstallationReceipt({ context: value.context, plan: value.plan, journal: falseJournal }), /PRE_RESTART_SELF_UPDATE_CANNOT_BE_RECORDED/);
  } finally {
    await cleanup(value);
  }
});

test('journal keeps failed and unknown outcomes out of completed receipt actions', async () => {
  const value = await fixture();
  try {
    let journal = createInstallationJournal({ context: value.context, plan: value.plan });
    journal = transitionJournalEntry(journal, { itemId: 'policy-context', to: 'FAILED_KNOWN', errorCode: 'INJECTED_FAILURE', clock });
    journal = transitionJournalEntry(journal, { itemId: 'core-new', to: 'UNKNOWN', errorCode: 'TIMEOUT_UNKNOWN', clock });
    const receipt = buildInstallationReceipt({ context: value.context, plan: value.plan, journal });
    assert.equal(receipt.actions.length, 0);
    assert.ok(receipt.actions_not_executed.includes('FAILED:policy-context'));
    assert.ok(receipt.actions_not_executed.includes('UNKNOWN:core-new'));
    assert.equal(receipt.status, 'FAILED_KNOWN');
    assert.doesNotMatch(JSON.stringify(receipt), /old-policy|old-skill|corrupted/);
  } finally {
    await cleanup(value);
  }
});
