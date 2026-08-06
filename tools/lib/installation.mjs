import { randomUUID, createHash } from 'node:crypto';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { chmod, chown, lstat, mkdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import YAML from 'yaml';
import { containedPath } from './io.mjs';
import { atomicReplaceFile } from './lifecycle/atomic-writer.mjs';
import { classifyFaultBoundary } from './lifecycle/state-store.mjs';

const JOURNAL_TRANSITIONS = new Map([
  ['PLANNED', new Set(['BACKED_UP', 'APPLYING', 'FAILED_KNOWN', 'UNKNOWN'])],
  ['BACKED_UP', new Set(['APPLYING', 'FAILED_KNOWN', 'UNKNOWN'])],
  ['APPLYING', new Set(['APPLIED', 'FAILED_KNOWN', 'UNKNOWN'])],
  ['APPLIED', new Set(['VERIFIED', 'FAILED_KNOWN', 'UNKNOWN'])],
]);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizedRelative(path) {
  if (typeof path !== 'string' || path.length === 0 || isAbsolute(path) || path.includes('\\')) throw new Error('INVALID_RELATIVE_PATH');
  const normalized = path.split('/').filter((part) => part !== '.').join('/');
  if (normalized !== path || path.split('/').includes('..')) throw new Error('INVALID_RELATIVE_PATH');
  return normalized;
}

function assertAbsoluteRoot(path, name) {
  if (typeof path !== 'string' || !isAbsolute(path)) throw new Error(`${name}_MUST_BE_ABSOLUTE`);
  return resolve(path);
}

function isWithin(root, candidate) {
  const rel = relative(root, candidate);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export function assertInjectedInstallationRoots({ destinationRoot, backupRoot, realGlobalRoot = null }) {
  const destination = assertAbsoluteRoot(destinationRoot, 'DESTINATION_ROOT');
  const backup = assertAbsoluteRoot(backupRoot, 'BACKUP_ROOT');
  if (realGlobalRoot !== null) {
    const prohibited = assertAbsoluteRoot(realGlobalRoot, 'REAL_GLOBAL_ROOT');
    if (isWithin(prohibited, destination) || isWithin(destination, prohibited) || isWithin(prohibited, backup) || isWithin(backup, prohibited)) throw new Error('REAL_GLOBAL_ROOT_PROHIBITED');
  }
  if (destination === backup || isWithin(destination, backup) || isWithin(backup, destination)) throw new Error('ROOTS_MUST_BE_EXTERNAL_AND_DISJOINT');
  return { destinationRoot: destination, backupRoot: backup };
}

export function createOperationContext({ destinationRoot, backupRoot, realGlobalRoot = null, plan, operationId, clock = () => new Date(), uuid = randomUUID }) {
  const roots = assertInjectedInstallationRoots({ destinationRoot, backupRoot, realGlobalRoot });
  if (!plan || plan.decision !== 'CHECKPOINT_REQUIRED' || plan.dry_run_decision !== 'CHECKPOINT_REQUIRED') throw new Error('PLAN_NOT_AUTHORIZABLE');
  for (const key of ['manifest_sha256', 'lock_sha256', 'package_sha256', 'snapshot_sha256']) {
    if (!/^[a-f0-9]{64}$/.test(plan.bindings?.[key] ?? '')) throw new Error(`INVALID_PLAN_BINDING_${key.toUpperCase()}`);
  }
  const id = operationId ?? `install-${uuid()}`;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{7,127}$/.test(id)) throw new Error('INVALID_OPERATION_ID');
  const operationRoot = containedPath(roots.backupRoot, id);
  return {
    schema_version: 1,
    operation_id: id,
    created_at: clock().toISOString(),
    ...roots,
    operationRoot,
    bindings: structuredClone(plan.bindings),
  };
}

async function assertNoSymlinkRegularFile(root, relativePath) {
  normalizedRelative(relativePath);
  const absolute = containedPath(root, relativePath);
  const rel = relative(root, absolute);
  let cursor = root;
  for (const part of rel.split(sep)) {
    cursor = resolve(cursor, part);
    const metadata = await lstat(cursor);
    if (metadata.isSymbolicLink()) throw new Error('SYMLINK_UNEXPECTED');
  }
  const metadata = await lstat(absolute);
  if (!metadata.isFile()) throw new Error('TYPE_CONFLICT');
  return { absolute, metadata };
}

function backupFileName(action) {
  const pathHash = sha256(Buffer.from(action.path)).slice(0, 16);
  return `files/${String(action.sequence).padStart(4, '0')}-${pathHash}-${basename(action.path)}.bak`;
}

export async function createVerifiedBackup({ context, plan, clock = () => new Date() }) {
  const candidates = plan.actions.filter((action) => ['BACKUP_UPDATE', 'BACKUP_RETIRE'].includes(action.action));
  if (candidates.length === 0) return null;
  await mkdir(containedPath(context.operationRoot, 'files'), { recursive: true, mode: 0o755 });
  const entries = [];
  for (const action of candidates) {
    const { absolute, metadata } = await assertNoSymlinkRegularFile(context.destinationRoot, action.path);
    const bytes = await readFile(absolute);
    const beforeHash = sha256(bytes);
    if (beforeHash !== action.before_sha256) throw new Error('BACKUP_SOURCE_HASH_MISMATCH');
    const backupPath = backupFileName(action);
    const backupAbsolute = containedPath(context.operationRoot, backupPath);
    await mkdir(dirname(backupAbsolute), { recursive: true, mode: 0o755 });
    await writeFile(backupAbsolute, bytes, { flag: 'wx', mode: 0o600 });
    const copied = await readFile(backupAbsolute);
    if (sha256(copied) !== beforeHash || copied.length !== bytes.length) throw new Error('BACKUP_VERIFICATION_FAILED');
    entries.push({
      item_id: action.item_id,
      path: action.path,
      pre_state: action.state,
      backup_path: backupPath,
      sha256: beforeHash,
      size: bytes.length,
      file_type: 'REGULAR_FILE',
      mode: process.platform === 'win32' ? null : (metadata.mode & 0o7777).toString(8).padStart(4, '0'),
      uid: process.platform === 'win32' ? null : metadata.uid,
      gid: process.platform === 'win32' ? null : metadata.gid,
      verified: true,
    });
  }
  const manifest = {
    schema_version: 1,
    operation_id: context.operation_id,
    manifest_sha256: context.bindings.manifest_sha256,
    snapshot_sha256: context.bindings.snapshot_sha256,
    created_at: clock().toISOString(),
    destination_root_id: 'KIRO_GLOBAL_ROOT',
    entries,
    verified: true,
  };
  await writeFile(containedPath(context.operationRoot, 'backup-manifest.yaml'), YAML.stringify(manifest), { flag: 'wx', mode: 0o600 });
  await verifyBackupManifest({ context, manifest });
  return manifest;
}

export async function verifyBackupManifest({ context, manifest }) {
  if (!manifest?.verified || manifest.operation_id !== context.operation_id || manifest.manifest_sha256 !== context.bindings.manifest_sha256 || manifest.snapshot_sha256 !== context.bindings.snapshot_sha256) throw new Error('BACKUP_MANIFEST_BINDING_MISMATCH');
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) throw new Error('BACKUP_MANIFEST_INCOMPLETE');
  for (const entry of manifest.entries) {
    normalizedRelative(entry.backup_path);
    const { absolute, metadata } = await assertNoSymlinkRegularFile(context.operationRoot, entry.backup_path);
    const bytes = await readFile(absolute);
    if (sha256(bytes) !== entry.sha256 || bytes.length !== entry.size || !metadata.isFile() || entry.verified !== true) throw new Error('BACKUP_ENTRY_INCONSISTENT');
  }
  return true;
}

