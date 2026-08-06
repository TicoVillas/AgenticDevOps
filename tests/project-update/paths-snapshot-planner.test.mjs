import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { assertProjectIdentityNamespaces } from '../../tools/lib/project-update/authorization.mjs';
import { assertProjectLogicalPath, assertSyntheticProjectRoots } from '../../tools/lib/project-update/paths.mjs';
import { planProjectUpdate } from '../../tools/lib/project-update/planner.mjs';
import { buildProjectSnapshot, GIT_OPERATIONS_NOT_AUTHORIZED } from '../../tools/lib/project-update/snapshot.mjs';
import { treeDigest } from '../lifecycle/harness.mjs';
import { createProjectHarness } from './harness.mjs';

test('snapshot and proposal-only planner are deterministic, read-only, and expose all Git writes as unauthorized', async () => {
  const value = await createProjectHarness();
  try {
    const beforeProject = await treeDigest(value.roots.project);
    const beforeState = await treeDigest(value.roots.state);
    const first = await value.plan();
    const second = await value.plan();
    assert.deepEqual(first.snapshot, second.snapshot);
    assert.deepEqual(first.plan, second.plan);
    assert.equal(first.plan.decision, 'PROPOSAL');
    assert.deepEqual(first.plan.operations_not_authorized, GIT_OPERATIONS_NOT_AUTHORIZED);
    assert.equal(await treeDigest(value.roots.project), beforeProject);
    assert.equal(await treeDigest(value.roots.state), beforeState);
    assert.equal(value.gitObserverCalls(), 2);
  } finally { await value.cleanup(); }
});

test('Git observation must be explicitly read-only and cannot request a write-capable path', async () => {
  const value = await createProjectHarness({
    gitObservation: { read_only: false, initialized: true, branch: 'synthetic/main', head: 'a'.repeat(40), status: [] },
  });
  try {
    await assert.rejects(value.snapshot(), /READ_ONLY_GIT_OBSERVER_REQUIRED/);
  } finally { await value.cleanup(); }
});

test('field-aware profile merge is visible and preserves unknown user-owned fields', async () => {
  const value = await createProjectHarness();
  try {
    const planned = await value.plan();
    const action = planned.plan.actions[0];
    assert.equal(action.action, 'MERGE_PROPOSAL');
    assert.deepEqual(action.merge_proposal.changed_paths, ['controls.contextual', 'impact']);
    assert.equal(action.merge_proposal.preserved_unknown_paths.includes('user_extension.owner'), true);
    const merged = YAML.parse(action.content_utf8);
    assert.deepEqual(merged.user_extension, { owner: 'synthetic-user', preserve: true });
    assert.equal(merged.impact, 'MODERATE');
  } finally { await value.cleanup(); }
});

test('outside allowlist, traversal, backslash, NUL, and project/global identity collisions are rejected', async () => {
  const value = await createProjectHarness();
  try {
    const snapshot = await value.snapshot();
    for (const path of ['README.md', '.agentic/../escape', '.agentic/a\\b', '.agentic/a\0b']) {
      const manifest = value.manifestFor(snapshot, { files: [{ id: 'bad-path', path, ownership: 'FRAMEWORK_MANAGED', content_utf8: 'x' }] });
      assert.throws(() => planProjectUpdate({ manifest, snapshot, operationId: value.operationId }), /ALLOWLIST|INVALID_PROJECT_PATH/);
    }
    assert.throws(() => assertProjectLogicalPath('/absolute'), /ALLOWLIST/);
    assert.throws(() => assertProjectIdentityNamespaces({ operationId: 'install-global-0001' }), /PROJECT_OPERATION_ID_INVALID/);
    assert.throws(() => assertProjectIdentityNamespaces({ operationId: 'project-receipt-global-0001' }), /PROJECT_OPERATION_ID_INVALID/);
    assert.throws(() => assertProjectIdentityNamespaces({ operationId: value.operationId, checkpointId: value.operationId }), /PROJECT_CHECKPOINT_ID_INVALID/);
    assert.throws(() => assertProjectIdentityNamespaces({ operationId: value.operationId, authorizationId: 'authorization-global-0001' }), /PROJECT_AUTHORIZATION_ID_INVALID/);
    assert.throws(() => assertProjectIdentityNamespaces({ operationId: value.operationId, receiptId: 'receipt-global-0001' }), /PROJECT_RECEIPT_ID_INVALID/);
  } finally { await value.cleanup(); }
});

test('snapshot rejects symlink ancestry and case-fold collisions', async () => {
  const linked = await createProjectHarness({ profile: null });
  try {
    await mkdir(resolve(linked.sandboxRoot, 'outside'));
    await mkdir(resolve(linked.roots.project, '.agentic'));
    await symlink(resolve(linked.sandboxRoot, 'outside'), resolve(linked.roots.project, '.agentic/linked'));
    await assert.rejects(buildProjectSnapshot({ fs: linked.fs, projectRoot: linked.roots.project, gitObserver: linked.runtime.gitObserver }), /PROJECT_SYMLINK_UNEXPECTED/);
  } finally { await linked.cleanup(); }

  const collision = await createProjectHarness({ profile: null });
  try {
    await mkdir(resolve(collision.roots.project, '.agentic'));
    await writeFile(resolve(collision.roots.project, '.agentic/Rules.md'), 'one');
    await writeFile(resolve(collision.roots.project, '.agentic/rules.md'), 'two');
    await assert.rejects(collision.snapshot(), /PROJECT_CASE_FOLD_COLLISION/);
  } finally { await collision.cleanup(); }
});

test('project roots must be absolute, realpath-stable, sandbox-owned, and disjoint', async () => {
  const value = await createProjectHarness();
  try {
    const base = {
      fs: value.fs,
      projectRoot: value.roots.project,
      stateRoot: value.roots.state,
      stagingRoot: value.roots.staging,
      globalRoot: value.roots.global,
      sourceRoot: value.roots.source,
      sandboxRoot: value.sandboxRoot,
      prohibitedRoots: [],
    };
    await assert.rejects(assertSyntheticProjectRoots({ ...base, projectRoot: 'relative/project' }), /DESTINATION_ROOT_REQUIRED/);
    await assert.rejects(assertSyntheticProjectRoots({ ...base, projectRoot: value.roots.state }), /LIFECYCLE_ROOTS_MUST_BE_DISJOINT/);
    const linkedRoot = resolve(value.sandboxRoot, 'linked-project');
    await symlink(value.roots.project, linkedRoot);
    await assert.rejects(assertSyntheticProjectRoots({ ...base, projectRoot: linkedRoot }), /REALPATH_DIVERGED|TYPE_UNSAFE/);
  } finally { await value.cleanup(); }
});
