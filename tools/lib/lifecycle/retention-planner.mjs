import { canonicalSha256 } from '../canonical-json.mjs';
import { loadRetentionPolicy, retentionDecision } from '../retention.mjs';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export async function planLifecycleRetention({
  policyRoot,
  records,
  now = new Date(),
  policyLoader = loadRetentionPolicy,
} = {}) {
  if (!policyRoot) fail('RETENTION_POLICY_ROOT_REQUIRED');
  if (!Array.isArray(records)) fail('RETENTION_RECORDS_REQUIRED');
  const policy = await policyLoader(policyRoot);
  const ids = new Set();
  const actions = records.map((record) => {
    if (!record || typeof record.id !== 'string' || record.id.length === 0) fail('RETENTION_RECORD_ID_REQUIRED');
    if (ids.has(record.id)) fail('DUPLICATE_RETENTION_RECORD_ID');
    ids.add(record.id);
    const decision = retentionDecision(record, policy, { now });
    return Object.freeze({
      record_id: record.id,
      kind: record.kind ?? null,
      retention_class: record.retention_class ?? null,
      decision: decision.retain ? 'RETAIN' : 'ELIGIBLE_FOR_SEPARATELY_AUTHORIZED_PURGE',
      reason_code: decision.reason,
      destructive_action_authorized: false,
    });
  }).sort((left, right) => left.record_id.localeCompare(right.record_id));
  return Object.freeze({
    schema_version: 1,
    created_at: now.toISOString(),
    policy_source: 'policies/OperationalRetentionPolicy.md',
    policy_sha256: canonicalSha256(policy),
    records_sha256: canonicalSha256(records),
    decision: actions.some((action) => action.decision === 'ELIGIBLE_FOR_SEPARATELY_AUTHORIZED_PURGE') ? 'REVIEW_ELIGIBLE_RECORDS' : 'RETAIN_ALL',
    read_only: true,
    actions,
    operations_not_authorized: ['PURGE', 'DELETE', 'AUTO_REMOVE', 'REAL_GLOBAL_WRITE', 'HOME_ACCESS'],
  });
}

export function assertRetentionPlanIsReadOnly(plan) {
  if (plan?.read_only !== true || plan?.actions?.some((action) => action.destructive_action_authorized !== false)) fail('RETENTION_PLAN_MUTATION_PROHIBITED');
  if (!plan.operations_not_authorized?.includes('PURGE')) fail('RETENTION_PURGE_BOUNDARY_MISSING');
  return true;
}
