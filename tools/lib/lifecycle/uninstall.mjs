import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../canonical-json.mjs';
import { containedLifecyclePath } from './paths.mjs';
import { classifyFaultBoundary } from './state-store.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

async function injectFault(faultInjector, point, action) {
  try {
    await faultInjector({ point, action: structuredClone(action) });
  } catch (error) {
    error.lifecyclePoint ??= point;
    throw error;
  }
}

async function observe(fs, destinationRoot, path) {
  const absolute = containedLifecyclePath(destinationRoot, path);
  try {
    const metadata = await fs.lstat(absolute);
    if (metadata.isSymbolicLink()) return { state: 'BLOCKED', reason_code: 'SYMLINK_UNEXPECTED' };
    if (!metadata.isFile()) return { state: 'BLOCKED', reason_code: 'TYPE_CONFLICT' };
    const bytes = await fs.readFile(absolute);
    return { state: 'PRESENT', sha256: sha256(bytes), bytes, size: bytes.length };
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'ABSENT', sha256: null };
    throw error;
  }
}

export async function planUninstall({ fs, destinationRoot, receipt, receiptSha256, operationId, clock = () => new Date() }) {
  if (!receipt || !Array.isArray(receipt.actions)) fail('INSTALLATION_RECEIPT_REQUIRED');
  if (canonicalSha256(receipt) !== receiptSha256) fail('INSTALLATION_RECEIPT_DIVERGED');
  const managed = receipt.actions.filter((action) => action.verified === true && action.after_sha256 && !action.item_id?.startsWith('retire:'));
  const actions = [];
  for (const action of managed.sort((a, b) => a.path.localeCompare(b.path))) {
    const observation = await observe(fs, destinationRoot, action.path);
    const kind = observation.state === 'BLOCKED' ? 'BLOCKED'
      : observation.state === 'ABSENT' ? 'NO_EFFECT'
        : observation.sha256 === action.after_sha256 ? 'REMOVE_MANAGED'
          : 'PRESERVE_USER_MODIFIED';
    actions.push({ sequence: actions.length + 1, item_id: action.item_id, path: action.path, action: kind, installed_sha256: action.after_sha256, observed_sha256: observation.sha256, before_sha256: observation.sha256 });
  }
  const blocked = actions.filter((action) => action.action === 'BLOCKED');
  return Object.freeze({
    schema_version: 1,
    operation_id: operationId,
    operation_class: 'UNINSTALL',
    created_at: clock().toISOString(),
    installation_receipt_sha256: receiptSha256,
    decision: blocked.length ? 'BLOCKED' : actions.some((action) => action.action === 'REMOVE_MANAGED') ? 'CHECKPOINT_REQUIRED' : 'NO_CHANGE',
    actions,
    preserved_paths: actions.filter((action) => action.action === 'PRESERVE_USER_MODIFIED').map((action) => action.path),
    stop_conditions: ['SNAPSHOT_DIVERGED', 'UNKNOWN_PATH', 'SYMLINK_UNEXPECTED', 'USER_MODIFIED_CONTENT'],
    operations_not_authorized: ['RECURSIVE_DELETE', 'UNMANAGED_DELETE', 'REAL_GLOBAL_WRITE', 'PURGE'],
  });
}

