import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { validateBySchemaId } from '../../tools/lib/schema.mjs';
import {
  applySyntheticPlan,
  buildInstallationReceipt,
  createOperationContext,
  createVerifiedBackup,
  deriveSyntheticRollbackPlan,
  resumeSyntheticPlan,
  rollbackSyntheticPlan,
} from '../../tools/lib/installation.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const HASH = 'a'.repeat(64);
const clock = () => new Date('2026-07-28T12:00:00.000Z');

async function fixture() {
  const sandbox = await mkdtemp(resolve(tmpdir(), 'agentic-install-recovery-'));
  const sourceRoot = resolve(sandbox, 'source');
  const destinationRoot = resolve(sandbox, 'destination');
  const backupRoot = resolve(sandbox, 'backups');
  for (const directory of [
    resolve(sourceRoot, 'policies'), resolve(sourceRoot, 'core'), resolve(sourceRoot, 'adapters/kiro/generated'), resolve(sourceRoot, 'skills/workflow-bootstrap'),
    resolve(destinationRoot, 'policies'), resolve(destinationRoot, 'steering'), resolve(destinationRoot, 'skills/workflow-bootstrap'),
  ]) await mkdir(directory, { recursive: true });
  const bytes = {
    oldPolicy: Buffer.from('old-policy\n'), newPolicy: Buffer.from('new-policy\n'),
    newCore: Buffer.from('new-core\n'), entrypoint: Buffer.from('entrypoint\n'),
    legacy: Buffer.from('legacy-exact\n'), oldSkill: Buffer.from('old-skill\n'), newSkill: Buffer.from('new-skill\n'),
  };
  await writeFile(resolve(sourceRoot, 'policies/ContextPolicy.md'), bytes.newPolicy);
  await writeFile(resolve(sourceRoot, 'core/new.md'), bytes.newCore);
  await writeFile(resolve(sourceRoot, 'adapters/kiro/generated/agentic-workflow.md'), bytes.entrypoint);
  await writeFile(resolve(sourceRoot, 'skills/workflow-bootstrap/SKILL.md'), bytes.newSkill);
  await writeFile(resolve(destinationRoot, 'policies/ContextPolicy.md'), bytes.oldPolicy);
  await chmod(resolve(destinationRoot, 'policies/ContextPolicy.md'), 0o600);
  await writeFile(resolve(destinationRoot, 'steering/workflow-core.md'), bytes.legacy);
  await writeFile(resolve(destinationRoot, 'steering/unmanaged.txt'), 'preserve-me');
  await writeFile(resolve(destinationRoot, 'skills/workflow-bootstrap/SKILL.md'), bytes.oldSkill);
  const bindings = { manifest_sha256: HASH, lock_sha256: 'b'.repeat(64), package_sha256: 'c'.repeat(64), snapshot_sha256: 'd'.repeat(64), authorization_snapshot_sha256: 'd'.repeat(64) };
  const actions = [
    { sequence: 1, item_id: 'policy-context', path: 'policies/ContextPolicy.md', phase: 'SUPPORT', state: 'MANAGED_OUTDATED', action: 'BACKUP_UPDATE', before_sha256: hash(bytes.oldPolicy), source_sha256: hash(bytes.newPolicy) },
    { sequence: 2, item_id: 'core-new', path: 'core/new.md', phase: 'SUPPORT', state: 'ABSENT', action: 'CREATE', before_sha256: null, source_sha256: hash(bytes.newCore) },
    { sequence: 3, item_id: 'adapter-kiro-steering', path: 'steering/agentic-workflow.md', phase: 'ENTRYPOINT', state: 'ABSENT', action: 'CREATE', before_sha256: null, source_sha256: hash(bytes.entrypoint) },
    { sequence: 4, item_id: 'retire:steering/workflow-core.md', path: 'steering/workflow-core.md', phase: 'LEGACY_RETIREMENT', state: 'LEGACY_ACTIVE_CONFLICT', action: 'BACKUP_RETIRE', before_sha256: hash(bytes.legacy), source_sha256: null },
    { sequence: 5, item_id: 'skill-bootstrap', path: 'skills/workflow-bootstrap/SKILL.md', phase: 'SELF_UPDATE', state: 'MANAGED_OUTDATED', action: 'BACKUP_UPDATE', before_sha256: hash(bytes.oldSkill), source_sha256: hash(bytes.newSkill) },
  ];
  const plan = { decision: 'CHECKPOINT_REQUIRED', dry_run_decision: 'CHECKPOINT_REQUIRED', bindings, actions, mutable_actions: actions, blocked_actions: [] };
  const manifest = {
    source_catalog: [
      { id: 's-policy', path: 'policies/ContextPolicy.md' }, { id: 's-core', path: 'core/new.md' },
      { id: 's-entrypoint', path: 'adapters/kiro/generated/agentic-workflow.md' }, { id: 's-skill', path: 'skills/workflow-bootstrap/SKILL.md' },
    ],
    managed_items: [
      { id: 'policy-context', source_id: 's-policy' }, { id: 'core-new', source_id: 's-core' },
      { id: 'adapter-kiro-steering', source_id: 's-entrypoint' }, { id: 'skill-bootstrap', source_id: 's-skill' },
    ],
  };
  const context = createOperationContext({ destinationRoot, backupRoot, plan, operationId: 'install-recovery-0001', clock });
  const backupManifest = await createVerifiedBackup({ context, plan, clock });
  const authorization = { current: true, snapshot_sha256: bindings.snapshot_sha256 };
  return { sandbox, sourceRoot, destinationRoot, backupRoot, plan, manifest, context, backupManifest, authorization, bytes };
}

