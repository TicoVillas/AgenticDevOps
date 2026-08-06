import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { applyProjectUpdate } from '../../tools/lib/project-update/engine.mjs';
import { createProjectHarness } from './harness.mjs';

test('apply without checkpoint is blocked before any state write', async () => {
  const value = await createProjectHarness();
  try {
    const planned = await value.plan();
    const authority = value.authorities(planned);
    await assert.rejects(applyProjectUpdate({ runtime: value.runtime, manifest: planned.manifest, plan: planned.plan, checkpoint: null, authorization: authority.authorization }), /PROJECT_CHECKPOINT_REQUIRED/);
    assert.deepEqual(await readdir(value.roots.state), []);
  } finally { await value.cleanup(); }
});

test('expired and divergent checkpoint are blocked before writes', async () => {
  const expired = await createProjectHarness();
  try {
    const planned = await expired.plan();
    const authority = expired.authorities(planned);
    const checkpoint = { ...authority.checkpoint, expires_at: '2026-08-05T12:00:00.000Z' };
    await assert.rejects(applyProjectUpdate({ runtime: expired.runtime, manifest: planned.manifest, plan: planned.plan, checkpoint, authorization: authority.authorization }), /PROJECT_CHECKPOINT_EXPIRED/);
    assert.deepEqual(await readdir(expired.roots.state), []);
  } finally { await expired.cleanup(); }

  const divergent = await createProjectHarness();
  try {
    const planned = await divergent.plan();
    const authority = divergent.authorities(planned);
    const checkpoint = { ...authority.checkpoint, bindings: { ...authority.checkpoint.bindings, plan_sha256: '0'.repeat(64) } };
    await assert.rejects(applyProjectUpdate({ runtime: divergent.runtime, manifest: planned.manifest, plan: planned.plan, checkpoint, authorization: authority.authorization }), /PROJECT_CHECKPOINT_PLAN_SHA256_DIVERGED/);
    assert.deepEqual(await readdir(divergent.roots.state), []);
  } finally { await divergent.cleanup(); }
});

test('profile divergence between plan and apply blocks before write and preserves user content', async () => {
  const value = await createProjectHarness();
  try {
    const planned = await value.plan();
    const divergent = 'version: 1\nuser_change: preserved\n';
    await writeFile(resolve(value.roots.project, '.agentic/application-profile.yaml'), divergent);
    const authority = value.authorities(planned);
    await assert.rejects(applyProjectUpdate({ runtime: value.runtime, manifest: planned.manifest, plan: planned.plan, checkpoint: authority.checkpoint, authorization: authority.authorization }), /PROJECT_PROFILE_DIVERGED/);
    assert.equal(await readFile(resolve(value.roots.project, '.agentic/application-profile.yaml'), 'utf8'), divergent);
    assert.deepEqual(await readdir(value.roots.state), []);
  } finally { await value.cleanup(); }
});

test('authorized synthetic apply writes only field-aware merge with durable project artifacts and verified backup', async () => {
  const value = await createProjectHarness();
  try {
    const planned = await value.plan();
    const { result } = await value.apply(planned);
    assert.equal(result.status, 'COMPLETED');
    assert.equal(result.lock_retained, false);
    assert.equal(result.backup_manifest.verified, true);
    assert.equal(result.backup_manifest.entries.length, 1);
    const profile = YAML.parse(await readFile(resolve(value.roots.project, '.agentic/application-profile.yaml'), 'utf8'));
    assert.deepEqual(profile.user_extension, { owner: 'synthetic-user', preserve: true });
    assert.equal(profile.impact, 'MODERATE');
    const artifacts = await readdir(resolve(value.roots.state, 'operations', value.operationId, 'artifacts'));
    for (const name of ['project-plan.json', 'project-checkpoint.json', 'project-authorization.json', 'project-backup-manifest.json', 'project-journal.json', 'project-receipt.json']) assert.equal(artifacts.includes(name), true, name);
    assert.match(result.receipt.receipt_id, /^project-receipt-/);
    assert.equal(Object.hasOwn(result.receipt, 'global_receipt_id'), false);
  } finally { await value.cleanup(); }
});

test('authorized proposal creates a missing user-owned profile without requiring a predecessor backup', async () => {
  const value = await createProjectHarness({ profile: null });
  try {
    const planned = await value.plan();
    assert.equal(planned.plan.actions[0].action, 'CREATE');
    const { result } = await value.apply(planned);
    assert.equal(result.status, 'COMPLETED');
    assert.deepEqual(result.backup_manifest.entries, []);
    const profile = YAML.parse(await readFile(resolve(value.roots.project, '.agentic/application-profile.yaml'), 'utf8'));
    assert.equal(profile.impact, 'MODERATE');
    assert.deepEqual(profile.controls.contextual, ['project-update-m6']);
  } finally { await value.cleanup(); }
});

test('PARTIAL and UNKNOWN effects forbid retry and retain the exclusive project lock', async () => {
  const cases = [
    ['PARTIAL', async ({ point }) => { if (point === 'after-rename') throw new Error('INJECTED_PARTIAL'); }],
    ['UNKNOWN', async ({ point }) => { if (point === 'before-intent') { const error = new Error('INJECTED_UNKNOWN'); error.unknownLifecycleEffect = true; throw error; } }],
  ];
  for (const [expected, faultInjector] of cases) {
    const value = await createProjectHarness({ faultInjector });
    try {
      const { result } = await value.apply(await value.plan());
      assert.equal(result.status, expected);
      assert.equal(result.retry_authorized, false);
      assert.equal(result.lock_retained, true);
      assert.equal((await readdir(resolve(value.roots.state, 'locks'))).some((name) => name.endsWith('.lock.json')), true);
    } finally { await value.cleanup(); }
  }
});

test('divergent project authorization is blocked before any write', async () => {
  const value = await createProjectHarness();
  try {
    const planned = await value.plan();
    const authority = value.authorities(planned);
    const authorization = { ...authority.authorization, bindings: { ...authority.authorization.bindings, project_root_sha256: 'f'.repeat(64) } };
    await assert.rejects(applyProjectUpdate({ runtime: value.runtime, manifest: planned.manifest, plan: planned.plan, checkpoint: authority.checkpoint, authorization }), /PROJECT_AUTHORIZATION_PROJECT_ROOT_SHA256_DIVERGED/);
    assert.deepEqual(await readdir(value.roots.state), []);
  } finally { await value.cleanup(); }
});
