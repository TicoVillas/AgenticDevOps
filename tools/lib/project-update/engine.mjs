import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { canonicalSha256 } from '../canonical-json.mjs';
import { atomicReplaceFile } from '../lifecycle/atomic-writer.mjs';
import { containedLifecyclePath } from '../lifecycle/paths.mjs';
import {
  acquireOperationLock,
  classifyFaultBoundary,
  createDurableJournalStore,
  initializeOperationState,
  releaseOperationLock,
  writeDurableArtifact,
} from '../lifecycle/state-store.mjs';
import {
  assertProjectIdentityNamespaces,
  projectBindings,
  projectPlanSha256,
  validateProjectAuthorization,
  validateProjectCheckpoint,
} from './authorization.mjs';
import { assertSyntheticProjectRoots, containedProjectPath } from './paths.mjs';
import { buildProjectSnapshot, projectSnapshotSha256 } from './snapshot.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function fail(code, detail = null) {
  const error = new Error(code);
  error.code = code;
  if (detail !== null) error.detail = detail;
  throw error;
}

async function inject(faultInjector, point, context = {}) {
  try { await faultInjector({ point, ...context }); }
  catch (error) { error.lifecyclePoint ??= point; throw error; }
}

async function observeFile(fs, projectRoot, action) {
  const path = containedProjectPath(projectRoot, action.path);
  try {
    const metadata = await fs.lstat(path);
    if (metadata.isSymbolicLink() || !metadata.isFile()) fail('PROJECT_DESTINATION_TYPE_UNSAFE');
    const bytes = await fs.readFile(path);
    return { present: true, bytes, sha256: sha256(bytes) };
  } catch (error) {
    if (error.code === 'ENOENT') return { present: false, bytes: null, sha256: null };
    throw error;
  }
}

async function createVerifiedBackups({ fs, operationRoot, projectRoot, plan }) {
  const backupRoot = containedLifecyclePath(operationRoot, 'backups');
  await fs.mkdir(backupRoot, { mode: 0o700 });
  const entries = [];
  for (const action of plan.actions) {
    if (action.before_sha256 === null) continue;
    const observed = await observeFile(fs, projectRoot, action);
    if (!observed.present || observed.sha256 !== action.before_sha256) fail('PROJECT_PRESTATE_DIVERGED');
    const backupPath = `backups/${String(action.sequence).padStart(6, '0')}-${basename(action.path)}.backup`;
    const absolute = containedLifecyclePath(operationRoot, backupPath);
    await fs.writeFile(absolute, observed.bytes, { flag: 'wx', mode: 0o600 });
    await fs.syncFile(absolute);
    await fs.syncDirectory(fs.dirname(absolute));
    const verifiedBytes = await fs.readFile(absolute);
    if (sha256(verifiedBytes) !== action.before_sha256) fail('PROJECT_BACKUP_UNVERIFIED');
    entries.push({ path: action.path, backup_path: backupPath, sha256: action.before_sha256, size: verifiedBytes.length, verified: true });
  }
  return Object.freeze({
    schema_version: 1,
    operation_id: plan.operation_id,
    project_root_sha256: plan.project_root_sha256,
    plan_sha256: projectPlanSha256(plan),
    entries,
    verified: true,
  });
}

function initialJournal(plan, timestamp, operationId = plan.operation_id) {
  return {
    schema_version: 1,
    operation_id: operationId,
    plan_sha256: projectPlanSha256(plan),
    project_snapshot_sha256: plan.project_snapshot_sha256,
    status: 'PLANNED',
    entries: plan.actions.map((action) => ({
      sequence: action.sequence,
      item_id: action.item_id,
      path: action.path,
      action: action.action === 'MERGE_PROPOSAL' ? 'MERGE' : action.action,
      state: 'PLANNED',
      intent_recorded_at: timestamp,
      intent_fsynced: false,
      before_sha256: action.before_sha256,
      after_sha256: action.after_sha256,
    })),
  };
}

function receiptId(operationId) {
  return `project-receipt-${operationId.slice('project-'.length)}`;
}