const cleanup = async (value) => rm(value.sandbox, { recursive: true, force: true });
async function absent(path) { try { await readFile(path); return false; } catch (error) { if (error.code === 'ENOENT') return true; throw error; } }

async function partialAfterWrite(value, unknown = false) {
  return applySyntheticPlan({
    ...value,
    faultInjector: async ({ point, action }) => {
      if (point === 'after-write' && action.item_id === 'policy-context') {
        const error = new Error(unknown ? 'TIMEOUT_UNKNOWN' : 'INJECTED_AFTER_WRITE');
        if (unknown) error.unknown = true;
        throw error;
      }
    },
  });
}

test('resume reconciles a known applied write, skips it and completes remaining non-self actions', async () => {
  const value = await fixture();
  try {
    const partial = await partialAfterWrite(value);
    const receipt = buildInstallationReceipt({ context: value.context, plan: value.plan, journal: partial.journal });
    const resumed = await resumeSyntheticPlan({ ...value, journal: partial.journal, receipt });
    assert.equal(resumed.status, 'READY_FOR_SELF_UPDATE');
    assert.deepEqual(resumed.completed, ['policy-context', 'core-new', 'adapter-kiro-steering', 'retire:steering/workflow-core.md']);
    assert.deepEqual(await readFile(resolve(value.destinationRoot, 'policies/ContextPolicy.md')), value.bytes.newPolicy);
    assert.equal(await absent(resolve(value.destinationRoot, 'steering/workflow-core.md')), true);
    assert.equal(await readFile(resolve(value.destinationRoot, 'steering/unmanaged.txt'), 'utf8'), 'preserve-me');
  } finally { await cleanup(value); }
});

test('resume blocks UNKNOWN state and expired authorization without retry', async () => {
  const value = await fixture();
  try {
    const partial = await partialAfterWrite(value, true);
    const blocked = await resumeSyntheticPlan({ ...value, journal: partial.journal });
    assert.equal(blocked.status, 'BLOCKED');
    assert.ok(blocked.reconciliation.errors.includes('UNKNOWN_PARTIAL_EFFECT'));

    const known = await fixture();
    try {
      const failed = await partialAfterWrite(known);
      const expired = await resumeSyntheticPlan({ ...known, journal: failed.journal, authorization: { current: false, snapshot_sha256: known.plan.bindings.snapshot_sha256 } });
      assert.equal(expired.status, 'BLOCKED');
      assert.ok(expired.reconciliation.errors.includes('AUTHORIZATION_EXPIRED'));
    } finally { await cleanup(known); }
  } finally { await cleanup(value); }
});