function journalAction(action) {
  if (action.phase === 'SELF_UPDATE') return 'SELF_UPDATE';
  return action.action;
}

export function createInstallationJournal({ context, plan }) {
  const entries = plan.mutable_actions.map((action) => ({
    sequence: action.sequence,
    item_id: action.item_id,
    path: action.path,
    action: journalAction(action),
    state: 'PLANNED',
    intent_recorded_at: context.created_at,
    before_sha256: action.before_sha256,
    after_sha256: null,
    error_code: null,
  }));
  if (entries.length === 0) throw new Error('JOURNAL_REQUIRES_MUTABLE_ACTIONS');
  return {
    schema_version: 1,
    operation_id: context.operation_id,
    manifest_sha256: context.bindings.manifest_sha256,
    snapshot_sha256: context.bindings.snapshot_sha256,
    status: 'PLANNED',
    entries,
  };
}

export function transitionJournalEntry(journal, { itemId, to, afterSha256 = null, errorCode = null, clock = () => new Date() }) {
  const next = structuredClone(journal);
  const entry = next.entries.find((candidate) => candidate.item_id === itemId);
  if (!entry) throw new Error('JOURNAL_ITEM_NOT_FOUND');
  if (!JOURNAL_TRANSITIONS.get(entry.state)?.has(to)) throw new Error('INVALID_JOURNAL_TRANSITION');
  if (to === 'VERIFIED' && entry.action !== 'BACKUP_RETIRE' && !/^[a-f0-9]{64}$/.test(afterSha256 ?? '')) throw new Error('VERIFICATION_HASH_REQUIRED');
  if (['FAILED_KNOWN', 'UNKNOWN'].includes(to) && !/^[A-Z][A-Z0-9_]*$/.test(errorCode ?? '')) throw new Error('ERROR_CODE_REQUIRED');
  entry.state = to;
  if (afterSha256 != null) entry.after_sha256 = afterSha256;
  if (errorCode != null) entry.error_code = errorCode;
  if (['APPLIED', 'VERIFIED', 'FAILED_KNOWN', 'UNKNOWN'].includes(to)) entry.completed_at = clock().toISOString();
  const states = new Set(next.entries.map((candidate) => candidate.state));
  next.status = states.has('UNKNOWN') ? 'UNKNOWN'
    : states.has('FAILED_KNOWN') ? 'FAILED_KNOWN'
      : [...states].every((state) => state === 'VERIFIED') ? 'VERIFIED'
        : states.has('APPLIED') || states.has('VERIFIED') ? 'APPLIED'
          : states.has('APPLYING') ? 'APPLYING'
            : [...states].every((state) => state === 'BACKED_UP') ? 'BACKED_UP'
              : 'PLANNED';
  return next;
}

export function buildInstallationReceipt({ context, plan, journal, preRestart = true }) {
  if (journal.operation_id !== context.operation_id) throw new Error('RECEIPT_OPERATION_MISMATCH');
  const selfUpdate = journal.entries.find((entry) => entry.action === 'SELF_UPDATE');
  if (preRestart && selfUpdate && ['APPLIED', 'VERIFIED'].includes(selfUpdate.state)) throw new Error('PRE_RESTART_SELF_UPDATE_CANNOT_BE_RECORDED');
  const verified = journal.entries.filter((entry) => entry.state === 'VERIFIED' && entry.action !== 'SELF_UPDATE');
  const actions = verified.map((entry) => ({
    sequence: entry.sequence,
    item_id: entry.item_id,
    path: entry.path,
    action: entry.action,
    state: 'VERIFIED',
    before_sha256: entry.before_sha256,
    after_sha256: entry.after_sha256,
    verified: true,
  }));
  const actionsNotExecuted = journal.entries.filter((entry) => !verified.includes(entry)).map((entry) => {
    const category = entry.action === 'SELF_UPDATE' ? 'PENDING'
      : entry.state === 'APPLIED' ? 'EXECUTED_UNVERIFIED'
        : entry.state === 'FAILED_KNOWN' ? 'FAILED'
          : entry.state === 'UNKNOWN' ? 'UNKNOWN'
            : 'PLANNED';
    return `${category}:${entry.item_id}`;
  });
  actionsNotExecuted.push('NOT_EXECUTED:post-restart-validation');
  return {
    schema_version: 1,
    operation_id: context.operation_id,
    manifest_sha256: context.bindings.manifest_sha256,
    lock_sha256: context.bindings.lock_sha256,
    package_sha256: context.bindings.package_sha256,
    snapshot_sha256: context.bindings.snapshot_sha256,
    status: journal.status === 'FAILED_KNOWN' || journal.status === 'UNKNOWN' ? 'FAILED_KNOWN' : 'PRE_RESTART_PENDING',
    pending_action: 'skill-bootstrap',
    actions,
    actions_not_executed: [...new Set(actionsNotExecuted)],
  };
}


