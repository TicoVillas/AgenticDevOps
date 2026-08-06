import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { canonicalSha256 } from '../canonical-json.mjs';
import { buildDistributionSnapshot, planDistribution, validateDistributionManifest } from '../distribution.mjs';
import {
  applySyntheticPlan,
  applySyntheticSelfUpdate,
  buildInstallationReceipt,
  createInstallationJournal,
  createVerifiedBackup,
  deriveSyntheticRollbackPlan,
  rollbackSyntheticPlan,
} from '../installation.mjs';
import { structuredResult } from './cli.mjs';
import { assertFreshContinuationAuthority, operationScopeBinding, validateAuthorizationEnvelope } from './authorization.mjs';
import { assertSyntheticLifecycleRoots, containedLifecyclePath, isWithin } from './paths.mjs';
import {
  acquireOperationLock,
  createDurableJournalStore,
  initializeOperationState,
  observeOperationLock,
  releaseOperationLock,
  writeDurableArtifact,
} from './state-store.mjs';
import { applyUninstall, planUninstall } from './uninstall.mjs';
import { assertNoBlindRetry, reconcileUncertainReadOnly } from './reconcile.mjs';
import { buildLifecycleEventLogFromJournal } from './event-evidence.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

async function fault(faultInjector, point, detail = {}) {
  try {
    await faultInjector({ point, ...detail });
  } catch (error) {
    error.lifecyclePoint ??= point;
    throw error;
  }
}

async function readJson(fs, path) {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) fail('ARTIFACT_JSON_INVALID');
    throw error;
  }
}

async function observeTree(fs, root) {
  const rootMetadata = await fs.lstat(root);
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) fail('ROOT_UNSAFE');
  const entries = [];
  async function visit(directory, prefix = '') {
    const children = await fs.readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      const logical = prefix ? `${prefix}/${child.name}` : child.name;
      const absolute = containedLifecyclePath(root, logical);
      const metadata = await fs.lstat(absolute);
      if (metadata.isSymbolicLink()) fail('SYMLINK_UNEXPECTED');
      if (metadata.isDirectory()) {
        entries.push({ path: logical, type: 'DIRECTORY' });
        await visit(absolute, logical);
      } else if (metadata.isFile()) {
        const bytes = await fs.readFile(absolute);
        entries.push({ path: logical, type: 'REGULAR_FILE', sha256: digest(bytes), size: bytes.length });
      } else fail('TYPE_CONFLICT');
    }
  }
  await visit(root);
  return Object.freeze({ entries });
}

async function loadSourceInputs({ fs, sourceRoot, validateManifest = true }) {
  const manifestPath = containedLifecyclePath(sourceRoot, 'adapters/kiro/distribution-manifest.yaml');
  const lockPath = containedLifecyclePath(sourceRoot, 'framework.lock');
  const packagePath = containedLifecyclePath(sourceRoot, 'package.json');
  const [manifestBytes, lockBytes, packageBytes] = await Promise.all([
    fs.readFile(manifestPath),
    fs.readFile(lockPath),
    fs.readFile(packagePath),
  ]);
  const manifest = YAML.parse(manifestBytes.toString('utf8'));
  const lock = JSON.parse(lockBytes.toString('utf8'));
  const packageManifest = JSON.parse(packageBytes.toString('utf8'));
  if (validateManifest) {
    const validation = await validateDistributionManifest({
      root: sourceRoot,
      manifest,
      lock,
      packageManifest,
      schemaRoot: sourceRoot,
      checkFilesystem: true,
      checkGenerated: true,
    });
    if (!validation.ok) {
      const error = new Error('DISTRIBUTION_VALIDATION_FAILED');
      error.code = 'DISTRIBUTION_VALIDATION_FAILED';
      error.detail = validation.errors;
      throw error;
    }
  }
  return Object.freeze({
    manifest,
    lock,
    packageManifest,
    hashes: Object.freeze({
      manifest_sha256: digest(manifestBytes),
      lock_sha256: digest(lockBytes),
      package_sha256: digest(packageBytes),
      source_sha256: canonicalSha256(manifest.source_catalog),
    }),
  });
}

function operationClass(command) {
  return command.replaceAll('-', '_').toUpperCase();
}

function operationIdFor(options, command, snapshotSha256) {
  return options.operation_id ?? `${command}-${snapshotSha256.slice(0, 20)}`;
}

