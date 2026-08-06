import { createPublicKey } from 'node:crypto';
import { canonicalSha256 } from './canonical-json.mjs';
import { publicKeyFingerprint, verifyDetachedSignature } from './release.mjs';

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function instant(value, code) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) fail(code);
  return timestamp;
}

function compareEvents(left, right) {
  return left.effective_at.localeCompare(right.effective_at) || left.event_id.localeCompare(right.event_id);
}

export function publicKeyFromTrustRecord(record) {
  if (!record || record.algorithm !== 'Ed25519' || typeof record.public_key_spki_base64 !== 'string') fail('INVALID_TRUST_KEY_RECORD');
  let der;
  try { der = Buffer.from(record.public_key_spki_base64, 'base64'); } catch { fail('MALFORMED_TRUST_PUBLIC_KEY', record.key_id); }
  if (!der.length || der.toString('base64') !== record.public_key_spki_base64) fail('MALFORMED_TRUST_PUBLIC_KEY', record.key_id);
  try { return createPublicKey({ key: der, type: 'spki', format: 'der' }); } catch { fail('MALFORMED_TRUST_PUBLIC_KEY', record.key_id); }
}

export function validateTrustStore(trustStore) {
  if (!trustStore || typeof trustStore !== 'object' || !Array.isArray(trustStore.keys) || trustStore.keys.length === 0) fail('TRUST_STORE_REQUIRED');
  const ids = new Set();
  const fingerprints = new Set();
  const byId = new Map();
  for (const record of trustStore.keys) {
    if (ids.has(record.key_id)) fail('DUPLICATE_TRUST_KEY_ID', record.key_id);
    if (fingerprints.has(record.fingerprint_sha256)) fail('DUPLICATE_TRUST_FINGERPRINT', record.fingerprint_sha256);
    ids.add(record.key_id);
    fingerprints.add(record.fingerprint_sha256);
    byId.set(record.key_id, record);
    const key = publicKeyFromTrustRecord(record);
    if (publicKeyFingerprint(key) !== record.fingerprint_sha256) fail('TRUST_FINGERPRINT_MISMATCH', record.key_id);
    const from = instant(record.valid_from, 'INVALID_KEY_VALID_FROM');
    if (record.valid_until !== undefined && instant(record.valid_until, 'INVALID_KEY_VALID_UNTIL') <= from) fail('INVALID_KEY_VALIDITY_INTERVAL', record.key_id);
    if (!['ACTIVE', 'RETIRED', 'REVOKED'].includes(record.status)) fail('INVALID_KEY_STATUS', record.key_id);
    if (record.status === 'REVOKED') {
      if (!record.revoked_at || !record.revocation_reason) fail('REVOCATION_METADATA_REQUIRED', record.key_id);
      instant(record.revoked_at, 'INVALID_REVOCATION_TIME');
    } else if (record.revoked_at !== undefined || record.revocation_reason !== undefined) fail('UNEXPECTED_REVOCATION_METADATA', record.key_id);
  }
  for (const record of trustStore.keys) {
    if (record.supersedes !== undefined && (!byId.has(record.supersedes) || record.supersedes === record.key_id)) fail('INVALID_SUPERSEDES', record.key_id);
    const visited = new Set([record.key_id]);
    let cursor = record;
    while (cursor.supersedes !== undefined) {
      if (visited.has(cursor.supersedes)) fail('TRUST_ROTATION_CYCLE', record.key_id);
      visited.add(cursor.supersedes);
      cursor = byId.get(cursor.supersedes);
    }
  }
  return { ok: true, keys: trustStore.keys.length, byId };
}

export function resolveTrustedKey({ trustStore, keyId, fingerprintSha256, at, usage = 'NEW_SIGNATURE' }) {
  const { byId } = validateTrustStore(trustStore);
  const record = byId.get(keyId);
  if (!record) fail('UNKNOWN_TRUST_KEY', keyId);
  if (record.fingerprint_sha256 !== fingerprintSha256) fail('TRUST_FINGERPRINT_MISMATCH', keyId);
  if (record.status === 'REVOKED') fail('TRUST_KEY_REVOKED', keyId);
  if (record.status === 'RETIRED' && usage !== 'HISTORICAL_VERIFICATION') fail('TRUST_KEY_RETIRED', keyId);
  const observedAt = instant(at, 'TRUST_EVALUATION_TIME_REQUIRED');
  if (observedAt < instant(record.valid_from, 'INVALID_KEY_VALID_FROM')) fail('TRUST_KEY_NOT_YET_VALID', keyId);
  if (record.valid_until !== undefined && observedAt > instant(record.valid_until, 'INVALID_KEY_VALID_UNTIL')) fail('TRUST_KEY_EXPIRED', keyId);
  return { record, publicKey: publicKeyFromTrustRecord(record) };
}