async function assertContainedSource(sourceRoot, sourcePath, expectedSha256) {
  const root = assertAbsoluteRoot(sourceRoot, 'SOURCE_ROOT');
  const { absolute } = await assertNoSymlinkRegularFile(root, sourcePath);
  const bytes = await readFile(absolute);
  if (sha256(bytes) !== expectedSha256) throw new Error('SOURCE_HASH_MISMATCH');
  return bytes;
}

async function ensureSafeParent(root, relativePath) {
  normalizedRelative(relativePath);
  const absolute = containedPath(root, relativePath);
  const parentRelative = relative(root, dirname(absolute));
  let cursor = root;
  try {
    const rootMetadata = await lstat(root);
    if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) throw new Error('DESTINATION_ROOT_UNSAFE');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(root, { recursive: true, mode: 0o755 });
  }
  if (parentRelative && parentRelative !== '.') {
    for (const part of parentRelative.split(sep)) {
      cursor = resolve(cursor, part);
      try {
        const metadata = await lstat(cursor);
        if (metadata.isSymbolicLink() || !metadata.isDirectory()) throw new Error('DESTINATION_ANCESTOR_UNSAFE');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await mkdir(cursor, { mode: 0o755 });
      }
    }
  }
  try {
    const metadata = await lstat(absolute);
    if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error('DESTINATION_TYPE_UNSAFE');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return absolute;
}

function sourcePathForAction(manifest, action) {
  const managed = manifest.managed_items.find((item) => item.id === action.item_id);
  if (!managed) throw new Error('MANAGED_ITEM_NOT_FOUND');
  const source = manifest.source_catalog.find((item) => item.id === managed.source_id);
  if (!source) throw new Error('SOURCE_CATALOG_ITEM_NOT_FOUND');
  return source.path;
}

function assertApplyAuthorization({ context, authorization, plan }) {
  if (authorization?.current !== true) throw new Error('AUTHORIZATION_EXPIRED');
  if (authorization.snapshot_sha256 !== context.bindings.snapshot_sha256) throw new Error('SNAPSHOT_DIVERGED');
  if (plan.bindings.snapshot_sha256 !== context.bindings.snapshot_sha256) throw new Error('PLAN_CONTEXT_DIVERGED');
}

function backupEntryFor(backupManifest, action) {
  return backupManifest?.entries.find((entry) => entry.item_id === action.item_id && entry.path === action.path);
}

async function assertCurrentActionPrestate(context, action) {
  const target = containedPath(context.destinationRoot, normalizedRelative(action.path));
  if (action.action === 'CREATE') {
    try {
      await lstat(target);
      throw new Error('SNAPSHOT_DIVERGED');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return;
  }
  const { absolute } = await assertNoSymlinkRegularFile(context.destinationRoot, action.path);
  if (sha256(await readFile(absolute)) !== action.before_sha256) throw new Error('SNAPSHOT_DIVERGED');
}

function assertEntrypointReady(plan, action, completed) {
  if (action.action !== 'BACKUP_RETIRE') return;
  const entrypoint = plan.actions.find((candidate) => candidate.phase === 'ENTRYPOINT');
  if (!entrypoint || entrypoint.sequence >= action.sequence) throw new Error('ENTRYPOINT_NOT_READY');
  if (entrypoint.action !== 'NO_CHANGE' && !completed.includes(entrypoint.item_id)) throw new Error('ENTRYPOINT_NOT_VERIFIED');
}

async function atomicReplace({ context, action, bytes }) {
  const destination = await ensureSafeParent(context.destinationRoot, action.path);
  const stageName = `.${basename(destination)}.${context.operation_id}.${String(action.sequence).padStart(4, '0')}.stage`;
  const stage = containedPath(dirname(destination), stageName);
  try {
    await writeFile(stage, bytes, { flag: 'wx', mode: 0o644 });
    if (sha256(await readFile(stage)) !== action.source_sha256) throw new Error('STAGE_HASH_MISMATCH');
    await rename(stage, destination);
  } finally {
    await rm(stage, { force: true });
  }
  const written = await readFile(destination);
  if (sha256(written) !== action.source_sha256) throw new Error('DESTINATION_HASH_MISMATCH');
  return action.source_sha256;
}

async function injectLifecycleFault(faultInjector, point, action) {
  try {
    await faultInjector({ point, action: structuredClone(action) });
  } catch (error) {
    error.lifecyclePoint ??= point;
    throw error;
  }
}

async function appendDurableJournal(journalStore, journal, event) {
  if (!journalStore) return null;
  return journalStore.append(journal, event);
}

function markFailure(journal, action, error, clock, { durable = false } = {}) {
  const errorCode = error?.unknown === true ? 'UNKNOWN_EFFECT' : String(error?.code ?? error?.message ?? 'APPLY_FAILED').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 64) || 'APPLY_FAILED';
  const classification = error?.unknown === true ? 'UNKNOWN'
    : durable && error?.lifecyclePoint ? classifyFaultBoundary(error.lifecyclePoint)
      : 'FAILED_KNOWN';
  if (classification === 'FAILED_KNOWN') {
    try {
      return transitionJournalEntry(journal, { itemId: action.item_id, to: 'FAILED_KNOWN', errorCode, clock });
    } catch {
      // Fall through to the compatibility-safe direct failure representation.
    }
  }
  const next = structuredClone(journal);
  const entry = next.entries.find((candidate) => candidate.item_id === action.item_id);
  entry.state = classification;
  entry.error_code = errorCode;
  entry.completed_at = clock().toISOString();
  next.status = classification;
  if (durable && ['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN'].includes(classification)) {
    next.reconciliation = { status: 'UNRECONCILED', observed_at: entry.completed_at };
  }
  return next;
}