async function buildPlanContext({ command, options, roots, runtime }) {
  const source = await loadSourceInputs({ fs: runtime.fs, sourceRoot: roots.sourceRoot, validateManifest: runtime.validateManifest !== false });
  const stateSnapshot = await observeTree(runtime.fs, roots.stateRoot);
  const snapshot = await buildDistributionSnapshot({
    sourceRoot: roots.sourceRoot,
    destinationRoot: roots.destinationRoot,
    manifest: source.manifest,
    priorReceipt: runtime.priorReceipt ?? null,
    knownManagedHashes: runtime.knownManagedHashes ?? {},
    platform: runtime.fs.platform,
  });
  const plan = planDistribution({
    manifest: source.manifest,
    snapshot,
    authorization: { current: true, snapshot_sha256: snapshot.snapshot_sha256 },
    manifest_sha256: source.hashes.manifest_sha256,
    lock_sha256: source.hashes.lock_sha256,
    package_sha256: source.hashes.package_sha256,
  });
  const id = operationIdFor(options, command, snapshot.snapshot_sha256);
  const scope = operationScopeBinding({
    destinationRootId: 'SYNTHETIC_KIRO_ROOT',
    destinationSnapshot: snapshot,
    stateSnapshot,
  });
  const bindings = Object.freeze({
    plan_sha256: canonicalSha256(plan),
    snapshot_sha256: snapshot.snapshot_sha256,
    source_sha256: source.hashes.source_sha256,
    manifest_sha256: source.hashes.manifest_sha256,
    lock_sha256: source.hashes.lock_sha256,
  });
  return Object.freeze({ source, stateSnapshot, snapshot, plan, operationId: id, scope, bindings });
}

function authorizationExpectation(planContext, command, requiredOperation = 'APPLY') {
  return Object.freeze({
    operation_id: planContext.operationId,
    operation_class: operationClass(command),
    required_operation: requiredOperation,
    scope: planContext.scope,
    bindings: planContext.bindings,
  });
}

async function readAuthorization({ fs, path, roots }) {
  if (!path || !isWithin(roots.sandboxRoot, path)) fail('AUTHORIZATION_PATH_OUTSIDE_SYNTHETIC_SANDBOX');
  return readJson(fs, path);
}

function planResult(command, planContext, authorizationCommand = command) {
  const blocked = planContext.plan.decision === 'BLOCKED';
  return structuredResult({
    command,
    ok: !blocked,
    status: blocked ? 'BLOCKED' : 'READY',
    reason: blocked ? 'PLAN_BLOCKED' : null,
    operationId: planContext.operationId,
    result: {
      plan: planContext.plan,
      plan_sha256: planContext.bindings.plan_sha256,
      snapshot: planContext.snapshot,
      authorization_request: authorizationExpectation(planContext, authorizationCommand),
      mode: 'PLAN',
      operations_not_authorized: ['REAL_GLOBAL_WRITE', 'HOME_ACCESS', 'NETWORK', 'GIT', 'M6_PLUS'],
    },
  });
}

async function durableSequence(fs, operationRoot) {
  const journalRoot = containedLifecyclePath(operationRoot, 'journal');
  const entries = await fs.readdir(journalRoot);
  return entries.filter((name) => /^\d{6}\.json$/.test(name)).length;
}

async function latestJournal(fs, operationRoot) {
  const journalRoot = containedLifecyclePath(operationRoot, 'journal');
  const names = (await fs.readdir(journalRoot)).filter((name) => /^\d{6}\.json$/.test(name)).sort();
  if (names.length === 0) fail('DURABLE_JOURNAL_NOT_FOUND');
  return (await readJson(fs, containedLifecyclePath(journalRoot, names.at(-1)))).journal;
}

