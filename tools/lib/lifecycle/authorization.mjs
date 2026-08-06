import { canonicalSha256 } from '../canonical-json.mjs';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function instant(value, code) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) fail(code);
  return time;
}

export function operationScopeBinding({ destinationRootId, destinationSnapshot, stateSnapshot }) {
  return Object.freeze({
    destination_root_id: destinationRootId,
    destination_root_sha256: canonicalSha256(destinationSnapshot),
    state_root_sha256: canonicalSha256(stateSnapshot),
  });
}

export function planBinding(plan) {
  return canonicalSha256(plan);
}

export function validateAuthorizationEnvelope(envelope, expected, { now = new Date() } = {}) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) fail('AUTHORIZATION_REQUIRED');
  if (envelope.status !== 'EXPLICITLY_AUTHORIZED' || envelope.provenance !== 'DIRECT_USER_AUTHORIZATION' || envelope.synthetic_only !== true) fail('AUTHORIZATION_NOT_EXPLICIT');
  if (envelope.operation_id !== expected.operation_id || envelope.operation_class !== expected.operation_class) fail('AUTHORIZATION_OPERATION_MISMATCH');
  const nowTime = now instanceof Date ? now.getTime() : Number.NaN;
  const issued = instant(envelope.issued_at, 'AUTHORIZATION_ISSUED_AT_INVALID');
  const expires = instant(envelope.expires_at, 'AUTHORIZATION_EXPIRES_AT_INVALID');
  if (!Number.isFinite(nowTime) || issued > nowTime || expires <= nowTime || expires <= issued) fail('AUTHORIZATION_EXPIRED');
  if (!Array.isArray(envelope.operations) || !envelope.operations.includes(expected.required_operation)) fail('AUTHORIZATION_OPERATION_NOT_GRANTED');
  for (const field of ['destination_root_id', 'destination_root_sha256', 'state_root_sha256']) if (envelope.scope?.[field] !== expected.scope?.[field]) fail('AUTHORIZATION_SCOPE_DIVERGED');
  for (const field of ['plan_sha256', 'snapshot_sha256', 'source_sha256', 'manifest_sha256', 'lock_sha256']) if (envelope.bindings?.[field] !== expected.bindings?.[field]) fail(field === 'snapshot_sha256' ? 'SNAPSHOT_DIVERGED' : `${field.toUpperCase()}_DIVERGED`);
  return Object.freeze({ ok: true, authorization_id: envelope.authorization_id, expires_at: envelope.expires_at });
}

export function assertFreshContinuationAuthority(envelope, expected, options) {
  const result = validateAuthorizationEnvelope(envelope, expected, options);
  if (!['RESUME', 'ROLLBACK', 'UNINSTALL'].includes(expected.required_operation)) fail('CONTINUATION_AUTHORITY_CLASS_INVALID');
  if (envelope.operations.includes('APPLY') && expected.required_operation !== 'UNINSTALL') fail('INHERITED_APPLY_AUTHORITY_PROHIBITED');
  return result;
}