export async function applySyntheticPlan({
  context,
  plan,
  manifest,
  sourceRoot,
  authorization,
  backupManifest = null,
  journal = createInstallationJournal({ context, plan }),
  journalStore = null,
  filesystemAdapter = null,
  faultInjector = async () => {},
  clock = () => new Date(),
}) {
  assertInjectedInstallationRoots({ destinationRoot: context.destinationRoot, backupRoot: context.backupRoot });
  if (Boolean(journalStore) !== Boolean(filesystemAdapter)) throw new Error('DURABILITY_CAPABILITIES_MUST_BE_INJECTED_TOGETHER');
  if (plan.decision !== 'CHECKPOINT_REQUIRED' || plan.blocked_actions?.length) throw new Error('PLAN_BLOCKED');
  const durable = Boolean(journalStore && filesystemAdapter);
  const applicable = plan.mutable_actions.filter((action) => action.phase !== 'SELF_UPDATE');
  const requiresBackup = applicable.some((action) => ['BACKUP_UPDATE', 'BACKUP_RETIRE'].includes(action.action));
  if (requiresBackup) await verifyBackupManifest({ context, manifest: backupManifest });
  let currentJournal = structuredClone(journal);
  const completed = currentJournal.entries
    .filter((entry) => entry.state === 'VERIFIED' && entry.action !== 'SELF_UPDATE')
    .map((entry) => entry.item_id);

  for (const action of applicable) {
    const existingEntry = currentJournal.entries.find((entry) => entry.item_id === action.item_id);
    if (existingEntry?.state === 'VERIFIED') continue;
    try {
      assertApplyAuthorization({ context, authorization, plan });
      assertEntrypointReady(plan, action, completed);
      await assertCurrentActionPrestate(context, action);
      if (['BACKUP_UPDATE', 'BACKUP_RETIRE'].includes(action.action)) {
        const backup = backupEntryFor(backupManifest, action);
        if (!backup?.verified || backup.sha256 !== action.before_sha256) throw new Error('REQUIRED_BACKUP_MISSING');
        if (existingEntry.state === 'PLANNED') {
          currentJournal = transitionJournalEntry(currentJournal, { itemId: action.item_id, to: 'BACKED_UP', clock });
          await appendDurableJournal(journalStore, currentJournal, { type: 'BACKUP_VERIFIED', item_id: action.item_id });
        } else if (existingEntry.state !== 'BACKED_UP') throw new Error('RESUME_STATE_NOT_READY');
      }

      if (durable) {
        await injectLifecycleFault(faultInjector, 'before-intent', action);
        const intent = await journalStore.recordIntent(currentJournal, action);
        currentJournal = intent.journal;
        await injectLifecycleFault(faultInjector, 'after-intent', action);
      }

      if (!durable) await injectLifecycleFault(faultInjector, 'before-write', action);
      currentJournal = transitionJournalEntry(currentJournal, { itemId: action.item_id, to: 'APPLYING', clock });
      await appendDurableJournal(journalStore, currentJournal, { type: 'APPLYING', item_id: action.item_id });
      let afterSha256;
      if (action.action === 'BACKUP_RETIRE') {
        if (durable) await injectLifecycleFault(faultInjector, 'before-write', action);
        const { absolute } = await assertNoSymlinkRegularFile(context.destinationRoot, action.path);
        if (sha256(await readFile(absolute)) !== action.before_sha256) throw new Error('RETIREMENT_HASH_DIVERGED');
        await unlink(absolute);
        if (durable) await injectLifecycleFault(faultInjector, 'after-write', action);
        try {
          await lstat(absolute);
          throw new Error('RETIREMENT_NOT_REMOVED');
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
        if (durable) {
          await injectLifecycleFault(faultInjector, 'before-sync', action);
          await filesystemAdapter.syncDirectory(dirname(absolute));
          await injectLifecycleFault(faultInjector, 'after-sync', action);
        }
        afterSha256 = null;
      } else {
        const sourcePath = sourcePathForAction(manifest, action);
        const bytes = await assertContainedSource(sourceRoot, sourcePath, action.source_sha256);
        afterSha256 = durable
          ? (await atomicReplaceFile({
            fs: filesystemAdapter,
            root: context.destinationRoot,
            relativePath: action.path,
            bytes,
            expectedSha256: action.source_sha256,
            operationId: context.operation_id,
            sequence: action.sequence,
            faultInjector: (event) => injectLifecycleFault(faultInjector, event.point, action),
          })).sha256
          : await atomicReplace({ context, action, bytes });
      }
      currentJournal = transitionJournalEntry(currentJournal, { itemId: action.item_id, to: 'APPLIED', afterSha256, clock });
      await appendDurableJournal(journalStore, currentJournal, { type: 'APPLIED', item_id: action.item_id, after_sha256: afterSha256 });
      if (!durable) await injectLifecycleFault(faultInjector, 'after-write', action);
      currentJournal = transitionJournalEntry(currentJournal, { itemId: action.item_id, to: 'VERIFIED', afterSha256, clock });
      await appendDurableJournal(journalStore, currentJournal, { type: 'VERIFIED', item_id: action.item_id, after_sha256: afterSha256 });
      completed.push(action.item_id);
    } catch (error) {
      currentJournal = markFailure(currentJournal, action, error, clock, { durable });
      await appendDurableJournal(journalStore, currentJournal, { type: 'FAILURE', item_id: action.item_id, failure_point: error?.lifecyclePoint ?? null, status: currentJournal.status });
      return {
        status: currentJournal.status,
        failed_item: action.item_id,
        error_code: currentJournal.entries.find((entry) => entry.item_id === action.item_id).error_code,
        journal: currentJournal,
        completed,
        pending_self_update: plan.mutable_actions.some((candidate) => candidate.phase === 'SELF_UPDATE'),
      };
    }
  }
  return {
    status: plan.mutable_actions.some((action) => action.phase === 'SELF_UPDATE') ? 'READY_FOR_SELF_UPDATE' : 'VERIFIED',
    journal: currentJournal,
    completed,
    pending_self_update: plan.mutable_actions.some((action) => action.phase === 'SELF_UPDATE'),
  };
}


async function observeDestination(context, action) {
  const target = containedPath(context.destinationRoot, normalizedRelative(action.path));
  try {
    const metadata = await lstat(target);
    if (metadata.isSymbolicLink()) return { state: 'BLOCKED', reason: 'SYMLINK_UNEXPECTED' };
    if (!metadata.isFile()) return { state: 'BLOCKED', reason: 'TYPE_CONFLICT' };
    const bytes = await readFile(target);
    return { state: 'PRESENT', sha256: sha256(bytes), metadata };
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'ABSENT', sha256: null, metadata: null };
    throw error;
  }
}

