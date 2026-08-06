import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  applySyntheticPlan,
  createOperationContext,
  createVerifiedBackup,
} from '../../tools/lib/installation.mjs';

const hash = (value) => createHash('sha256').update(value).digest('hex');
const HASH = 'a'.repeat(64);
const clock = () => new Date('2026-07-28T12:00:00.000Z');

async function fixture() {
  const sandbox = await mkdtemp(resolve(tmpdir(), 'agentic-install-apply-'));
  const sourceRoot = resolve(sandbox, 'source');
  const destinationRoot = resolve(sandbox, 'destination');
  const backupRoot = resolve(sandbox, 'backups');
  await mkdir(resolve(sourceRoot, 'policies'), { recursive: true });
  await mkdir(resolve(sourceRoot, 'core'), { recursive: true });
  await mkdir(resolve(sourceRoot, 'skills/workflow-bootstrap'), { recursive: true });
  await mkdir(resolve(sourceRoot, 'adapters/kiro/generated'), { recursive: true });
  await mkdir(resolve(destinationRoot, 'policies'), { recursive: true });
  await mkdir(resolve(destinationRoot, 'steering'), { recursive: true });
  await mkdir(resolve(destinationRoot, 'skills/workflow-bootstrap'), { recursive: true });
  const oldPolicy = Buffer.from('old-policy\n');
  const newPolicy = Buffer.from('new-policy\n');
  const newCore = Buffer.from('new-core\n');
  const legacy = Buffer.from('legacy-exact\n');
  const entrypoint = Buffer.from('entrypoint\n');
  const oldSkill = Buffer.from('old-skill\n');
  const newSkill = Buffer.from('new-skill\n');
  await writeFile(resolve(sourceRoot, 'policies/ContextPolicy.md'), newPolicy);
  await writeFile(resolve(sourceRoot, 'core/new.md'), newCore);
  await writeFile(resolve(sourceRoot, 'skills/workflow-bootstrap/SKILL.md'), newSkill);
  await writeFile(resolve(sourceRoot, 'adapters/kiro/generated/agentic-workflow.md'), entrypoint);
  await writeFile(resolve(destinationRoot, 'policies/ContextPolicy.md'), oldPolicy);
  await writeFile(resolve(destinationRoot, 'steering/workflow-core.md'), legacy);
  await writeFile(resolve(destinationRoot, 'steering/unmanaged.txt'), 'preserve-me');
  await writeFile(resolve(destinationRoot, 'skills/workflow-bootstrap/SKILL.md'), oldSkill);
  const bindings = {
    manifest_sha256: HASH,
    lock_sha256: 'b'.repeat(64),
    package_sha256: 'c'.repeat(64),
    snapshot_sha256: 'd'.repeat(64),
    authorization_snapshot_sha256: 'd'.repeat(64),
  };
  const actions = [
    { sequence: 1, item_id: 'policy-context', path: 'policies/ContextPolicy.md', phase: 'SUPPORT', state: 'MANAGED_OUTDATED', action: 'BACKUP_UPDATE', before_sha256: hash(oldPolicy), source_sha256: hash(newPolicy) },
    { sequence: 2, item_id: 'core-new', path: 'core/new.md', phase: 'SUPPORT', state: 'ABSENT', action: 'CREATE', before_sha256: null, source_sha256: hash(newCore) },
    { sequence: 3, item_id: 'adapter-kiro-steering', path: 'steering/agentic-workflow.md', phase: 'ENTRYPOINT', state: 'ABSENT', action: 'CREATE', before_sha256: null, source_sha256: hash(entrypoint) },
    { sequence: 4, item_id: 'retire:steering/workflow-core.md', path: 'steering/workflow-core.md', phase: 'LEGACY_RETIREMENT', state: 'LEGACY_ACTIVE_CONFLICT', action: 'BACKUP_RETIRE', before_sha256: hash(legacy), source_sha256: null },
    { sequence: 5, item_id: 'skill-bootstrap', path: 'skills/workflow-bootstrap/SKILL.md', phase: 'SELF_UPDATE', state: 'MANAGED_OUTDATED', action: 'BACKUP_UPDATE', before_sha256: hash(oldSkill), source_sha256: hash(newSkill) },
  ];
  const plan = { decision: 'CHECKPOINT_REQUIRED', dry_run_decision: 'CHECKPOINT_REQUIRED', bindings, actions, mutable_actions: actions, blocked_actions: [] };
  const manifest = {
    source_catalog: [
      { id: 'source-policy', path: 'policies/ContextPolicy.md' },
      { id: 'source-core', path: 'core/new.md' },
      { id: 'source-entrypoint', path: 'adapters/kiro/generated/agentic-workflow.md' },
      { id: 'source-skill', path: 'skills/workflow-bootstrap/SKILL.md' },
    ],
    managed_items: [
      { id: 'policy-context', source_id: 'source-policy' },
      { id: 'core-new', source_id: 'source-core' },
      { id: 'adapter-kiro-steering', source_id: 'source-entrypoint' },
      { id: 'skill-bootstrap', source_id: 'source-skill' },
    ],
  };
  const context = createOperationContext({ destinationRoot, backupRoot, plan, operationId: 'install-apply-0001', clock });
  const backupManifest = await createVerifiedBackup({ context, plan, clock });
  const authorization = { current: true, snapshot_sha256: bindings.snapshot_sha256 };
  return { sandbox, sourceRoot, destinationRoot, backupRoot, plan, manifest, context, backupManifest, authorization, oldPolicy, newPolicy, newCore, legacy, oldSkill };
}

