import { canonicalJsonBytes, canonicalSha256 } from '../canonical-json.mjs';
import { containedLifecyclePath } from './paths.mjs';

function fail(code, detail = null) {
  const error = new Error(code);
  error.code = code;
  if (detail !== null) error.detail = detail;
  throw error;
}

async function assertDirectory(fs, path, { mustExist = true } = {}) {
  try {
    const metadata = await fs.lstat(path);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) fail('UNSAFE_STATE_ROOT');
    return metadata;
  } catch (error) {
    if (error.code !== 'ENOENT' || mustExist) throw error;
    return null;
  }
}

async function durableCreate(fs, path, bytes, { mode = 0o600 } = {}) {
  await fs.writeFile(path, bytes, { flag: 'wx', mode });
  await fs.syncFile(path);
  await fs.syncDirectory(fs.dirname(path));
}

export function operationLockName({ destinationRootId }) {
  return `${canonicalSha256({ destination_root_id: destinationRootId })}.lock.json`;
}

export async function initializeOperationState({ fs, stateRoot, operationId }) {
  await assertDirectory(fs, stateRoot);
  const operationsRoot = containedLifecyclePath(stateRoot, 'operations');
  await fs.mkdir(operationsRoot, { recursive: true, mode: 0o700 });
  await assertDirectory(fs, operationsRoot);
  const operationRoot = containedLifecyclePath(operationsRoot, operationId);
  try {
    await fs.mkdir(operationRoot, { recursive: false, mode: 0o700 });
  } catch (error) {
    if (error.code === 'EEXIST') fail('OPERATION_STATE_ALREADY_EXISTS');
    throw error;
  }
  for (const name of ['journal', 'artifacts', 'staging', 'evidence']) await fs.mkdir(containedLifecyclePath(operationRoot, name), { mode: 0o700 });
  return Object.freeze({ stateRoot, operationRoot });
}

export async function acquireOperationLock({ fs, stateRoot, operationId, operationClass, destinationRootId = 'SYNTHETIC_KIRO_ROOT', sessionId, processId, clock = () => new Date(), isProcessActive = () => true }) {
  await assertDirectory(fs, stateRoot);
  const locksRoot = containedLifecyclePath(stateRoot, 'locks');
  await fs.mkdir(locksRoot, { recursive: true, mode: 0o700 });
  await assertDirectory(fs, locksRoot);
  const path = containedLifecyclePath(locksRoot, operationLockName({ destinationRootId, operationClass }));
  const lock = {
    schema_version: 1,
    lock_id: `lock-${operationId}`,
    operation_id: operationId,
    operation_class: operationClass,
    destination_root_id: destinationRootId,
    holder: { process_id: processId, session_id: sessionId },
    acquired_at: clock().toISOString(),
    heartbeat_at: clock().toISOString(),
    state: 'ACTIVE',
    break_authorized: false,
  };
  try {
    await durableCreate(fs, path, canonicalJsonBytes(lock));
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let existing;
    try { existing = JSON.parse(await fs.readFile(path, 'utf8')); } catch { fail('OPERATION_LOCK_UNREADABLE'); }
    if (existing.state === 'ACTIVE' && isProcessActive(existing.holder?.process_id)) fail('ACTIVE_OPERATION_LOCK');
    fail('STALE_LOCK_RECONCILIATION_REQUIRED', { operation_id: existing.operation_id, state: 'STALE_OBSERVED' });
  }
  return Object.freeze({ path, lock });
}

export async function observeOperationLock({ fs, stateRoot, operationClass, destinationRootId = 'SYNTHETIC_KIRO_ROOT', isProcessActive = () => false }) {
  const path = containedLifecyclePath(containedLifecyclePath(stateRoot, 'locks'), operationLockName({ destinationRootId, operationClass }));
  try {
    const lock = JSON.parse(await fs.readFile(path, 'utf8'));
    return Object.freeze({ present: true, path, state: lock.state === 'ACTIVE' && isProcessActive(lock.holder?.process_id) ? 'ACTIVE' : 'STALE_OBSERVED', lock, removal_authorized: false });
  } catch (error) {
    if (error.code === 'ENOENT') return Object.freeze({ present: false, path, state: 'ABSENT', lock: null, removal_authorized: false });
    throw error;
  }
}

export async function releaseOperationLock({ fs, lockHandle, operationRoot, outcome, reconciliationStatus }) {
  if (['UNKNOWN', 'PARTIAL', 'PARTIAL_KNOWN'].includes(outcome) || reconciliationStatus === 'UNRECONCILED') fail('UNCERTAIN_LOCK_MUST_REMAIN');
  const released = { ...lockHandle.lock, state: 'RELEASED' };
  const releasePath = containedLifecyclePath(containedLifecyclePath(operationRoot, 'evidence'), 'released-lock.json');
  await durableCreate(fs, releasePath, canonicalJsonBytes(released));
  await fs.rename(lockHandle.path, `${lockHandle.path}.released-${lockHandle.lock.operation_id}`);
  await fs.syncDirectory(fs.dirname(lockHandle.path));
  return Object.freeze({ released: true, evidence_sha256: canonicalSha256(released) });
}

export function createDurableJournalStore({ fs, operationRoot, startSequence = 0 }) {
  if (!Number.isInteger(startSequence) || startSequence < 0) fail('INVALID_DURABLE_SEQUENCE');
  let sequence = startSequence;
  const append = async (journal, event = {}) => {
    sequence += 1;
    const record = { schema_version: 1, durable_sequence: sequence, event, journal };
    const path = containedLifecyclePath(containedLifecyclePath(operationRoot, 'journal'), `${String(sequence).padStart(6, '0')}.json`);
    await durableCreate(fs, path, canonicalJsonBytes(record));
    return Object.freeze({ sequence, path, sha256: canonicalSha256(record), fsynced: true });
  };
  return Object.freeze({
    append,
    async recordIntent(journal, action) {
      const next = structuredClone(journal);
      const entry = next.entries.find((candidate) => candidate.item_id === action.item_id);
      if (!entry) fail('JOURNAL_ITEM_NOT_FOUND');
      entry.intent_fsynced = true;
      next.durable_sequence = sequence + 1;
      next.fsync_evidence = { intent_fsynced_through: action.sequence, journal_fsynced: true };
      next.reconciliation = { status: 'NOT_REQUIRED', observed_at: entry.intent_recorded_at };
      const durable = await append(next, { type: 'INTENT', item_id: action.item_id, failure_point: null });
      return { journal: next, durable };
    },
    get sequence() { return sequence; },
  });
}

export async function writeDurableArtifact({ fs, operationRoot, name, document }) {
  const path = containedLifecyclePath(containedLifecyclePath(operationRoot, 'artifacts'), name);
  await durableCreate(fs, path, canonicalJsonBytes(document));
  return Object.freeze({ path, sha256: canonicalSha256(document), fsynced: true });
}

export function classifyFaultBoundary(point, { unknown = false } = {}) {
  if (unknown) return 'UNKNOWN';
  if (point === 'before-intent') return 'NO_EFFECT';
  if (['after-intent', 'before-write', 'after-stage-write', 'before-sync', 'after-sync', 'before-rename'].includes(point)) return 'PARTIAL_KNOWN';
  if (['after-write', 'after-rename', 'before-receipt', 'after-receipt'].includes(point)) return 'PARTIAL';
  return 'UNKNOWN';
}
