import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { createNodeFilesystemAdapter } from '../../adapters/lifecycle/node-filesystem.mjs';
import { canonicalSha256 } from '../../tools/lib/canonical-json.mjs';
import { createProjectAuthorization, createProjectCheckpoint, projectBindings } from '../../tools/lib/project-update/authorization.mjs';
import { applyProjectUpdate, createSyntheticProjectRuntime } from '../../tools/lib/project-update/engine.mjs';
import { planProjectUpdate } from '../../tools/lib/project-update/planner.mjs';
import { buildProjectSnapshot, projectSnapshotSha256 } from '../../tools/lib/project-update/snapshot.mjs';

export const clock = () => new Date('2026-08-05T12:00:00.000Z');
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export const currentProfile = Object.freeze({
  version: 1,
  exposure: 'LOCAL_ISOLATED',
  impact: 'LOW',
  context: { environments: ['synthetic'], identities: [], data_classes: [], integrations: [], operational_dependencies: [] },
  controls: { baseline: ['validate-boundaries'], contextual: [] },
  assurance_recommendation: 'LIGHT',
  rationale: ['Synthetic fixture.'],
  source_evidence: ['synthetic-state'],
  user_extension: { owner: 'synthetic-user', preserve: true },
});

export const desiredProfileFields = Object.freeze({
  impact: 'MODERATE',
  controls: { contextual: ['project-update-m6'] },
});

export async function createProjectHarness({ profile = currentProfile, desiredFields = desiredProfileFields, faultInjector = async () => {}, gitObservation = null } = {}) {
  const sandboxRoot = await mkdtemp(resolve(tmpdir(), 'agentic-m6-project-'));
  const roots = Object.fromEntries(['project', 'state', 'staging', 'global', 'source'].map((name) => [name, resolve(sandboxRoot, name)]));
  await Promise.all(Object.values(roots).map((path) => mkdir(path, { recursive: true, mode: 0o700 })));
  if (profile !== null) {
    await mkdir(resolve(roots.project, '.agentic'), { mode: 0o700 });
    await writeFile(resolve(roots.project, '.agentic/application-profile.yaml'), YAML.stringify(profile, { lineWidth: 0, sortMapEntries: true }));
  }
  const globalFixtureBytes = await readFile(resolve(import.meta.dirname, '../fixtures/migrations/receipt.legacy.json'));
  const globalReceiptPath = resolve(roots.global, 'installation-receipt.json');
  await writeFile(globalReceiptPath, globalFixtureBytes);
  let gitObserverCalls = 0;
  const observation = gitObservation ?? { read_only: true, initialized: true, branch: 'synthetic/main', head: 'a'.repeat(40), status: [' M .agentic/application-profile.yaml'] };
  const gitObserver = async ({ projectRoot }) => {
    gitObserverCalls += 1;
    if (projectRoot !== roots.project) throw new Error('GIT_OBSERVER_ROOT_DIVERGED');
    return structuredClone(observation);
  };
  const fs = Object.freeze({ ...createNodeFilesystemAdapter(), realpath });
  const runtime = await createSyntheticProjectRuntime({
    fs,
    projectRoot: roots.project,
    stateRoot: roots.state,
    stagingRoot: roots.staging,
    globalRoot: roots.global,
    sourceRoot: roots.source,
    sandboxRoot,
    prohibitedRoots: [resolve(sandboxRoot, 'prohibited-real-project')],
    gitObserver,
    clock,
    sessionId: 'synthetic-project-session-0001',
    processId: 6001,
    isProcessActive: (candidate) => candidate === 6001,
    faultInjector,
  });
  const operationId = 'project-update-synthetic-0001';

  async function snapshot() {
    return buildProjectSnapshot({ fs, projectRoot: roots.project, gitObserver });
  }

  function manifestFor(snapshotValue, { files = null } = {}) {
    return {
      schema_version: 1,
      manifest_id: 'project-update-synthetic-manifest',
      project_root: roots.project,
      snapshot_sha256: projectSnapshotSha256(snapshotValue),
      source_release_sha256: 'b'.repeat(64),
      allowed_prefixes: ['.agentic/'],
      files: files ?? [{ id: 'application-profile', path: '.agentic/application-profile.yaml', ownership: 'USER_OWNED', content_utf8: YAML.stringify(desiredFields, { lineWidth: 0, sortMapEntries: true }) }],
      migrations: [{ id: 'project-profile-v1-to-v2', version: 2, preconditions: ['profile version is 1'], reversible: true }],
    };
  }

  async function plan(options = {}) {
    const snapshotValue = await snapshot();
    const manifest = manifestFor(snapshotValue, options);
    return { snapshot: snapshotValue, manifest, plan: planProjectUpdate({ manifest, snapshot: snapshotValue, operationId }) };
  }

  function authorities(planned, { checkpointExpiresAt = '2026-08-05T13:00:00.000Z', authorizationExpiresAt = '2026-08-05T13:00:00.000Z' } = {}) {
    const bindings = projectBindings({ plan: planned.plan, snapshotSha256: planned.plan.project_snapshot_sha256, projectRootSha256: planned.plan.project_root_sha256 });
    const checkpoint = createProjectCheckpoint({ checkpointId: 'project-checkpoint-synthetic-0001', operationId, bindings, clock, expiresAt: checkpointExpiresAt });
    const authorization = createProjectAuthorization({ authorizationId: 'project-authorization-synthetic-0001', operationId, operationClass: 'PROJECT_UPDATE', checkpointId: checkpoint.checkpoint_id, bindings, operations: ['APPLY'], clock, expiresAt: authorizationExpiresAt });
    return { checkpoint, authorization, bindings };
  }

  async function apply(planned, authorityOptions = {}) {
    const authority = authorities(planned, authorityOptions);
    const result = await applyProjectUpdate({ runtime, manifest: planned.manifest, plan: planned.plan, checkpoint: authority.checkpoint, authorization: authority.authorization });
    return { result, authority };
  }

  return Object.freeze({
    sandboxRoot,
    roots,
    fs,
    runtime,
    operationId,
    globalReceiptPath,
    globalFixtureBytes,
    snapshot,
    manifestFor,
    plan,
    authorities,
    apply,
    gitObserverCalls: () => gitObserverCalls,
    cleanup: () => rm(sandboxRoot, { recursive: true, force: true }),
  });
}

export function rollbackAuthorization({ harness, plan, snapshot, backupManifest }) {
  const rollbackOperationId = 'project-rollback-synthetic-0001';
  const bindings = projectBindings({ plan, snapshotSha256: projectSnapshotSha256(snapshot), projectRootSha256: plan.project_root_sha256, backupManifestSha256: canonicalSha256(backupManifest) });
  const authorization = createProjectAuthorization({ authorizationId: 'project-authorization-rollback-0001', operationId: rollbackOperationId, operationClass: 'PROJECT_ROLLBACK', checkpointId: null, bindings, operations: ['ROLLBACK'], clock, expiresAt: '2026-08-05T13:00:00.000Z' });
  return { rollbackOperationId, authorization };
}