export async function applyUninstall({ fs, destinationRoot, operationRoot, plan, authorizationValidated, journalStore, clock = () => new Date(), faultInjector = async () => {} }) {
  if (authorizationValidated !== true) fail('UNINSTALL_AUTHORIZATION_REQUIRED');
  if (plan.decision === 'BLOCKED') fail('UNINSTALL_PLAN_BLOCKED');
  const removed = [];
  const preserved = [...plan.preserved_paths];
  let journal = { schema_version: 1, operation_id: plan.operation_id, manifest_sha256: plan.installation_receipt_sha256, snapshot_sha256: canonicalSha256(plan.actions), status: 'PLANNED', entries: [] };
  for (const action of plan.actions) {
    if (action.action !== 'REMOVE_MANAGED') continue;
    const entry = { sequence: action.sequence, item_id: action.item_id, path: action.path, action: 'BACKUP_RETIRE', state: 'PLANNED', intent_recorded_at: clock().toISOString(), before_sha256: action.installed_sha256, after_sha256: null, error_code: null };
    journal.entries.push(entry);
    try {
      const observation = await observe(fs, destinationRoot, action.path);
      if (observation.state !== 'PRESENT' || observation.sha256 !== action.installed_sha256) fail('SNAPSHOT_DIVERGED');
      await injectFault(faultInjector, 'before-intent', action);
      const durable = await journalStore.recordIntent(journal, entry);
      journal = durable.journal;
      await injectFault(faultInjector, 'after-intent', action);
      const backupPath = containedLifecyclePath(containedLifecyclePath(operationRoot, 'artifacts'), `uninstall-backup-${String(action.sequence).padStart(6, '0')}.bin`);
      await fs.writeFile(backupPath, observation.bytes, { flag: 'wx', mode: 0o600 });
      await fs.syncFile(backupPath);
      await fs.syncDirectory(fs.dirname(backupPath));
      if (sha256(await fs.readFile(backupPath)) !== action.installed_sha256) fail('UNINSTALL_BACKUP_VERIFICATION_FAILED');
      await injectFault(faultInjector, 'before-write', action);
      await fs.unlink(containedLifecyclePath(destinationRoot, action.path));
      await injectFault(faultInjector, 'after-write', action);
      await injectFault(faultInjector, 'before-sync', action);
      await fs.syncDirectory(fs.dirname(containedLifecyclePath(destinationRoot, action.path)));
      await injectFault(faultInjector, 'after-sync', action);
      const after = await observe(fs, destinationRoot, action.path);
      if (after.state !== 'ABSENT') fail('UNINSTALL_REMOVE_VERIFICATION_FAILED');
      const durableEntry = journal.entries.find((candidate) => candidate.item_id === action.item_id);
      if (!durableEntry) fail('JOURNAL_ITEM_NOT_FOUND');
      durableEntry.state = 'VERIFIED';
      journal.status = 'APPLYING';
      removed.push(action.path);
      await journalStore.append(journal, { type: 'UNINSTALL', path: action.path, backup_sha256: action.installed_sha256 });
    } catch (error) {
      const classification = error?.unknown === true ? 'UNKNOWN' : error?.lifecyclePoint ? classifyFaultBoundary(error.lifecyclePoint) : 'FAILED_KNOWN';
      const durableEntry = journal.entries.find((candidate) => candidate.item_id === action.item_id);
      durableEntry.state = classification;
      durableEntry.error_code = String(error?.code ?? error?.message ?? 'UNINSTALL_FAILED').toUpperCase().replace(/[^A-Z0-9_]/g, '_').slice(0, 64);
      journal.status = classification;
      if (['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN'].includes(classification)) journal.reconciliation = { status: 'UNRECONCILED', observed_at: clock().toISOString() };
      await journalStore.append(journal, { type: 'UNINSTALL_FAILURE', path: action.path, failure_point: error?.lifecyclePoint ?? null });
      return Object.freeze({ status: classification, journal, tombstone: null, removed_paths: removed, preserved_paths: preserved, error_code: durableEntry.error_code });
    }
  }
  journal.status = 'COMPLETED';
  await journalStore.append(journal, { type: 'OPERATION_COMPLETED', removed_paths: removed });
  const tombstone = Object.freeze({
    schema_version: 1,
    operation_id: plan.operation_id,
    operation_class: 'UNINSTALL',
    plan_sha256: canonicalSha256(plan),
    journal_sha256: canonicalSha256(journal),
    created_at: clock().toISOString(),
    outcome: 'COMPLETED',
    retention_class: 'INDEFINITE',
    removed_paths: removed,
    preserved_paths: preserved,
    reconciliation_status: 'RECONCILED',
  });
  return Object.freeze({ status: removed.length ? 'COMPLETED' : 'NO_EFFECT', journal, tombstone, removed_paths: removed, preserved_paths: preserved });
}
