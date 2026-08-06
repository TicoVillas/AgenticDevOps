import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function checkExplicitAuthorization({ evidence, operationId, scopeSha256, now = new Date() } = {}) {
  const denied = (reason) => ({ authorization_granted: false, reason });
  if (!evidence || evidence.source !== 'USER_AUTHORIZATION') return denied('EXPLICIT_USER_AUTHORIZATION_REQUIRED');
  if (evidence.artifact_type === 'DRAFT' || evidence.artifact_type === 'CONTRACT_REVIEW') return denied('NON_AUTHORIZING_ARTIFACT');
  if (evidence.current !== true) return denied('AUTHORIZATION_NOT_CURRENT');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/.test(operationId ?? '') || !/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/.test(evidence.operation_id ?? '')) return denied('OPERATION_BINDING_REQUIRED');
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) return denied('INVALID_AUTHORIZATION_CLOCK');
  if (evidence.operation_id !== operationId) return denied('OPERATION_BINDING_MISMATCH');
  if (!/^[a-f0-9]{64}$/.test(scopeSha256 ?? '') || !/^[a-f0-9]{64}$/.test(evidence.scope_sha256 ?? '') || evidence.scope_sha256 !== scopeSha256) return denied('SCOPE_BINDING_MISMATCH');
  if (evidence.expires_at != null) {
    const expires = new Date(evidence.expires_at);
    if (Number.isNaN(expires.getTime()) || expires <= now) return denied('AUTHORIZATION_EXPIRED');
  }
  return { authorization_granted: true, reason: 'EXPLICIT_CURRENT_BINDING_MATCH' };
}

export function compareDeclaredHashToBytes({ declaredSha256, bytes } = {}) {
  if (!/^[a-f0-9]{64}$/.test(declaredSha256 ?? '') || !(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array)) return { ok: false, code: 'INVALID_HASH_EVIDENCE' };
  const observedSha256 = digest(bytes);
  return observedSha256 === declaredSha256
    ? { ok: true, code: 'SNAPSHOT_MATCH', declaredSha256, observedSha256 }
    : { ok: false, code: 'SNAPSHOT_DIVERGED', declaredSha256, observedSha256 };
}

export async function compareDeclaredHashToFile({ declaredSha256, path } = {}) {
  try { return compareDeclaredHashToBytes({ declaredSha256, bytes: await readFile(path) }); }
  catch (error) { return { ok: false, code: 'SNAPSHOT_DIVERGED', declaredSha256, observedSha256: null, error: error.code ?? error.message }; }
}