function setReconciledState(journal, itemId, state, { afterSha256 = null, clock = () => new Date() } = {}) {
  const next = structuredClone(journal);
  const entry = next.entries.find((candidate) => candidate.item_id === itemId);
  entry.state = state;
  entry.after_sha256 = afterSha256;
  entry.error_code = null;
  if (state === 'VERIFIED') entry.completed_at = clock().toISOString();
  else delete entry.completed_at;
  const nonSelf = next.entries.filter((candidate) => candidate.action !== 'SELF_UPDATE');
  next.status = nonSelf.length > 0 && nonSelf.every((candidate) => candidate.state === 'VERIFIED') ? 'VERIFIED' : 'PLANNED';
  return next;
}

function validateReceiptAgainstJournal(receipt, journal) {
  if (!receipt) return;
  if (receipt.operation_id !== journal.operation_id) throw new Error('RECEIPT_OPERATION_MISMATCH');
  for (const action of receipt.actions ?? []) {
    const entry = journal.entries.find((candidate) => candidate.item_id === action.item_id);
    if (!entry || entry.state !== 'VERIFIED' || entry.after_sha256 !== action.after_sha256 || action.verified !== true) throw new Error('RECEIPT_JOURNAL_DIVERGENCE');
  }
}

export async function reconcileResumeState({
  context,
  plan,
  manifest,
  sourceRoot,
  authorization,
  backupManifest = null,
  journal,
  receipt = null,
  clock = () => new Date(),
}) {
  try {
    assertApplyAuthorization({ context, authorization, plan });
    if (journal.operation_id !== context.operation_id || journal.manifest_sha256 !== context.bindings.manifest_sha256 || journal.snapshot_sha256 !== context.bindings.snapshot_sha256) throw new Error('JOURNAL_BINDING_MISMATCH');
    if (journal.status === 'UNKNOWN' || journal.entries.some((entry) => entry.state === 'UNKNOWN')) throw new Error('UNKNOWN_PARTIAL_EFFECT');
    validateReceiptAgainstJournal(receipt, journal);
    if (plan.mutable_actions.some((action) => ['BACKUP_UPDATE', 'BACKUP_RETIRE'].includes(action.action))) await verifyBackupManifest({ context, manifest: backupManifest });
    let reconciled = structuredClone(journal);
    for (const action of plan.mutable_actions.filter((candidate) => candidate.phase !== 'SELF_UPDATE')) {
      const entry = reconciled.entries.find((candidate) => candidate.item_id === action.item_id);
      if (!entry) throw new Error('JOURNAL_ITEM_NOT_FOUND');
      if (action.action !== 'BACKUP_RETIRE') {
        const sourcePath = sourcePathForAction(manifest, action);
        await assertContainedSource(sourceRoot, sourcePath, action.source_sha256);
      }
      const observed = await observeDestination(context, action);
      if (observed.state === 'BLOCKED') throw new Error(observed.reason);
      const applied = action.action === 'BACKUP_RETIRE'
        ? observed.state === 'ABSENT'
        : observed.state === 'PRESENT' && observed.sha256 === action.source_sha256;
      const preState = action.action === 'CREATE'
        ? observed.state === 'ABSENT'
        : observed.state === 'PRESENT' && observed.sha256 === action.before_sha256;
      if (entry.state === 'VERIFIED') {
        if (!applied) throw new Error('VERIFIED_STATE_DIVERGED');
        continue;
      }
      if (['FAILED_KNOWN', 'APPLYING', 'APPLIED'].includes(entry.state)) {
        if (applied) {
          reconciled = setReconciledState(reconciled, action.item_id, 'VERIFIED', { afterSha256: action.action === 'BACKUP_RETIRE' ? null : action.source_sha256, clock });
          continue;
        }
        if (preState) {
          reconciled = setReconciledState(reconciled, action.item_id, ['BACKUP_UPDATE', 'BACKUP_RETIRE'].includes(action.action) ? 'BACKED_UP' : 'PLANNED');
          continue;
        }
        throw new Error('PARTIAL_STATE_NOT_RECONCILABLE');
      }
      if (['PLANNED', 'BACKED_UP'].includes(entry.state) && !preState) throw new Error('SNAPSHOT_DIVERGED');
    }
    validateReceiptAgainstJournal(receipt, reconciled);
    return { decision: 'READY_TO_RESUME', journal: reconciled, errors: [] };
  } catch (error) {
    return { decision: 'BLOCKED', journal: structuredClone(journal), errors: [String(error.message)] };
  }
}