async function writeFinalProjectReceipt({ fs, operationRoot, plan, journal, snapshotAfter, checkpointId, authorizationId, status = 'COMPLETED' }) {
  const id = receiptId(journal.operation_id);
  assertProjectIdentityNamespaces({ operationId: journal.operation_id, checkpointId, authorizationId, receiptId: id });
  const receipt = {
    schema_version: 1,
    receipt_id: id,
    operation_id: journal.operation_id,
    manifest_sha256: plan.manifest_sha256,
    plan_sha256: projectPlanSha256(plan),
    journal_sha256: canonicalSha256(journal),
    project_root_sha256: plan.project_root_sha256,
    project_snapshot_before_sha256: plan.project_snapshot_sha256,
    project_snapshot_after_sha256: projectSnapshotSha256(snapshotAfter),
    checkpoint_id: checkpointId,
    authorization_id: authorizationId,
    status,
    actions: journal.entries.map((entry) => ({ sequence: entry.sequence, path: entry.path, result: entry.state === 'VERIFIED' ? 'VERIFIED' : entry.state })),
  };
  await writeDurableArtifact({ fs, operationRoot, name: 'project-receipt.json', document: receipt });
  return Object.freeze(receipt);
}

export async function createSyntheticProjectRuntime({ fs, projectRoot, stateRoot, stagingRoot, globalRoot, sourceRoot, sandboxRoot, prohibitedRoots = [], gitObserver, clock = () => new Date(), sessionId = 'synthetic-project-session', processId = 1, isProcessActive = () => true, faultInjector = async () => {} }) {
  const roots = await assertSyntheticProjectRoots({ fs, projectRoot, stateRoot, stagingRoot, globalRoot, sourceRoot, sandboxRoot, prohibitedRoots });
  if (typeof gitObserver !== 'function') fail('READ_ONLY_GIT_OBSERVER_REQUIRED');
  return Object.freeze({ fs, roots, gitObserver, clock, sessionId, processId, isProcessActive, faultInjector });
}

