import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { frameworkRoot } from '../../tools/lib/io.mjs';
import {
  applySyntheticSelfUpdate,
  createInstallationJournal,
  createOperationContext,
  createSyntheticWriteGuard,
  createVerifiedBackup,
  modelPostRestartValidation,
} from '../../tools/lib/installation.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const HASH = 'a'.repeat(64);
const clock = () => new Date('2026-07-28T12:00:00.000Z');

async function fixture() {
  const sandbox = await mkdtemp(resolve(tmpdir(), 'agentic-bootstrap-flow-'));
  const sourceRoot = resolve(sandbox, 'source');
  const destinationRoot = resolve(sandbox, 'destination');
  const backupRoot = resolve(sandbox, 'backups');
  await mkdir(resolve(sourceRoot, 'skills/workflow-bootstrap'), { recursive: true });
  await mkdir(resolve(destinationRoot, 'skills/workflow-bootstrap'), { recursive: true });
  const oldSkill = Buffer.from('old-bootstrap\n');
  const newSkill = Buffer.from('new-bootstrap\n');
  await writeFile(resolve(sourceRoot, 'skills/workflow-bootstrap/SKILL.md'), newSkill);
  await writeFile(resolve(destinationRoot, 'skills/workflow-bootstrap/SKILL.md'), oldSkill);
  const bindings = { manifest_sha256: HASH, lock_sha256: 'b'.repeat(64), package_sha256: 'c'.repeat(64), snapshot_sha256: 'd'.repeat(64), authorization_snapshot_sha256: 'd'.repeat(64) };
  const noChange = { sequence: 1, item_id: 'core-workflow', path: 'core/workflow.yaml', phase: 'SUPPORT', state: 'IDENTICAL', action: 'NO_CHANGE', before_sha256: HASH, source_sha256: HASH };
  const self = { sequence: 2, item_id: 'skill-bootstrap', path: 'skills/workflow-bootstrap/SKILL.md', phase: 'SELF_UPDATE', state: 'MANAGED_OUTDATED', action: 'BACKUP_UPDATE', before_sha256: hash(oldSkill), source_sha256: hash(newSkill) };
  const plan = { decision: 'CHECKPOINT_REQUIRED', dry_run_decision: 'CHECKPOINT_REQUIRED', bindings, actions: [noChange, self], mutable_actions: [self], blocked_actions: [] };
  const manifest = { source_catalog: [{ id: 'source-self', path: 'skills/workflow-bootstrap/SKILL.md' }], managed_items: [{ id: 'skill-bootstrap', source_id: 'source-self' }] };
  const context = createOperationContext({ destinationRoot, backupRoot, plan, operationId: 'install-bootstrap-0001', clock });
  const backupManifest = await createVerifiedBackup({ context, plan, clock });
  const journal = createInstallationJournal({ context, plan });
  const authorization = { current: true, snapshot_sha256: bindings.snapshot_sha256 };
  return { sandbox, sourceRoot, destinationRoot, backupRoot, plan, manifest, context, backupManifest, journal, authorization, newSkill };
}

const cleanup = async (value) => rm(value.sandbox, { recursive: true, force: true });

test('bootstrap Skill consumes the validated planner and defines separate Stage B without a parallel path map', async () => {
  const skill = await readFile(resolve(frameworkRoot, 'skills/workflow-bootstrap/SKILL.md'), 'utf8');
  const migration = await readFile(resolve(frameworkRoot, 'skills/workflow-bootstrap/references/migration.md'), 'utf8');
  assert.match(skill, /planDistribution/);
  assert.match(skill, /RESTART_REQUIRED/);
  assert.match(skill, /No journal, receipt, evidence/);
  assert.match(migration, /sole source-to-destination map/);
  assert.match(migration, /Stage B requires a real restart and a new execution/);
  assert.match(migration, /64 `NO_CHANGE`/);
  assert.match(migration, /PROJECT_UPDATE/);
  assert.doesNotMatch(migration, /steering\/contracts\/ArtifactContract\.md/);
});

test('self-update is the final synthetic write and closes the hard-stop guard', async () => {
  const value = await fixture();
  try {
    const guard = createSyntheticWriteGuard();
    const result = await applySyntheticSelfUpdate({ ...value, writeGuard: guard });
    assert.equal(result.status, 'RESTART_REQUIRED');
    assert.equal(result.hard_stop, true);
    assert.deepEqual(result.writes, ['skills/workflow-bootstrap/SKILL.md']);
    assert.deepEqual(await readFile(resolve(value.destinationRoot, 'skills/workflow-bootstrap/SKILL.md')), value.newSkill);
    assert.equal(guard.closed, true);
    assert.throws(() => guard.record('receipt.yaml'), /HARD_STOP_RESTART_REQUIRED/);
    assert.ok(result.actions_not_executed.includes('POST_RESTART_VALIDATION'));
    assert.ok(result.actions_not_executed.includes('PROJECT_UPDATE'));
  } finally { await cleanup(value); }
});

test('self-update rejects non-final order and unverified prior mutable actions', async () => {
  const value = await fixture();
  try {
    const notLast = structuredClone(value.plan);
    notLast.actions.push({ sequence: 3, item_id: 'late-write', path: 'late', phase: 'SUPPORT', action: 'CREATE' });
    await assert.rejects(applySyntheticSelfUpdate({ ...value, plan: notLast }), /SELF_UPDATE_NOT_LAST/);

    const prior = { sequence: 1, item_id: 'prior-create', path: 'core/prior.md', phase: 'SUPPORT', state: 'ABSENT', action: 'CREATE', before_sha256: null, source_sha256: HASH };
    const unverifiedPlan = { ...value.plan, actions: [prior, value.plan.actions[0], value.plan.actions[1]], mutable_actions: [prior, value.plan.mutable_actions[0]] };
    const unverifiedJournal = createInstallationJournal({ context: value.context, plan: unverifiedPlan });
    await assert.rejects(applySyntheticSelfUpdate({ ...value, plan: unverifiedPlan, journal: unverifiedJournal }), /PRE_SELF_UPDATE_NOT_VERIFIED/);
  } finally { await cleanup(value); }
});

test('post-restart model is read-only, separate and does not claim runtime execution', () => {
  const stageB = modelPostRestartValidation();
  assert.equal(stageB.status, 'NOT_EXECUTED');
  assert.equal(stageB.requires_new_execution, true);
  assert.equal(stageB.requires_real_restart, true);
  assert.ok(stageB.checks.includes('64_MANAGED_PATHS_HASHES_METADATA'));
  assert.ok(stageB.checks.includes('10_SKILLS_DISCOVERABLE'));
  assert.ok(stageB.checks.includes('9_LEGACY_PATHS_ABSENT'));
  assert.ok(stageB.operations_not_authorized.includes('RESTART'));
  assert.ok(stageB.operations_not_authorized.includes('REAL_PILOT'));
});