export async function resumeSyntheticPlan(input) {
  const reconciliation = await reconcileResumeState(input);
  if (reconciliation.decision !== 'READY_TO_RESUME') return { status: 'BLOCKED', reconciliation };
  return applySyntheticPlan({ ...input, journal: reconciliation.journal });
}

export async function deriveSyntheticRollbackPlan({ context, plan, backupManifest = null, journal, receipt = null }) {
  try {
    if (journal.operation_id !== context.operation_id) throw new Error('ROLLBACK_OPERATION_MISMATCH');
    if (journal.status === 'UNKNOWN' || journal.entries.some((entry) => entry.state === 'UNKNOWN')) throw new Error('UNKNOWN_PARTIAL_EFFECT');
    validateReceiptAgainstJournal(receipt, journal);
    if (journal.entries.some((entry) => ['BACKUP_UPDATE', 'BACKUP_RETIRE'].includes(entry.action) && ['APPLIED', 'VERIFIED', 'FAILED_KNOWN'].includes(entry.state))) await verifyBackupManifest({ context, manifest: backupManifest });
    const operations = [];
    for (const action of [...plan.mutable_actions].reverse()) {
      const entry = journal.entries.find((candidate) => candidate.item_id === action.item_id);
      if (!entry || !['APPLIED', 'VERIFIED', 'FAILED_KNOWN'].includes(entry.state)) continue;
      const observed = await observeDestination(context, action);
      if (observed.state === 'BLOCKED') throw new Error(observed.reason);
      if (action.action === 'CREATE') {
        if (observed.state !== 'PRESENT' || observed.sha256 !== action.source_sha256) throw new Error('AFTER_HASH_DIVERGED');
        operations.push({ sequence: operations.length + 1, item_id: action.item_id, path: action.path, action: 'REMOVE_CREATED', expected_current_sha256: action.source_sha256, restore_sha256: null, backup_path: null });
      } else if (action.action === 'BACKUP_UPDATE') {
        if (observed.state !== 'PRESENT' || observed.sha256 !== action.source_sha256) throw new Error('AFTER_HASH_DIVERGED');
        const backup = backupEntryFor(backupManifest, action);
        if (!backup?.verified || backup.sha256 !== action.before_sha256) throw new Error('REQUIRED_BACKUP_MISSING');
        operations.push({ sequence: operations.length + 1, item_id: action.item_id, path: action.path, action: 'RESTORE', expected_current_sha256: action.source_sha256, restore_sha256: backup.sha256, backup_path: backup.backup_path, mode: backup.mode, uid: backup.uid, gid: backup.gid });
      } else if (action.action === 'BACKUP_RETIRE') {
        if (observed.state !== 'ABSENT') throw new Error('RETIRED_PATH_REAPPEARED');
        const backup = backupEntryFor(backupManifest, action);
        if (!backup?.verified || backup.sha256 !== action.before_sha256) throw new Error('REQUIRED_BACKUP_MISSING');
        operations.push({ sequence: operations.length + 1, item_id: action.item_id, path: action.path, action: 'RESTORE', expected_current_sha256: null, restore_sha256: backup.sha256, backup_path: backup.backup_path, mode: backup.mode, uid: backup.uid, gid: backup.gid });
      }
    }
    return {
      decision: operations.length > 0 ? 'CHECKPOINT_REQUIRED' : 'NO_CHANGE',
      operation_id: context.operation_id,
      rollback_operation_id: `rollback-${context.operation_id}`,
      bindings: structuredClone(context.bindings),
      operations,
      operations_not_authorized: ['REAL_ROLLBACK', 'GLOBAL_WRITE', 'GIT', 'REMOTE'],
      errors: [],
    };
  } catch (error) {
    return { decision: 'BLOCKED', operation_id: context.operation_id, operations: [], errors: [String(error.message)] };
  }
}

async function restoreMetadata(path, operation) {
  if (process.platform === 'win32') return;
  if (operation.mode != null) await chmod(path, Number.parseInt(operation.mode, 8));
  const metadata = await stat(path);
  if (operation.uid != null && operation.gid != null && (metadata.uid !== operation.uid || metadata.gid !== operation.gid)) await chown(path, operation.uid, operation.gid);
}