test('rollback is derived from operation state, checks after-hashes and restores bytes and metadata', async () => {
  const value = await fixture();
  try {
    const partial = await partialAfterWrite(value);
    const resumed = await resumeSyntheticPlan({ ...value, journal: partial.journal });
    const rollbackPlan = await deriveSyntheticRollbackPlan({ context: value.context, plan: value.plan, backupManifest: value.backupManifest, journal: resumed.journal });
    assert.equal(rollbackPlan.decision, 'CHECKPOINT_REQUIRED');
    assert.deepEqual(rollbackPlan.operations.map((operation) => operation.action), ['RESTORE', 'REMOVE_CREATED', 'REMOVE_CREATED', 'RESTORE']);
    const receipt = await rollbackSyntheticPlan({
      context: value.context,
      rollbackPlan,
      backupManifest: value.backupManifest,
      authorization: { current: true, synthetic: true, operation_id: value.context.operation_id },
      clock,
    });
    assert.equal(receipt.status, 'ROLLED_BACK');
    assert.equal((await validateBySchemaId(receipt, 'urn:agentic-devops:installation-receipt:3.0')).ok, true);
    assert.deepEqual(await readFile(resolve(value.destinationRoot, 'policies/ContextPolicy.md')), value.bytes.oldPolicy);
    assert.equal((await stat(resolve(value.destinationRoot, 'policies/ContextPolicy.md'))).mode & 0o777, 0o600);
    assert.equal(await absent(resolve(value.destinationRoot, 'core/new.md')), true);
    assert.equal(await absent(resolve(value.destinationRoot, 'steering/agentic-workflow.md')), true);
    assert.deepEqual(await readFile(resolve(value.destinationRoot, 'steering/workflow-core.md')), value.bytes.legacy);
    assert.equal(await readFile(resolve(value.destinationRoot, 'steering/unmanaged.txt'), 'utf8'), 'preserve-me');
    assert.deepEqual(await readFile(resolve(value.destinationRoot, 'skills/workflow-bootstrap/SKILL.md')), value.bytes.oldSkill);
  } finally { await cleanup(value); }
});

test('rollback derivation blocks destination after-hash divergence and real-like authorization omission', async () => {
  const value = await fixture();
  try {
    const partial = await partialAfterWrite(value);
    const resumed = await resumeSyntheticPlan({ ...value, journal: partial.journal });
    await writeFile(resolve(value.destinationRoot, 'policies/ContextPolicy.md'), 'external-change');
    const blocked = await deriveSyntheticRollbackPlan({ context: value.context, plan: value.plan, backupManifest: value.backupManifest, journal: resumed.journal });
    assert.equal(blocked.decision, 'BLOCKED');
    assert.ok(blocked.errors.includes('AFTER_HASH_DIVERGED'));

    const valid = await fixture();
    try {
      const validPartial = await partialAfterWrite(valid);
      const validResume = await resumeSyntheticPlan({ ...valid, journal: validPartial.journal });
      const validPlan = await deriveSyntheticRollbackPlan({ context: valid.context, plan: valid.plan, backupManifest: valid.backupManifest, journal: validResume.journal });
      await assert.rejects(rollbackSyntheticPlan({ context: valid.context, rollbackPlan: validPlan, backupManifest: valid.backupManifest, authorization: { current: true, operation_id: valid.context.operation_id } }), /ROLLBACK_AUTHORIZATION_REQUIRED/);
    } finally { await cleanup(valid); }
  } finally { await cleanup(value); }
});
