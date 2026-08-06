import { canonicalSha256 } from '../canonical-json.mjs';
import { planBinding } from '../lifecycle/authorization.mjs';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function instant(value, code) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail(code);
  return parsed;
}

export function assertProjectOperationId(value) {
  if (typeof value !== 'string' || !/^project-(?!(?:checkpoint|authorization|receipt)-)[A-Za-z0-9._-]{1,120}$/.test(value)) fail('PROJECT_OPERATION_ID_INVALID');
  return value;
}

export function assertProjectIdentityNamespaces({ operationId, checkpointId = null, authorizationId = null, receiptId = null }) {
  assertProjectOperationId(operationId);
  const identities = [operationId];
  const checks = [
    [checkpointId, /^project-checkpoint-[A-Za-z0-9._-]{1,112}$/, 'PROJECT_CHECKPOINT_ID_INVALID'],
    [authorizationId, /^project-authorization-[A-Za-z0-9._-]{1,109}$/, 'PROJECT_AUTHORIZATION_ID_INVALID'],
    [receiptId, /^project-receipt-[A-Za-z0-9._-]{1,115}$/, 'PROJECT_RECEIPT_ID_INVALID'],
  ];
  for (const [value, pattern, code] of checks) {
    if (value === null) continue;
    if (typeof value !== 'string' || !pattern.test(value)) fail(code);
    identities.push(value);
  }
  if (new Set(identities).size !== identities.length) fail('PROJECT_IDENTITY_COLLISION');
  return true;
}

export function projectPlanSha256(plan) {
  return planBinding(plan);
}

export function projectBindings({ plan, snapshotSha256, projectRootSha256, backupManifestSha256 = null }) {
  const bindings = {
    plan_sha256: projectPlanSha256(plan),
    snapshot_sha256: snapshotSha256,
    project_root_sha256: projectRootSha256,
  };
  if (backupManifestSha256 !== null) bindings.backup_manifest_sha256 = backupManifestSha256;
  return Object.freeze(bindings);
}

export function createProjectCheckpoint({ checkpointId, operationId, bindings, clock = () => new Date(), expiresAt }) {
  assertProjectIdentityNamespaces({ operationId, checkpointId });
  const issued = clock();
  const expires = new Date(expiresAt);
  if (!(issued instanceof Date) || !Number.isFinite(issued.getTime()) || !Number.isFinite(expires.getTime()) || expires <= issued) fail('PROJECT_CHECKPOINT_TIME_INVALID');
  return Object.freeze({
    schema_version: 1,
    checkpoint_id: checkpointId,
    operation_id: operationId,
    issued_at: issued.toISOString(),
    expires_at: expires.toISOString(),
    status: 'EXPLICITLY_CHECKPOINTED',
    provenance: 'DIRECT_USER_CHECKPOINT',
    synthetic_only: true,
    bindings,
    operations: ['APPLY'],
  });
}

export function createProjectAuthorization({ authorizationId, operationId, operationClass, checkpointId = null, bindings, operations, clock = () => new Date(), expiresAt }) {
  assertProjectIdentityNamespaces({ operationId, checkpointId, authorizationId });
  const issued = clock();
  const expires = new Date(expiresAt);
  if (!(issued instanceof Date) || !Number.isFinite(issued.getTime()) || !Number.isFinite(expires.getTime()) || expires <= issued) fail('PROJECT_AUTHORIZATION_TIME_INVALID');
  return Object.freeze({
    schema_version: 1,
    authorization_id: authorizationId,
    operation_id: operationId,
    operation_class: operationClass,
    checkpoint_id: checkpointId,
    issued_at: issued.toISOString(),
    expires_at: expires.toISOString(),
    status: 'EXPLICITLY_AUTHORIZED',
    provenance: 'DIRECT_USER_AUTHORIZATION',
    synthetic_only: true,
    bindings,
    operations: [...operations],
  });
}

function validateTime(document, now, prefix) {
  const current = now instanceof Date ? now.getTime() : Number.NaN;
  const issued = instant(document.issued_at, `${prefix}_ISSUED_AT_INVALID`);
  const expires = instant(document.expires_at, `${prefix}_EXPIRES_AT_INVALID`);
  if (!Number.isFinite(current) || issued > current || expires <= current || expires <= issued) fail(`${prefix}_EXPIRED`);
}

function validateBindings(actual, expected, prefix) {
  for (const field of ['plan_sha256', 'snapshot_sha256', 'project_root_sha256', 'backup_manifest_sha256']) {
    if ((expected[field] ?? null) !== (actual?.[field] ?? null)) fail(`${prefix}_${field.toUpperCase()}_DIVERGED`);
  }
}

export function validateProjectCheckpoint(checkpoint, expected, { now = new Date() } = {}) {
  if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) fail('PROJECT_CHECKPOINT_REQUIRED');
  assertProjectIdentityNamespaces({ operationId: expected.operationId, checkpointId: checkpoint.checkpoint_id });
  if (checkpoint.operation_id !== expected.operationId || checkpoint.status !== 'EXPLICITLY_CHECKPOINTED' || checkpoint.provenance !== 'DIRECT_USER_CHECKPOINT' || checkpoint.synthetic_only !== true) fail('PROJECT_CHECKPOINT_DIVERGED');
  if (!Array.isArray(checkpoint.operations) || !checkpoint.operations.includes('APPLY')) fail('PROJECT_CHECKPOINT_APPLY_NOT_GRANTED');
  validateTime(checkpoint, now, 'PROJECT_CHECKPOINT');
  validateBindings(checkpoint.bindings, expected.bindings, 'PROJECT_CHECKPOINT');
  return Object.freeze({ ok: true, checkpoint_id: checkpoint.checkpoint_id });
}

export function validateProjectAuthorization(authorization, expected, { now = new Date() } = {}) {
  if (!authorization || typeof authorization !== 'object' || Array.isArray(authorization)) fail('PROJECT_AUTHORIZATION_REQUIRED');
  assertProjectIdentityNamespaces({ operationId: expected.operationId, checkpointId: authorization.checkpoint_id, authorizationId: authorization.authorization_id });
  if (authorization.operation_id !== expected.operationId || authorization.operation_class !== expected.operationClass) fail('PROJECT_AUTHORIZATION_OPERATION_DIVERGED');
  if (authorization.status !== 'EXPLICITLY_AUTHORIZED' || authorization.provenance !== 'DIRECT_USER_AUTHORIZATION' || authorization.synthetic_only !== true) fail('PROJECT_AUTHORIZATION_NOT_EXPLICIT');
  if (!Array.isArray(authorization.operations) || !authorization.operations.includes(expected.requiredOperation)) fail('PROJECT_AUTHORIZATION_OPERATION_NOT_GRANTED');
  if (expected.requiredOperation === 'APPLY' && authorization.checkpoint_id !== expected.checkpointId) fail('PROJECT_AUTHORIZATION_CHECKPOINT_DIVERGED');
  if (expected.requiredOperation === 'ROLLBACK' && (authorization.checkpoint_id !== null || authorization.operations.includes('APPLY'))) fail('PROJECT_ROLLBACK_AUTHORIZATION_NOT_FRESH');
  validateTime(authorization, now, 'PROJECT_AUTHORIZATION');
  validateBindings(authorization.bindings, expected.bindings, 'PROJECT_AUTHORIZATION');
  return Object.freeze({ ok: true, authorization_id: authorization.authorization_id });
}

export function projectRootIdentity(projectRoot) {
  return canonicalSha256({ project_root: projectRoot });
}