export async function rollbackSyntheticPlan({
  context,
  rollbackPlan,
  backupManifest,
  authorization,
  journalStore = null,
  filesystemAdapter = null,
  faultInjector = async () => {},
  clock = () => new Date(),
}) {
  assertInjectedInstallationRoots({ destinationRoot: context.destinationRoot, backupRoot: context.backupRoot });
  if (Boolean(journalStore) !== Boolean(filesystemAdapter)) throw new Error('DURABILITY_CAPABILITIES_MUST_BE_INJECTED_TOGETHER');
  if (authorization?.current !== true || authorization.synthetic !== true || authorization.operation_id !== context.operation_id) throw new Error('ROLLBACK_AUTHORIZATION_REQUIRED');
  if (rollbackPlan.decision !== 'CHECKPOINT_REQUIRED' || rollbackPlan.operation_id !== context.operation_id) throw new Error('ROLLBACK_PLAN_NOT_AUTHORIZED');
  await verifyBackupManifest({ context, manifest: backupManifest });
  const durable = Boolean(journalStore && filesystemAdapter);
  const receiptActions = [];
  let rollbackJournal = {
    schema_version: 1,
    operation_id: rollbackPlan.rollback_operation_id,
    manifest_sha256: context.bindings.manifest_sha256,
    snapshot_sha256: context.bindings.snapshot_sha256,
    status: 'PLANNED',
    entries: rollbackPlan.operations.map((operation) => ({
      sequence: operation.sequence,
      item_id: operation.item_id,
      path: operation.path,
      action: operation.action,
      state: 'PLANNED',
      intent_recorded_at: clock().toISOString(),
      before_sha256: operation.expected_current_sha256,
      after_sha256: null,
      error_code: null,
    })),
  };
  for (const operation of rollbackPlan.operations) {
    try {
      if (durable) {
        await injectLifecycleFault(faultInjector, 'before-intent', operation);
        const intent = await journalStore.recordIntent(rollbackJournal, operation);
        rollbackJournal = intent.journal;
        await injectLifecycleFault(faultInjector, 'after-intent', operation);
      }
      const target = containedPath(context.destinationRoot, normalizedRelative(operation.path));
      const observed = await observeDestination(context, { path: operation.path });
      if (operation.action === 'REMOVE_CREATED') {
        if (observed.state !== 'PRESENT' || observed.sha256 !== operation.expected_current_sha256) throw new Error('AFTER_HASH_DIVERGED');
        if (durable) await injectLifecycleFault(faultInjector, 'before-write', operation);
        await unlink(target);
        if (durable) {
          await injectLifecycleFault(faultInjector, 'after-write', operation);
          await injectLifecycleFault(faultInjector, 'before-sync', operation);
          await filesystemAdapter.syncDirectory(dirname(target));
          await injectLifecycleFault(faultInjector, 'after-sync', operation);
        }
        receiptActions.push({ sequence: operation.sequence, item_id: operation.item_id, path: operation.path, action: 'REMOVE_CREATED', state: 'VERIFIED', before_sha256: operation.expected_current_sha256, after_sha256: null, verified: true });
      } else {
        if (operation.expected_current_sha256 == null) {
          if (observed.state !== 'ABSENT') throw new Error('AFTER_HASH_DIVERGED');
        } else if (observed.state !== 'PRESENT' || observed.sha256 !== operation.expected_current_sha256) throw new Error('AFTER_HASH_DIVERGED');
        const backupEntry = backupManifest.entries.find((entry) => entry.backup_path === operation.backup_path && entry.item_id === operation.item_id);
        if (!backupEntry || backupEntry.sha256 !== operation.restore_sha256) throw new Error('ROLLBACK_BACKUP_MISMATCH');
        const bytes = await readFile(containedPath(context.operationRoot, backupEntry.backup_path));
        if (durable) {
          await atomicReplaceFile({
            fs: filesystemAdapter,
            root: context.destinationRoot,
            relativePath: operation.path,
            bytes,
            expectedSha256: operation.restore_sha256,
            operationId: rollbackPlan.rollback_operation_id,
            sequence: operation.sequence,
            faultInjector: (event) => injectLifecycleFault(faultInjector, event.point, operation),
          });
        } else {
          await atomicReplace({ context, action: { sequence: operation.sequence, path: operation.path, source_sha256: operation.restore_sha256 }, bytes });
        }
        await restoreMetadata(target, operation);
        if (sha256(await readFile(target)) !== operation.restore_sha256) throw new Error('ROLLBACK_VERIFICATION_FAILED');
        receiptActions.push({ sequence: operation.sequence, item_id: operation.item_id, path: operation.path, action: 'RESTORE', state: 'VERIFIED', before_sha256: operation.expected_current_sha256, after_sha256: operation.restore_sha256, verified: true });
      }
      const entry = rollbackJournal.entries.find((candidate) => candidate.item_id === operation.item_id);
      entry.state = 'VERIFIED';
      entry.after_sha256 = receiptActions.at(-1).after_sha256;
      rollbackJournal.status = rollbackJournal.entries.every((candidate) => candidate.state === 'VERIFIED') ? 'VERIFIED' : 'APPLYING';
      await appendDurableJournal(journalStore, rollbackJournal, { type: 'ROLLBACK_VERIFIED', item_id: operation.item_id });
    } catch (error) {
      if (!durable) throw error;
      const classification = error?.unknown === true ? 'UNKNOWN' : error?.lifecyclePoint ? classifyFaultBoundary(error.lifecyclePoint) : 'FAILED_KNOWN';
      const entry = rollbackJournal.entries.find((candidate) => candidate.item_id === operation.item_id);
      entry.state = classification;
      entry.error_code = String(error?.code ?? error?.message ?? 'ROLLBACK_FAILED').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 64);
      rollbackJournal.status = classification;
      if (['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN'].includes(classification)) rollbackJournal.reconciliation = { status: 'UNRECONCILED', observed_at: clock().toISOString() };
      await appendDurableJournal(journalStore, rollbackJournal, { type: 'ROLLBACK_FAILURE', item_id: operation.item_id, failure_point: error?.lifecyclePoint ?? null });
      return Object.freeze({ status: classification, journal: rollbackJournal, actions: receiptActions, error_code: entry.error_code });
    }
  }
  return {
    schema_version: 1,
    operation_id: rollbackPlan.rollback_operation_id,
    manifest_sha256: context.bindings.manifest_sha256,
    lock_sha256: context.bindings.lock_sha256,
    package_sha256: context.bindings.package_sha256,
    snapshot_sha256: context.bindings.snapshot_sha256,
    status: 'ROLLED_BACK',
    pending_action: null,
    actions: receiptActions,
    actions_not_executed: ['REAL_ROLLBACK', 'GLOBAL_WRITE', 'GIT', 'REMOTE'],
  };
}


export function createSyntheticWriteGuard() {
  let closed = false;
  const writes = [];
  return {
    record(path) {
      if (closed) throw new Error('HARD_STOP_RESTART_REQUIRED');
      writes.push(path);
    },
    close() { closed = true; },
    get closed() { return closed; },
    get writes() { return [...writes]; },
  };
}