const cleanup = async (value) => rm(value.sandbox, { recursive: true, force: true });

async function missing(path) {
  try { await readFile(path); return false; } catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}

test('synthetic apply updates, creates and retires in order while preserving unmanaged content', async () => {
  const value = await fixture();
  try {
    const result = await applySyntheticPlan(value);
    assert.equal(result.status, 'READY_FOR_SELF_UPDATE');
    assert.deepEqual(result.completed, ['policy-context', 'core-new', 'adapter-kiro-steering', 'retire:steering/workflow-core.md']);
    assert.deepEqual(await readFile(resolve(value.destinationRoot, 'policies/ContextPolicy.md')), value.newPolicy);
    assert.deepEqual(await readFile(resolve(value.destinationRoot, 'core/new.md')), value.newCore);
    assert.equal(await missing(resolve(value.destinationRoot, 'steering/workflow-core.md')), true);
    assert.equal(await readFile(resolve(value.destinationRoot, 'steering/unmanaged.txt'), 'utf8'), 'preserve-me');
    assert.deepEqual(await readFile(resolve(value.destinationRoot, 'skills/workflow-bootstrap/SKILL.md')), value.oldSkill);
    assert.equal(result.journal.entries.find((entry) => entry.item_id === 'skill-bootstrap').state, 'PLANNED');
    assert.deepEqual((await readdir(resolve(value.destinationRoot, 'steering'))).sort(), ['agentic-workflow.md', 'unmanaged.txt']);
  } finally { await cleanup(value); }
});

test('expired authorization fails before the first synthetic mutation', async () => {
  const value = await fixture();
  try {
    const result = await applySyntheticPlan({ ...value, authorization: { current: false, snapshot_sha256: value.plan.bindings.snapshot_sha256 } });
    assert.equal(result.status, 'FAILED_KNOWN');
    assert.equal(result.error_code, 'AUTHORIZATION_EXPIRED');
    assert.deepEqual(await readFile(resolve(value.destinationRoot, 'policies/ContextPolicy.md')), value.oldPolicy);
    assert.equal(await missing(resolve(value.destinationRoot, 'core/new.md')), true);
    assert.equal(await missing(resolve(value.destinationRoot, 'steering/workflow-core.md')), false);
  } finally { await cleanup(value); }
});

