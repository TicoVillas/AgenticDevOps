import { containedLifecyclePath } from './paths.mjs';
import { createHash } from 'node:crypto';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

async function observe(fs, root, action) {
  const target = containedLifecyclePath(root, action.path);
  try {
    const metadata = await fs.lstat(target);
    if (metadata.isSymbolicLink()) return { state: 'BLOCKED', reason_code: 'SYMLINK_UNEXPECTED' };
    if (!metadata.isFile()) return { state: 'BLOCKED', reason_code: 'TYPE_CONFLICT' };
    return { state: 'PRESENT', sha256: sha256(await fs.readFile(target)) };
  } catch (error) {
    if (error.code === 'ENOENT') return { state: 'ABSENT', sha256: null };
    throw error;
  }
}

export async function reconcileUncertainReadOnly({ fs, destinationRoot, plan, journal, clock = () => new Date() }) {
  const observations = [];
  for (const entry of journal.entries.filter((candidate) => ['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN', 'APPLYING', 'APPLIED', 'FAILED_KNOWN'].includes(candidate.state))) {
    const action = plan.mutable_actions.find((candidate) => candidate.item_id === entry.item_id);
    if (!action) return Object.freeze({ decision: 'BLOCKED', reason_code: 'JOURNAL_PLAN_DIVERGED', read_only: true, observations });
    const observed = await observe(fs, destinationRoot, action);
    const applied = action.action === 'BACKUP_RETIRE' ? observed.state === 'ABSENT' : observed.state === 'PRESENT' && observed.sha256 === action.source_sha256;
    const before = action.action === 'CREATE' ? observed.state === 'ABSENT' : observed.state === 'PRESENT' && observed.sha256 === action.before_sha256;
    const classification = observed.state === 'BLOCKED' ? 'BLOCKED' : applied ? 'APPLIED_VERIFIED' : before ? 'NO_EFFECT_VERIFIED' : 'UNRECONCILABLE';
    observations.push({ item_id: entry.item_id, path: entry.path, classification, observed_sha256: observed.sha256, observed_at: clock().toISOString() });
  }
  const blocked = observations.some((entry) => ['BLOCKED', 'UNRECONCILABLE'].includes(entry.classification));
  return Object.freeze({
    decision: blocked ? 'BLOCKED' : 'RECONCILED_REQUIRES_NEW_AUTHORIZATION',
    reason_code: blocked ? 'STATE_NOT_RECONCILABLE' : 'NEW_AUTHORIZATION_REQUIRED',
    read_only: true,
    writer_release_authorized: false,
    resume_authorized: false,
    rollback_authorized: false,
    observations,
    operations_not_authorized: ['WRITE', 'RETRY', 'RESUME', 'ROLLBACK', 'PURGE', 'LOCK_RELEASE'],
  });
}

export function assertNoBlindRetry({ journal, reconciliation, authorizationValidated }) {
  const uncertain = journal.status === 'UNKNOWN' || journal.status === 'PARTIAL' || journal.status === 'PARTIAL_KNOWN' || journal.entries.some((entry) => ['UNKNOWN', 'PARTIAL', 'PARTIAL_KNOWN'].includes(entry.state));
  if (!uncertain) return true;
  if (reconciliation?.decision !== 'RECONCILED_REQUIRES_NEW_AUTHORIZATION') throw Object.assign(new Error('BLIND_RETRY_PROHIBITED'), { code: 'BLIND_RETRY_PROHIBITED' });
  if (authorizationValidated !== true) throw Object.assign(new Error('NEW_AUTHORIZATION_REQUIRED'), { code: 'NEW_AUTHORIZATION_REQUIRED' });
  return true;
}

export function assertPurgeAllowed({ journal, reconciliation }) {
  if (journal.status === 'UNKNOWN' || journal.status === 'PARTIAL' || journal.status === 'PARTIAL_KNOWN' || reconciliation?.decision !== 'RECONCILED_REQUIRES_NEW_AUTHORIZATION') throw Object.assign(new Error('UNCERTAIN_STATE_PURGE_PROHIBITED'), { code: 'UNCERTAIN_STATE_PURGE_PROHIBITED' });
  return true;
}