export async function applyProjectUpdate({ runtime, manifest, plan, checkpoint, authorization }) {
  const { fs, roots, clock, gitObserver, faultInjector } = runtime;
  if (plan.decision === 'NO_CHANGE') return Object.freeze({ status: 'NO_CHANGE', mutations: 0, state_written: false });
  if (plan.decision !== 'PROPOSAL' || !plan.checkpoint_required || !plan.actions.length) fail('PROJECT_PLAN_NOT_APPLICABLE');
  if (canonicalSha256(manifest) !== plan.manifest_sha256) fail('PROJECT_MANIFEST_DIVERGED');
  const currentSnapshot = await buildProjectSnapshot({ fs, projectRoot: roots.projectRoot, gitObserver });
  if (currentSnapshot.profile.sha256 !== plan.profile_before_sha256) fail('PROJECT_PROFILE_DIVERGED');
  if (projectSnapshotSha256(currentSnapshot) !== plan.project_snapshot_sha256) fail('PROJECT_SNAPSHOT_DIVERGED');
  if (currentSnapshot.project_root_sha256 !== plan.project_root_sha256) fail('PROJECT_ROOT_DIVERGED');
  const bindings = projectBindings({ plan, snapshotSha256: plan.project_snapshot_sha256, projectRootSha256: plan.project_root_sha256 });
  const checkpointResult = validateProjectCheckpoint(checkpoint, { operationId: plan.operation_id, bindings }, { now: clock() });
  const authorizationResult = validateProjectAuthorization(authorization, {
    operationId: plan.operation_id,
    operationClass: 'PROJECT_UPDATE',
    requiredOperation: 'APPLY',
    checkpointId: checkpointResult.checkpoint_id,
    bindings,
  }, { now: clock() });

  let lockHandle;
  let operationRoot;
  let journal;
  let journalStore;
  let currentAction = null;
  try {
    lockHandle = await acquireOperationLock({
      fs,
      stateRoot: roots.stateRoot,
      operationId: plan.operation_id,
      operationClass: 'PROJECT_UPDATE',
      destinationRootId: `PROJECT_ROOT:${plan.project_root_sha256}`,
      sessionId: runtime.sessionId,
      processId: runtime.processId,
      clock,
      isProcessActive: runtime.isProcessActive,
    });
    ({ operationRoot } = await initializeOperationState({ fs, stateRoot: roots.stateRoot, operationId: plan.operation_id }));
    await writeDurableArtifact({ fs, operationRoot, name: 'project-plan.json', document: plan });
    await writeDurableArtifact({ fs, operationRoot, name: 'project-checkpoint.json', document: checkpoint });
    await writeDurableArtifact({ fs, operationRoot, name: 'project-authorization.json', document: authorization });
    const backupManifest = await createVerifiedBackups({ fs, operationRoot, projectRoot: roots.projectRoot, plan });
    await writeDurableArtifact({ fs, operationRoot, name: 'project-backup-manifest.json', document: backupManifest });
    journal = initialJournal(plan, clock().toISOString());
    journalStore = createDurableJournalStore({ fs, operationRoot });
    for (const action of plan.actions) {
      currentAction = action;
      const before = await observeFile(fs, roots.projectRoot, action);
      if ((action.before_sha256 === null && before.present) || (action.before_sha256 !== null && before.sha256 !== action.before_sha256)) fail('PROJECT_PRESTATE_DIVERGED');
      await inject(faultInjector, 'before-intent', { action });
      const intent = await journalStore.recordIntent(journal, action);
      journal = intent.journal;
      journal.status = 'APPLYING';
      const entry = journal.entries.find((candidate) => candidate.item_id === action.item_id);
      entry.state = 'APPLYING';
      const bytes = Buffer.from(action.content_utf8, 'utf8');
      await atomicReplaceFile({ fs, root: roots.projectRoot, relativePath: action.path, bytes, expectedSha256: action.after_sha256, operationId: plan.operation_id, sequence: action.sequence, faultInjector });
      entry.state = 'VERIFIED';
      await journalStore.append(journal, { type: 'PROJECT_ACTION_VERIFIED', item_id: action.item_id });
    }
    journal.status = 'VERIFIED';
    await journalStore.append(journal, { type: 'PROJECT_UPDATE_VERIFIED' });
    await writeDurableArtifact({ fs, operationRoot, name: 'project-journal.json', document: journal });
    await inject(faultInjector, 'before-receipt');
    const snapshotAfter = await buildProjectSnapshot({ fs, projectRoot: roots.projectRoot, gitObserver });
    const receipt = await writeFinalProjectReceipt({ fs, operationRoot, plan, journal, snapshotAfter, checkpointId: checkpoint.checkpoint_id, authorizationId: authorization.authorization_id });
    await inject(faultInjector, 'after-receipt');
    await releaseOperationLock({ fs, lockHandle, operationRoot, outcome: 'COMPLETED', reconciliationStatus: 'NOT_REQUIRED' });
    return Object.freeze({ status: 'COMPLETED', receipt, backup_manifest: backupManifest, journal, lock_retained: false, retry_authorized: false });
  } catch (error) {
    if (!lockHandle) throw error;
    const outcome = classifyFaultBoundary(error.lifecyclePoint, { unknown: error.unknownLifecycleEffect === true });
    if (journal && ['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN'].includes(outcome)) {
      journal.status = outcome;
      const entry = currentAction ? journal.entries.find((candidate) => candidate.item_id === currentAction.item_id) : null;
      if (entry) entry.state = outcome;
      try {
        if (journalStore) await journalStore.append(journal, { type: 'PROJECT_UPDATE_UNCERTAIN', failure_point: error.lifecyclePoint ?? null });
        if (operationRoot) await writeDurableArtifact({ fs, operationRoot, name: 'project-journal.json', document: journal });
      } catch { /* preserve original uncertainty and lock */ }
      return Object.freeze({ status: outcome, journal, lock_retained: true, retry_authorized: false, reason_code: 'PROJECT_UNCERTAIN_RECONCILIATION_REQUIRED' });
    }
    if (operationRoot) await releaseOperationLock({ fs, lockHandle, operationRoot, outcome: 'FAILED_KNOWN', reconciliationStatus: 'NOT_REQUIRED' });
    throw error;
  }
}

async function verifyBackupManifest({ fs, stateRoot, plan, backupManifest }) {
  if (!backupManifest || backupManifest.verified !== true || backupManifest.operation_id !== plan.operation_id || backupManifest.plan_sha256 !== projectPlanSha256(plan) || backupManifest.project_root_sha256 !== plan.project_root_sha256) fail('PROJECT_BACKUP_MANIFEST_DIVERGED');
  if (backupManifest.entries.length !== plan.actions.length) fail('PROJECT_ROLLBACK_REQUIRES_VERIFIED_BACKUP');
  const originalOperationRoot = containedLifecyclePath(containedLifecyclePath(stateRoot, 'operations'), plan.operation_id);
  const verified = [];
  for (const entry of backupManifest.entries) {
    if (entry.verified !== true) fail('PROJECT_BACKUP_UNVERIFIED');
    const bytes = await fs.readFile(containedLifecyclePath(originalOperationRoot, entry.backup_path));
    if (sha256(bytes) !== entry.sha256 || bytes.length !== entry.size) fail('PROJECT_BACKUP_UNVERIFIED');
    verified.push({ entry, bytes });
  }
  return verified;
}