async function loadOperationState({ fs, stateRoot, operationId }) {
  const operationRoot = containedLifecyclePath(containedLifecyclePath(stateRoot, 'operations'), operationId);
  const plan = await readJson(fs, containedLifecyclePath(containedLifecyclePath(operationRoot, 'artifacts'), 'plan.json'));
  const journal = await latestJournal(fs, operationRoot);
  let backupManifest = null;
  try {
    backupManifest = YAML.parse(await fs.readFile(containedLifecyclePath(operationRoot, 'backup-manifest.yaml'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return Object.freeze({ operationRoot, plan, journal, backupManifest });
}

function contextFor({ planContext, roots, operationRoot }) {
  return Object.freeze({
    schema_version: 1,
    operation_id: planContext.operationId,
    created_at: new Date(0).toISOString(),
    destinationRoot: roots.destinationRoot,
    backupRoot: roots.stateRoot,
    operationRoot,
    bindings: Object.freeze({
      manifest_sha256: planContext.bindings.manifest_sha256,
      lock_sha256: planContext.bindings.lock_sha256,
      package_sha256: planContext.source.hashes.package_sha256,
      snapshot_sha256: planContext.bindings.snapshot_sha256,
    }),
  });
}

async function executeInstallOrUpdate({ command, options, roots, runtime }) {
  const planned = await buildPlanContext({ command, options, roots, runtime });
  if (!options.apply) return planResult(command, planned);
  const envelope = await readAuthorization({ fs: runtime.fs, path: options.authorization, roots });
  validateAuthorizationEnvelope(envelope, authorizationExpectation(planned, command), { now: runtime.clock() });
  const observedAgain = await buildPlanContext({ command, options, roots, runtime });
  if (observedAgain.bindings.plan_sha256 !== planned.bindings.plan_sha256 || observedAgain.bindings.snapshot_sha256 !== planned.bindings.snapshot_sha256 || canonicalSha256(observedAgain.stateSnapshot) !== canonicalSha256(planned.stateSnapshot)) fail('SNAPSHOT_DIVERGED');
  if (planned.plan.mutable_actions.length === 0) {
    return structuredResult({ command, ok: true, status: 'NO_CHANGE', operationId: planned.operationId, result: { plan_sha256: planned.bindings.plan_sha256, snapshot_sha256: planned.bindings.snapshot_sha256, mutations: 0, state_written: false } });
  }

  let lockHandle = null;
  let operationRoot = null;
  try {
    lockHandle = await acquireOperationLock({
      fs: runtime.fs,
      stateRoot: roots.stateRoot,
      operationId: planned.operationId,
      operationClass: operationClass(command),
      sessionId: runtime.sessionId,
      processId: runtime.processId,
      clock: runtime.clock,
      isProcessActive: runtime.isProcessActive,
    });
    ({ operationRoot } = await initializeOperationState({ fs: runtime.fs, stateRoot: roots.stateRoot, operationId: planned.operationId }));
    await writeDurableArtifact({ fs: runtime.fs, operationRoot, name: 'plan.json', document: planned.plan });
    const context = contextFor({ planContext: planned, roots, operationRoot });
    const backupManifest = await createVerifiedBackup({ context, plan: planned.plan, clock: runtime.clock });
    const journalStore = createDurableJournalStore({ fs: runtime.fs, operationRoot });
    const journal = createInstallationJournal({ context, plan: planned.plan });
    await journalStore.append(journal, { type: 'OPERATION_PLANNED' });
    const applied = await applySyntheticPlan({
      context,
      plan: planned.plan,
      manifest: planned.source.manifest,
      sourceRoot: roots.sourceRoot,
      authorization: { current: true, snapshot_sha256: planned.bindings.snapshot_sha256 },
      backupManifest,
      journal,
      journalStore,
      filesystemAdapter: runtime.fs,
      faultInjector: runtime.faultInjector,
      clock: runtime.clock,
    });
    if (['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN'].includes(applied.status)) {
      const eventLog = buildLifecycleEventLogFromJournal({ operationId: planned.operationId, operationClass: operationClass(command), journal: applied.journal, clock: runtime.clock, limitations: ['Synthetic roots only; no real global installation or Stage B execution.'] });
      await writeDurableArtifact({ fs: runtime.fs, operationRoot, name: 'uncertain-result.json', document: applied });
      await writeDurableArtifact({ fs: runtime.fs, operationRoot, name: 'event-log.json', document: eventLog });
      return structuredResult({ command, ok: false, status: applied.status, reason: applied.status, operationId: planned.operationId, result: { applied, event_log: eventLog, lock_retained: true } });
    }
    if (applied.status === 'NO_EFFECT') {
      const eventLog = buildLifecycleEventLogFromJournal({ operationId: planned.operationId, operationClass: operationClass(command), journal: applied.journal, clock: runtime.clock, limitations: ['Synthetic roots only; fault occurred before durable intent.'] });
      await writeDurableArtifact({ fs: runtime.fs, operationRoot, name: 'event-log.json', document: eventLog });
      await releaseOperationLock({ fs: runtime.fs, lockHandle, operationRoot, outcome: applied.status, reconciliationStatus: 'RECONCILED' });
      return structuredResult({ command, ok: false, status: 'BLOCKED', reason: applied.error_code, operationId: planned.operationId, result: { applied, event_log: eventLog, lock_retained: false } });
    }
    if (applied.status === 'FAILED_KNOWN') {
      const eventLog = buildLifecycleEventLogFromJournal({ operationId: planned.operationId, operationClass: operationClass(command), journal: applied.journal, clock: runtime.clock, limitations: ['Synthetic roots only; operation stopped with known failure.'] });
      await writeDurableArtifact({ fs: runtime.fs, operationRoot, name: 'event-log.json', document: eventLog });
      await releaseOperationLock({ fs: runtime.fs, lockHandle, operationRoot, outcome: applied.status, reconciliationStatus: 'RECONCILED' });
      return structuredResult({ command, ok: false, status: 'BLOCKED', reason: applied.error_code, operationId: planned.operationId, result: { applied, event_log: eventLog, lock_retained: false } });
    }

    const eventLog = buildLifecycleEventLogFromJournal({ operationId: planned.operationId, operationClass: operationClass(command), journal: applied.journal, clock: runtime.clock, limitations: ['Synthetic roots only; real Stage B remains not executed.'] });
    await writeDurableArtifact({ fs: runtime.fs, operationRoot, name: 'event-log.json', document: eventLog });
    let receipt;
    try {
      await fault(runtime.faultInjector, 'before-receipt', { operation_id: planned.operationId });
      receipt = buildInstallationReceipt({ context, plan: planned.plan, journal: applied.journal, preRestart: true });
      await writeDurableArtifact({ fs: runtime.fs, operationRoot, name: 'receipt.json', document: receipt });
      await fault(runtime.faultInjector, 'after-receipt', { operation_id: planned.operationId });
    } catch (error) {
      const status = error?.unknown === true ? 'UNKNOWN' : 'PARTIAL';
      const uncertainJournal = structuredClone(applied.journal);
      uncertainJournal.status = status;
      uncertainJournal.reconciliation = { status: 'UNRECONCILED', observed_at: runtime.clock().toISOString() };
      await journalStore.append(uncertainJournal, { type: 'RECEIPT_FAILURE', failure_point: error?.lifecyclePoint ?? null });
      return structuredResult({ command, ok: false, status, reason: status, operationId: planned.operationId, result: { failure_point: error?.lifecyclePoint ?? null, lock_retained: true }, errors: [error] });
    }

    let selfUpdate = null;
    if (applied.pending_self_update) {
      selfUpdate = await applySyntheticSelfUpdate({
        context,
        plan: planned.plan,
        manifest: planned.source.manifest,
        sourceRoot: roots.sourceRoot,
        authorization: { current: true, snapshot_sha256: planned.bindings.snapshot_sha256 },
        backupManifest,
        journal: applied.journal,
        journalStore,
        filesystemAdapter: runtime.fs,
        faultInjector: runtime.faultInjector,
        clock: runtime.clock,
      });
      if (['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN'].includes(selfUpdate.status)) {
        return structuredResult({ command, ok: false, status: selfUpdate.status, reason: selfUpdate.status, operationId: planned.operationId, result: { applied, self_update: selfUpdate, lock_retained: true } });
      }
    }
    await releaseOperationLock({ fs: runtime.fs, lockHandle, operationRoot, outcome: selfUpdate?.status ?? applied.status, reconciliationStatus: 'RECONCILED' });
    return structuredResult({
      command,
      ok: true,
      status: 'COMPLETED',
      operationId: planned.operationId,
      result: { applied, receipt, event_log: eventLog, self_update: selfUpdate, hard_stop: selfUpdate?.hard_stop === true, stage_b: 'NOT_EXECUTED', lock_retained: false },
    });
  } catch (error) {
    if (lockHandle && operationRoot && ['after-write', 'after-rename', 'before-receipt', 'after-receipt'].includes(error.lifecyclePoint)) {
      return structuredResult({ command, ok: false, status: 'PARTIAL', reason: 'PARTIAL', operationId: planned.operationId, result: { failure_point: error.lifecyclePoint, lock_retained: true }, errors: [error] });
    }
    throw error;
  }
}

async function executeReconcile({ command, options, roots, runtime }) {
  if (!options.operation_id) fail('OPERATION_ID_REQUIRED');
  const state = await loadOperationState({ fs: runtime.fs, stateRoot: roots.stateRoot, operationId: options.operation_id });
  const result = await reconcileUncertainReadOnly({ fs: runtime.fs, destinationRoot: roots.destinationRoot, plan: state.plan, journal: state.journal, clock: runtime.clock });
  return structuredResult({ command, ok: result.decision !== 'BLOCKED', status: result.decision === 'BLOCKED' ? 'BLOCKED' : 'READY', reason: result.decision === 'BLOCKED' ? result.reason_code : null, operationId: options.operation_id, result });
}

function journalFromReconciliation(plan, journal, reconciliation) {
  const next = structuredClone(journal);
  for (const observation of reconciliation.observations) {
    const entry = next.entries.find((candidate) => candidate.item_id === observation.item_id);
    const action = plan.mutable_actions.find((candidate) => candidate.item_id === observation.item_id);
    if (observation.classification === 'APPLIED_VERIFIED') {
      entry.state = 'VERIFIED';
      entry.after_sha256 = action.action === 'BACKUP_RETIRE' ? null : action.source_sha256;
      entry.error_code = null;
    } else if (observation.classification === 'NO_EFFECT_VERIFIED') {
      entry.state = ['BACKUP_UPDATE', 'BACKUP_RETIRE'].includes(action.action) ? 'BACKED_UP' : 'PLANNED';
      entry.error_code = null;
      entry.after_sha256 = null;
    }
  }
  next.status = next.entries.every((entry) => entry.state === 'VERIFIED') ? 'VERIFIED' : 'PLANNED';
  next.reconciliation = { status: 'RECONCILED', observed_at: new Date(0).toISOString(), evidence_sha256: canonicalSha256(reconciliation) };
  return next;
}

async function executeResume({ command, options, roots, runtime }) {
  if (!options.operation_id) fail('OPERATION_ID_REQUIRED');
  const state = await loadOperationState({ fs: runtime.fs, stateRoot: roots.stateRoot, operationId: options.operation_id });
  const current = await buildPlanContext({ command: 'install', options, roots, runtime });
  const planned = {
    ...current,
    plan: state.plan,
    operationId: options.operation_id,
    bindings: { ...current.bindings, plan_sha256: canonicalSha256(state.plan) },
  };
  const reconciliation = await reconcileUncertainReadOnly({ fs: runtime.fs, destinationRoot: roots.destinationRoot, plan: state.plan, journal: state.journal, clock: runtime.clock });
  if (reconciliation.decision !== 'RECONCILED_REQUIRES_NEW_AUTHORIZATION') {
    return structuredResult({ command, ok: false, status: 'BLOCKED', reason: reconciliation.reason_code, operationId: options.operation_id, result: { reconciliation } });
  }
  const envelope = await readAuthorization({ fs: runtime.fs, path: options.authorization, roots });
  assertFreshContinuationAuthority(envelope, authorizationExpectation(planned, command, 'RESUME'), { now: runtime.clock() });
  assertNoBlindRetry({ journal: state.journal, reconciliation, authorizationValidated: true });
  const lock = await observeOperationLock({ fs: runtime.fs, stateRoot: roots.stateRoot, operationClass: operationClass(command), isProcessActive: runtime.isProcessActive });
  if (!lock.present || lock.lock.operation_id !== options.operation_id || lock.state === 'ACTIVE') fail('RECONCILED_OPERATION_LOCK_REQUIRED');
  const journal = journalFromReconciliation(state.plan, state.journal, reconciliation);
  const journalStore = createDurableJournalStore({ fs: runtime.fs, operationRoot: state.operationRoot, startSequence: await durableSequence(runtime.fs, state.operationRoot) });
  const context = {
    ...contextFor({ planContext: planned, roots, operationRoot: state.operationRoot }),
    bindings: { ...state.plan.bindings },
  };
  const applied = await applySyntheticPlan({ context, plan: state.plan, manifest: planned.source.manifest, sourceRoot: roots.sourceRoot, authorization: { current: true, snapshot_sha256: state.plan.bindings.snapshot_sha256 }, backupManifest: state.backupManifest, journal, journalStore, filesystemAdapter: runtime.fs, faultInjector: runtime.faultInjector, clock: runtime.clock });
  if (['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN'].includes(applied.status)) {
    return structuredResult({ command, ok: false, status: applied.status, reason: applied.status, operationId: options.operation_id, result: { reconciliation, applied, lock_retained: true } });
  }
  if (applied.status === 'FAILED_KNOWN') {
    await releaseOperationLock({ fs: runtime.fs, lockHandle: { path: lock.path, lock: lock.lock }, operationRoot: state.operationRoot, outcome: applied.status, reconciliationStatus: 'RECONCILED' });
    return structuredResult({ command, ok: false, status: 'BLOCKED', reason: applied.error_code, operationId: options.operation_id, result: { reconciliation, applied, lock_retained: false } });
  }
  let receipt;
  try {
    await fault(runtime.faultInjector, 'before-receipt', { operation_id: options.operation_id });
    receipt = buildInstallationReceipt({ context, plan: state.plan, journal: applied.journal, preRestart: true });
    await writeDurableArtifact({ fs: runtime.fs, operationRoot: state.operationRoot, name: 'resumed-receipt.json', document: receipt });
    await fault(runtime.faultInjector, 'after-receipt', { operation_id: options.operation_id });
  } catch (error) {
    const status = error?.unknown === true ? 'UNKNOWN' : 'PARTIAL';
    const uncertainJournal = structuredClone(applied.journal);
    uncertainJournal.status = status;
    uncertainJournal.reconciliation = { status: 'UNRECONCILED', observed_at: runtime.clock().toISOString() };
    await journalStore.append(uncertainJournal, { type: 'RECEIPT_FAILURE', failure_point: error?.lifecyclePoint ?? null });
    return structuredResult({ command, ok: false, status, reason: status, operationId: options.operation_id, result: { reconciliation, failure_point: error?.lifecyclePoint ?? null, lock_retained: true }, errors: [error] });
  }
  let selfUpdate = null;
  if (applied.pending_self_update) {
    selfUpdate = await applySyntheticSelfUpdate({ context, plan: state.plan, manifest: planned.source.manifest, sourceRoot: roots.sourceRoot, authorization: { current: true, snapshot_sha256: state.plan.bindings.snapshot_sha256 }, backupManifest: state.backupManifest, journal: applied.journal, journalStore, filesystemAdapter: runtime.fs, faultInjector: runtime.faultInjector, clock: runtime.clock });
    if (['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN'].includes(selfUpdate.status)) {
      return structuredResult({ command, ok: false, status: selfUpdate.status, reason: selfUpdate.status, operationId: options.operation_id, result: { reconciliation, applied, receipt, self_update: selfUpdate, lock_retained: true } });
    }
  }
  await releaseOperationLock({ fs: runtime.fs, lockHandle: { path: lock.path, lock: lock.lock }, operationRoot: state.operationRoot, outcome: selfUpdate?.status ?? applied.status, reconciliationStatus: 'RECONCILED' });
  return structuredResult({ command, ok: true, status: 'COMPLETED', operationId: options.operation_id, result: { reconciliation, applied, receipt, self_update: selfUpdate, hard_stop: selfUpdate?.hard_stop === true, stage_b: 'NOT_EXECUTED', lock_retained: false } });
}

async function executeRollback({ command, options, roots, runtime }) {
  if (!options.operation_id) fail('OPERATION_ID_REQUIRED');
  const state = await loadOperationState({ fs: runtime.fs, stateRoot: roots.stateRoot, operationId: options.operation_id });
  const current = await buildPlanContext({ command: 'install', options, roots, runtime });
  const planned = {
    ...current,
    plan: state.plan,
    operationId: options.operation_id,
    bindings: { ...current.bindings, plan_sha256: canonicalSha256(state.plan) },
  };
  const reconciliation = await reconcileUncertainReadOnly({ fs: runtime.fs, destinationRoot: roots.destinationRoot, plan: state.plan, journal: state.journal, clock: runtime.clock });
  if (reconciliation.decision !== 'RECONCILED_REQUIRES_NEW_AUTHORIZATION') {
    return structuredResult({ command, ok: false, status: 'BLOCKED', reason: reconciliation.reason_code, operationId: options.operation_id, result: { reconciliation } });
  }
  const journal = journalFromReconciliation(state.plan, state.journal, reconciliation);
  const context = {
    ...contextFor({ planContext: planned, roots, operationRoot: state.operationRoot }),
    bindings: { ...state.plan.bindings },
  };
  const rollbackPlan = await deriveSyntheticRollbackPlan({ context, plan: state.plan, backupManifest: state.backupManifest, journal });
  if (!options.apply) return structuredResult({ command, ok: rollbackPlan.decision !== 'BLOCKED', status: rollbackPlan.decision === 'BLOCKED' ? 'BLOCKED' : 'READY', reason: rollbackPlan.decision === 'BLOCKED' ? 'ROLLBACK_PLAN_BLOCKED' : null, operationId: options.operation_id, result: { reconciliation, rollback_plan: rollbackPlan } });

  const envelope = await readAuthorization({ fs: runtime.fs, path: options.authorization, roots });
  assertFreshContinuationAuthority(envelope, authorizationExpectation(planned, command, 'ROLLBACK'), { now: runtime.clock() });
  assertNoBlindRetry({ journal: state.journal, reconciliation, authorizationValidated: true });
  const lock = await observeOperationLock({ fs: runtime.fs, stateRoot: roots.stateRoot, operationClass: operationClass(command), isProcessActive: runtime.isProcessActive });
  if (!lock.present || lock.lock.operation_id !== options.operation_id || lock.state === 'ACTIVE') fail('RECONCILED_OPERATION_LOCK_REQUIRED');
  const journalStore = createDurableJournalStore({ fs: runtime.fs, operationRoot: state.operationRoot, startSequence: await durableSequence(runtime.fs, state.operationRoot) });
  const receipt = await rollbackSyntheticPlan({
    context,
    rollbackPlan,
    backupManifest: state.backupManifest,
    authorization: { current: true, synthetic: true, operation_id: options.operation_id },
    journalStore,
    filesystemAdapter: runtime.fs,
    faultInjector: runtime.faultInjector,
    clock: runtime.clock,
  });
  if (['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN'].includes(receipt.status)) {
    return structuredResult({ command, ok: false, status: receipt.status, reason: receipt.status, operationId: options.operation_id, result: { reconciliation, rollback_plan: rollbackPlan, receipt, lock_retained: true } });
  }
  await writeDurableArtifact({ fs: runtime.fs, operationRoot: state.operationRoot, name: 'rollback-receipt.json', document: receipt });
  await releaseOperationLock({ fs: runtime.fs, lockHandle: { path: lock.path, lock: lock.lock }, operationRoot: state.operationRoot, outcome: receipt.status, reconciliationStatus: 'RECONCILED' });
  return structuredResult({ command, ok: true, status: 'COMPLETED', operationId: options.operation_id, result: { reconciliation, rollback_plan: rollbackPlan, receipt, lock_retained: false } });
}

async function executeUninstall({ command, options, roots, runtime }) {
  if (!runtime.priorReceipt) fail('INSTALLATION_RECEIPT_REQUIRED');
  const receiptSha256 = canonicalSha256(runtime.priorReceipt);
  const operationId = options.operation_id ?? `uninstall-${receiptSha256.slice(0, 20)}`;
  const plan = await planUninstall({ fs: runtime.fs, destinationRoot: roots.destinationRoot, receipt: runtime.priorReceipt, receiptSha256, operationId, clock: runtime.clock });
  if (!options.apply) return structuredResult({ command, ok: plan.decision !== 'BLOCKED', status: plan.decision === 'BLOCKED' ? 'BLOCKED' : 'READY', reason: plan.decision === 'BLOCKED' ? 'UNINSTALL_PLAN_BLOCKED' : null, operationId, result: { plan, plan_sha256: canonicalSha256(plan) } });
  const stateSnapshot = await observeTree(runtime.fs, roots.stateRoot);
  const scope = operationScopeBinding({ destinationRootId: 'SYNTHETIC_KIRO_ROOT', destinationSnapshot: plan.actions, stateSnapshot });
  const bindings = { plan_sha256: canonicalSha256(plan), snapshot_sha256: canonicalSha256(plan.actions), source_sha256: receiptSha256, manifest_sha256: runtime.manifestSha256 ?? receiptSha256, lock_sha256: runtime.lockSha256 ?? receiptSha256 };
  const envelope = await readAuthorization({ fs: runtime.fs, path: options.authorization, roots });
  assertFreshContinuationAuthority(envelope, { operation_id: operationId, operation_class: 'UNINSTALL', required_operation: 'UNINSTALL', scope, bindings }, { now: runtime.clock() });
  const lockHandle = await acquireOperationLock({ fs: runtime.fs, stateRoot: roots.stateRoot, operationId, operationClass: 'UNINSTALL', sessionId: runtime.sessionId, processId: runtime.processId, clock: runtime.clock, isProcessActive: runtime.isProcessActive });
  const { operationRoot } = await initializeOperationState({ fs: runtime.fs, stateRoot: roots.stateRoot, operationId });
  await writeDurableArtifact({ fs: runtime.fs, operationRoot, name: 'plan.json', document: plan });
  const journalStore = createDurableJournalStore({ fs: runtime.fs, operationRoot });
  const result = await applyUninstall({ fs: runtime.fs, destinationRoot: roots.destinationRoot, operationRoot, plan, authorizationValidated: true, journalStore, clock: runtime.clock, faultInjector: runtime.faultInjector });
  if (['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN'].includes(result.status)) {
    return structuredResult({ command, ok: false, status: result.status, reason: result.status, operationId, result: { ...result, lock_retained: true } });
  }
  if (result.status === 'FAILED_KNOWN') {
    await releaseOperationLock({ fs: runtime.fs, lockHandle, operationRoot, outcome: result.status, reconciliationStatus: 'RECONCILED' });
    return structuredResult({ command, ok: false, status: 'BLOCKED', reason: result.error_code, operationId, result: { ...result, lock_retained: false } });
  }
  await writeDurableArtifact({ fs: runtime.fs, operationRoot, name: 'tombstone.json', document: result.tombstone });
  await releaseOperationLock({ fs: runtime.fs, lockHandle, operationRoot, outcome: result.status, reconciliationStatus: 'RECONCILED' });
  return structuredResult({ command, ok: true, status: 'COMPLETED', operationId, result: { ...result, lock_retained: false } });
}

export function createSyntheticLifecycleRuntime({
  fs,
  sandboxRoot,
  prohibitedRoots,
  clock = () => new Date(),
  sessionId = 'synthetic-session-0001',
  processId = process.pid,
  isProcessActive = (candidate) => candidate === processId,
  faultInjector = async () => {},
  validateManifest = true,
  priorReceipt = null,
  knownManagedHashes = {},
  manifestSha256 = null,
  lockSha256 = null,
} = {}) {
  if (!fs || !sandboxRoot || !Array.isArray(prohibitedRoots)) fail('SYNTHETIC_RUNTIME_INJECTION_REQUIRED');
  return Object.freeze({ fs, sandboxRoot, prohibitedRoots, clock, sessionId, processId, isProcessActive, faultInjector, validateManifest, priorReceipt, knownManagedHashes, manifestSha256, lockSha256 });
}

export async function executeLifecycleCommand(parsed, runtime = {}) {
  const { command, options } = parsed;
  if (!runtime.sandboxRoot || !Array.isArray(runtime.prohibitedRoots) || !runtime.fs) fail('SYNTHETIC_RUNTIME_INJECTION_REQUIRED');
  const roots = assertSyntheticLifecycleRoots({
    sourceRoot: options.source,
    destinationRoot: options.destination,
    stateRoot: options.state,
    cacheRoot: options.cache,
    tempRoot: options.temp,
    sandboxRoot: runtime.sandboxRoot,
    prohibitedRoots: runtime.prohibitedRoots,
  });
  if (typeof runtime.dispatch === 'function') return runtime.dispatch({ command, options, roots });
  if (command === 'inspect-state') {
    const result = await observeTree(runtime.fs, roots.stateRoot);
    return structuredResult({ command, ok: true, status: 'READY', operationId: options.operation_id ?? null, result: { state: result, read_only: true } });
  }
  if (command === 'inspect-plan') return planResult(command, await buildPlanContext({ command: 'install', options, roots, runtime }), 'install');
  if (command === 'install' || command === 'update') return executeInstallOrUpdate({ command, options, roots, runtime });
  if (command === 'reconcile') return executeReconcile({ command, options, roots, runtime });
  if (command === 'resume') return executeResume({ command, options, roots, runtime });
  if (command === 'rollback') return executeRollback({ command, options, roots, runtime });
  if (command === 'uninstall') return executeUninstall({ command, options, roots, runtime });
  fail('LIFECYCLE_COMMAND_NOT_IMPLEMENTED');
}