export function validateKeyEvents(trustStore, events) {
  const { byId } = validateTrustStore(trustStore);
  if (!Array.isArray(events)) fail('KEY_EVENTS_REQUIRED');
  if (canonicalSha256(events) !== trustStore.key_events_sha256) fail('KEY_EVENTS_BINDING_MISMATCH');
  const ordered = [...events].sort(compareEvents);
  if (ordered.some((event, index) => event !== events[index])) fail('KEY_EVENTS_NOT_SORTED');
  const ids = new Set();
  for (const event of events) {
    if (ids.has(event.event_id)) fail('DUPLICATE_KEY_EVENT', event.event_id);
    ids.add(event.event_id);
    const effective = instant(event.effective_at, 'INVALID_KEY_EVENT_TIME');
    if (!/^[a-f0-9]{64}$/.test(event.authorization_sha256 ?? '') || !/^[a-f0-9]{64}$/.test(event.authenticated_metadata_sha256 ?? '')) fail('UNAUTHENTICATED_KEY_EVENT', event.event_id);
    if (event.event_type === 'ROTATION') {
      const previous = byId.get(event.previous_key_id);
      const next = byId.get(event.new_key_id);
      if (!previous || !next || next.supersedes !== previous.key_id) fail('INVALID_ROTATION_BINDING', event.event_id);
      if (instant(next.valid_from, 'INVALID_KEY_VALID_FROM') !== effective) fail('ROTATION_ACTIVATION_MISMATCH', event.event_id);
      const overlap = instant(event.overlap_until, 'INVALID_ROTATION_OVERLAP');
      if (overlap <= effective) fail('ROTATION_OVERLAP_REQUIRED', event.event_id);
      if (previous.valid_until === undefined || instant(previous.valid_until, 'INVALID_KEY_VALID_UNTIL') !== overlap) fail('ROTATION_OVERLAP_MISMATCH', event.event_id);
    } else if (event.event_type === 'REVOCATION') {
      const record = byId.get(event.key_id);
      if (!record || record.status !== 'REVOKED') fail('REVOCATION_STATUS_MISMATCH', event.event_id);
      if (instant(record.revoked_at, 'INVALID_REVOCATION_TIME') !== effective || record.revocation_reason !== event.reason) fail('REVOCATION_METADATA_MISMATCH', event.event_id);
      if (event.replacement_key_id !== undefined && !byId.has(event.replacement_key_id)) fail('UNKNOWN_REPLACEMENT_KEY', event.event_id);
    } else fail('INVALID_KEY_EVENT_TYPE', event.event_id);
  }
  return { ok: true, events: events.length, key_events_sha256: trustStore.key_events_sha256 };
}

export function evaluateRotation({ trustStore, event, at }) {
  if (event?.event_type !== 'ROTATION') fail('ROTATION_EVENT_REQUIRED');
  const { byId } = validateTrustStore(trustStore);
  const previous = byId.get(event.previous_key_id);
  const next = byId.get(event.new_key_id);
  if (!previous || !next || next.supersedes !== previous.key_id) fail('INVALID_ROTATION_BINDING', event.event_id);
  const timestamp = instant(at, 'TRUST_EVALUATION_TIME_REQUIRED');
  const effective = instant(event.effective_at, 'INVALID_KEY_EVENT_TIME');
  const overlap = instant(event.overlap_until, 'INVALID_ROTATION_OVERLAP');
  if (timestamp < effective) return { phase: 'BEFORE_ACTIVATION', accepted_key_ids: [previous.key_id] };
  if (timestamp <= overlap) return { phase: 'OVERLAP', accepted_key_ids: [previous.key_id, next.key_id] };
  return { phase: 'AFTER_OVERLAP', accepted_key_ids: [next.key_id] };
}

export function verifyTrustedSignature({ trustStore, envelope, bytes, at, usage = 'NEW_SIGNATURE' }) {
  const { publicKey } = resolveTrustedKey({ trustStore, keyId: envelope?.key_id, fingerprintSha256: envelope?.fingerprint_sha256, at, usage });
  return verifyDetachedSignature({ bytes, envelope, publicKey });
}