export async function rollbackProjectUpdate({ runtime, plan, backupManifest, rollbackOperationId, authorization }) {
  const { fs, roots, clock, gitObserver, faultInjector } = runtime;
  assertProjectIdentityNamespaces({ operationId: rollbackOperationId, authorizationId: authorization?.authorization_id });
  const verifiedBackups = await verifyBackupManifest({ fs, stateRoot: roots.stateRoot, plan, backupManifest });
  const currentSnapshot = await buildProjectSnapshot({ fs, projectRoot: roots.projectRoot, gitObserver });
  const backupManifestSha256 = canonicalSha256(backupManifest);
  const bindings = projectBindings({ plan, snapshotSha256: projectSnapshotSha256(currentSnapshot), projectRootSha256: plan.project_root_sha256, backupManifestSha256 });
  const authorizationResult = validateProjectAuthorization(authorization, {
    operationId: rollbackOperationId,
    operationClass: 'PROJECT_ROLLBACK',
    requiredOperation: 'ROLLBACK',
    checkpointId: null,
    bindings,
  }, { now: clock() });
  let lockHandle;
  let operationRoot;
  try {
    lockHandle = await acquireOperationLock({ fs, stateRoot: roots.stateRoot, operationId: rollbackOperationId, operationClass: 'PROJECT_ROLLBACK', destinationRootId: `PROJECT_ROOT:${plan.project_root_sha256}`, sessionId: runtime.sessionId, processId: runtime.processId, clock, isProcessActive: runtime.isProcessActive });
    ({ operationRoot } = await initializeOperationState({ fs, stateRoot: roots.stateRoot, operationId: rollbackOperationId }));
    await writeDurableArtifact({ fs, operationRoot, name: 'project-rollback-authorization.json', document: authorization });
    await writeDurableArtifact({ fs, operationRoot, name: 'project-backup-manifest.json', document: backupManifest });
    const rollbackPlan = { ...plan, operation_id: rollbackOperationId, project_snapshot_sha256: projectSnapshotSha256(currentSnapshot) };
    let journal = initialJournal(rollbackPlan, clock().toISOString(), rollbackOperationId);
    const store = createDurableJournalStore({ fs, operationRoot });
    for (const { entry: backup, bytes } of [...verifiedBackups].reverse()) {
      const action = plan.actions.find((candidate) => candidate.path === backup.path);
      const current = await observeFile(fs, roots.projectRoot, action);
      if (!current.present || current.sha256 !== action.after_sha256) fail('PROJECT_ROLLBACK_PRESTATE_DIVERGED');
      const journalEntry = journal.entries.find((candidate) => candidate.path === action.path);
      const intent = await store.recordIntent(journal, journalEntry);
      journal = intent.journal;
      journal.status = 'APPLYING';
      journal.entries.find((candidate) => candidate.path === action.path).state = 'APPLYING';
      await atomicReplaceFile({ fs, root: roots.projectRoot, relativePath: action.path, bytes, expectedSha256: backup.sha256, operationId: rollbackOperationId, sequence: action.sequence, faultInjector });
      journal.entries.find((candidate) => candidate.path === action.path).state = 'VERIFIED';
      await store.append(journal, { type: 'PROJECT_ROLLBACK_ACTION_VERIFIED', item_id: action.item_id });
    }
    journal.status = 'VERIFIED';
    await store.append(journal, { type: 'PROJECT_ROLLBACK_VERIFIED' });
    await writeDurableArtifact({ fs, operationRoot, name: 'project-journal.json', document: journal });
    const snapshotAfter = await buildProjectSnapshot({ fs, projectRoot: roots.projectRoot, gitObserver });
    const receipt = await writeFinalProjectReceipt({ fs, operationRoot, plan, journal, snapshotAfter, checkpointId: null, authorizationId: authorizationResult.authorization_id, status: 'ROLLED_BACK' });
    await releaseOperationLock({ fs, lockHandle, operationRoot, outcome: 'COMPLETED', reconciliationStatus: 'NOT_REQUIRED' });
    return Object.freeze({ status: 'ROLLED_BACK', receipt, journal, lock_retained: false });
  } catch (error) {
    if (!lockHandle) throw error;
    const outcome = classifyFaultBoundary(error.lifecyclePoint, { unknown: error.unknownLifecycleEffect === true });
    if (['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN'].includes(outcome)) return Object.freeze({ status: outcome, lock_retained: true, retry_authorized: false });
    if (operationRoot) await releaseOperationLock({ fs, lockHandle, operationRoot, outcome: 'FAILED_KNOWN', reconciliationStatus: 'NOT_REQUIRED' });
    throw error;
  }
}