test('destination divergence after backup blocks immediately without overwrite', async () => {
  const value = await fixture();
  try {
    await writeFile(resolve(value.destinationRoot, 'policies/ContextPolicy.md'), 'external-change');
    const result = await applySyntheticPlan(value);
    assert.equal(result.status, 'FAILED_KNOWN');
    assert.equal(result.error_code, 'SNAPSHOT_DIVERGED');
    assert.equal(await readFile(resolve(value.destinationRoot, 'policies/ContextPolicy.md'), 'utf8'), 'external-change');
    assert.equal(await missing(resolve(value.destinationRoot, 'core/new.md')), true);
  } finally { await cleanup(value); }
});

test('fault injection before and after write records known partial state without retry', async () => {
  const before = await fixture();
  try {
    const result = await applySyntheticPlan({
      ...before,
      faultInjector: async ({ point, action }) => {
        if (point === 'before-write' && action.item_id === 'policy-context') throw new Error('INJECTED_BEFORE_WRITE');
      },
    });
    assert.equal(result.status, 'FAILED_KNOWN');
    assert.deepEqual(await readFile(resolve(before.destinationRoot, 'policies/ContextPolicy.md')), before.oldPolicy);
  } finally { await cleanup(before); }

  const after = await fixture();
  try {
    const result = await applySyntheticPlan({
      ...after,
      faultInjector: async ({ point, action }) => {
        if (point === 'after-write' && action.item_id === 'policy-context') throw new Error('INJECTED_AFTER_WRITE');
      },
    });
    assert.equal(result.status, 'FAILED_KNOWN');
    assert.deepEqual(await readFile(resolve(after.destinationRoot, 'policies/ContextPolicy.md')), after.newPolicy);
    assert.equal(result.journal.entries[0].state, 'FAILED_KNOWN');
    assert.deepEqual(result.completed, []);
  } finally { await cleanup(after); }
});

test('unknown injected effect blocks and records UNKNOWN without continuing', async () => {
  const value = await fixture();
  try {
    const result = await applySyntheticPlan({
      ...value,
      faultInjector: async ({ point, action }) => {
        if (point === 'after-write' && action.item_id === 'policy-context') {
          const error = new Error('TIMEOUT');
          error.unknown = true;
          throw error;
        }
      },
    });
    assert.equal(result.status, 'UNKNOWN');
    assert.equal(result.failed_item, 'policy-context');
    assert.equal(result.journal.status, 'UNKNOWN');
    assert.equal(await missing(resolve(value.destinationRoot, 'core/new.md')), true);
  } finally { await cleanup(value); }
});

test('fault matrix covers before and after every pre-restart write class without retry', async () => {
  const writeClasses = [
    ['policy-context', 'BACKUP_UPDATE'],
    ['core-new', 'CREATE_SUPPORT'],
    ['adapter-kiro-steering', 'CREATE_ENTRYPOINT'],
    ['retire:steering/workflow-core.md', 'BACKUP_RETIRE'],
  ];
  for (const [itemId, label] of writeClasses) {
    for (const point of ['before-write', 'after-write']) {
      const value = await fixture();
      let injections = 0;
      try {
        const result = await applySyntheticPlan({
          ...value,
          faultInjector: async (event) => {
            if (event.point === point && event.action.item_id === itemId) {
              injections += 1;
              throw new Error(`INJECTED_${label}_${point}`);
            }
          },
        });
        assert.equal(result.status, 'FAILED_KNOWN', `${label} ${point}`);
        assert.equal(result.failed_item, itemId, `${label} ${point}`);
        assert.equal(injections, 1, `${label} ${point} must not retry`);
        assert.equal(result.journal.entries.find((entry) => entry.item_id === itemId).state, 'FAILED_KNOWN');
        assert.equal(result.completed.includes('skill-bootstrap'), false);
      } finally {
        await cleanup(value);
      }
    }
  }
});