export async function applySyntheticSelfUpdate({
  context,
  plan,
  manifest,
  sourceRoot,
  authorization,
  backupManifest,
  journal,
  journalStore = null,
  filesystemAdapter = null,
  faultInjector = async () => {},
  clock = () => new Date(),
  writeGuard = createSyntheticWriteGuard(),
}) {
  if (Boolean(journalStore) !== Boolean(filesystemAdapter)) throw new Error('DURABILITY_CAPABILITIES_MUST_BE_INJECTED_TOGETHER');
  assertApplyAuthorization({ context, authorization, plan });
  const selfActions = plan.mutable_actions.filter((action) => action.phase === 'SELF_UPDATE');
  if (selfActions.length !== 1) throw new Error('EXACTLY_ONE_SELF_UPDATE_REQUIRED');
  const action = selfActions[0];
  if (plan.actions.at(-1)?.item_id !== action.item_id || action.item_id !== 'skill-bootstrap') throw new Error('SELF_UPDATE_NOT_LAST');
  const nonSelfEntries = journal.entries.filter((entry) => entry.action !== 'SELF_UPDATE');
  if (!nonSelfEntries.every((entry) => entry.state === 'VERIFIED')) throw new Error('PRE_SELF_UPDATE_NOT_VERIFIED');
  const selfEntry = journal.entries.find((entry) => entry.item_id === action.item_id);
  if (!selfEntry || !['PLANNED', 'BACKED_UP'].includes(selfEntry.state)) throw new Error('SELF_UPDATE_STATE_INVALID');
  await verifyBackupManifest({ context, manifest: backupManifest });
  const backup = backupEntryFor(backupManifest, action);
  if (!backup?.verified || backup.sha256 !== action.before_sha256) throw new Error('REQUIRED_BACKUP_MISSING');
  await assertCurrentActionPrestate(context, action);
  const sourcePath = sourcePathForAction(manifest, action);
  const bytes = await assertContainedSource(sourceRoot, sourcePath, action.source_sha256);
  let currentJournal = structuredClone(journal);
  const durable = Boolean(journalStore && filesystemAdapter);
  try {
    if (durable) {
      await injectLifecycleFault(faultInjector, 'before-intent', action);
      const intent = await journalStore.recordIntent(currentJournal, action);
      currentJournal = intent.journal;
      await injectLifecycleFault(faultInjector, 'after-intent', action);
    }
    currentJournal = transitionJournalEntry(currentJournal, { itemId: action.item_id, to: 'APPLYING', clock });
    await appendDurableJournal(journalStore, currentJournal, { type: 'SELF_UPDATE_APPLYING', item_id: action.item_id });
    writeGuard.record(action.path);
    if (durable) {
      await atomicReplaceFile({
        fs: filesystemAdapter,
        root: context.destinationRoot,
        relativePath: action.path,
        bytes,
        expectedSha256: action.source_sha256,
        operationId: context.operation_id,
        sequence: action.sequence,
        faultInjector: (event) => injectLifecycleFault(faultInjector, event.point, action),
      });
    } else {
      await atomicReplace({ context, action, bytes });
    }
    currentJournal = transitionJournalEntry(currentJournal, { itemId: action.item_id, to: 'APPLIED', afterSha256: action.source_sha256, clock });
    await appendDurableJournal(journalStore, currentJournal, { type: 'SELF_UPDATE_APPLIED', item_id: action.item_id, after_sha256: action.source_sha256 });
    currentJournal = transitionJournalEntry(currentJournal, { itemId: action.item_id, to: 'VERIFIED', afterSha256: action.source_sha256, clock });
    await appendDurableJournal(journalStore, currentJournal, { type: 'SELF_UPDATE_VERIFIED', item_id: action.item_id, after_sha256: action.source_sha256 });
  } catch (error) {
    currentJournal = markFailure(currentJournal, action, error, clock, { durable });
    await appendDurableJournal(journalStore, currentJournal, { type: 'SELF_UPDATE_FAILURE', item_id: action.item_id, failure_point: error?.lifecyclePoint ?? null, status: currentJournal.status });
    return Object.freeze({
      status: currentJournal.status,
      item_id: action.item_id,
      hard_stop: true,
      writes: writeGuard.writes,
      journal: currentJournal,
      error_code: currentJournal.entries.find((entry) => entry.item_id === action.item_id).error_code,
      actions_not_executed: ['POST_RESTART_VALIDATION', 'RECEIPT_FINALIZATION', 'PROJECT_UPDATE', 'REAL_PILOT', 'GIT', 'REMOTE'],
    });
  }
  writeGuard.close();
  return Object.freeze({
    status: 'RESTART_REQUIRED',
    item_id: action.item_id,
    path: action.path,
    sha256: action.source_sha256,
    hard_stop: true,
    writes: writeGuard.writes,
    journal: currentJournal,
    actions_not_executed: ['POST_RESTART_VALIDATION', 'RECEIPT_FINALIZATION', 'PROJECT_UPDATE', 'REAL_PILOT', 'GIT', 'REMOTE'],
  });
}

export function modelPostRestartValidation({ expectedManagedFiles = 64, expectedSkills = 10, expectedLegacyAbsences = 9 } = {}) {
  return Object.freeze({
    status: 'NOT_EXECUTED',
    requires_new_execution: true,
    requires_real_restart: true,
    mode: 'READ_ONLY_RECONCILIATION',
    checks: [
      'NEW_PROCESS_AND_SESSION_CONFIRMED',
      'SELF_UPDATE_RECONCILED',
      `${expectedManagedFiles}_MANAGED_PATHS_HASHES_METADATA`,
      'RELATIVE_REFERENCES_RESOLVE',
      'AGENTIC_WORKFLOW_LOADER_OBSERVED',
      `${expectedSkills}_SKILLS_DISCOVERABLE`,
      `${expectedLegacyAbsences}_LEGACY_PATHS_ABSENT`,
      'MIXED_AUTHORITY_ABSENT',
      `${expectedManagedFiles}_NO_CHANGE_ZERO_MUTATION`,
      'ROLLBACK_VERIFIED_NOT_EXECUTED',
      'FINAL_RECEIPT_AFTER_DIRECT_OBSERVATION',
    ],
    operations_not_authorized: ['GLOBAL_WRITE', 'RESTART', 'PROJECT_UPDATE', 'REAL_PILOT', 'ROLLBACK', 'GIT', 'REMOTE'],
  });
}
