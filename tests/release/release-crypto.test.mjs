import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSha256 } from '../../tools/lib/canonical-json.mjs';
import { publicKeyFingerprint, signDetached, verifyDetachedSignature } from '../../tools/lib/release.mjs';
import {
  evaluateRotation,
  resolveTrustedKey,
  validateKeyEvents,
  validateTrustStore,
  verifyTrustedSignature,
} from '../../tools/lib/release-trust.mjs';
import { KEY_ID, NOW, ephemeralKey, releaseFixture } from './helpers.mjs';

test('injected signer creates separate verifiable Ed25519 signatures for manifest and checksums', async () => {
  const fixture = await releaseFixture();
  assert.notEqual(fixture.manifestEnvelope.target_sha256, fixture.checksumsEnvelope.target_sha256);
  assert.equal(fixture.manifestEnvelope.target, 'MANIFEST');
  assert.equal(fixture.checksumsEnvelope.target, 'CHECKSUMS');
  assert.equal(verifyTrustedSignature({ trustStore: fixture.trustStore, envelope: fixture.manifestEnvelope, bytes: fixture.manifestBytes, at: NOW }).ok, true);
  assert.equal(verifyTrustedSignature({ trustStore: fixture.trustStore, envelope: fixture.checksumsEnvelope, bytes: fixture.checksumsBytes, at: NOW }).ok, true);
});

test('sign interface requires injection and never accepts malformed signer output', async () => {
  const fixture = await releaseFixture();
  const options = { target: 'MANIFEST', targetName: 'release-manifest-v3.1.0.json', bytes: fixture.manifestBytes, keyId: KEY_ID, fingerprintSha256: fixture.key.fingerprint };
  await assert.rejects(signDetached(options), /INJECTED_SIGNER_REQUIRED/);
  await assert.rejects(signDetached({ ...options, signer: async () => Buffer.alloc(1) }), /MALFORMED_ED25519_SIGNATURE/);
});

test('tamper, wrong key, wrong fingerprint, and malformed signature fail closed', async () => {
  const fixture = await releaseFixture();
  const tampered = Buffer.concat([fixture.manifestBytes, Buffer.from('tamper')]);
  assert.throws(() => verifyTrustedSignature({ trustStore: fixture.trustStore, envelope: fixture.manifestEnvelope, bytes: tampered, at: NOW }), /SIGNED_TARGET_HASH_MISMATCH/);
  const wrong = ephemeralKey('release-test-only-02');
  assert.throws(() => verifyDetachedSignature({ bytes: fixture.manifestBytes, envelope: fixture.manifestEnvelope, publicKey: wrong.publicKey }), /PUBLIC_KEY_FINGERPRINT_MISMATCH/);
  const wrongFingerprint = structuredClone(fixture.manifestEnvelope); wrongFingerprint.fingerprint_sha256 = wrong.fingerprint;
  assert.throws(() => verifyTrustedSignature({ trustStore: fixture.trustStore, envelope: wrongFingerprint, bytes: fixture.manifestBytes, at: NOW }), /TRUST_FINGERPRINT_MISMATCH/);
  const malformed = structuredClone(fixture.manifestEnvelope); malformed.signature = 'not-base64';
  assert.throws(() => verifyTrustedSignature({ trustStore: fixture.trustStore, envelope: malformed, bytes: fixture.manifestBytes, at: NOW }), /MALFORMED_ED25519_SIGNATURE/);
  const bitFlip = structuredClone(fixture.manifestEnvelope); const bytes = Buffer.from(bitFlip.signature, 'base64'); bytes[0] ^= 0xff; bitFlip.signature = bytes.toString('base64');
  assert.throws(() => verifyTrustedSignature({ trustStore: fixture.trustStore, envelope: bitFlip, bytes: fixture.manifestBytes, at: NOW }), /SIGNATURE_INVALID/);
});

test('trust store rejects malformed keys, duplicate IDs/fingerprints, cycles, and unknown keys', async () => {
  const fixture = await releaseFixture();
  assert.equal(validateTrustStore(fixture.trustStore).ok, true);
  const malformed = structuredClone(fixture.trustStore); malformed.keys[0].public_key_spki_base64 = 'VEVTVA==';
  assert.throws(() => validateTrustStore(malformed), /MALFORMED_TRUST_PUBLIC_KEY/);
  const duplicate = structuredClone(fixture.trustStore); duplicate.keys.push(structuredClone(duplicate.keys[0]));
  assert.throws(() => validateTrustStore(duplicate), /DUPLICATE_TRUST_KEY_ID/);
  assert.throws(() => resolveTrustedKey({ trustStore: fixture.trustStore, keyId: 'release-unknown-key', fingerprintSha256: 'a'.repeat(64), at: NOW }), /UNKNOWN_TRUST_KEY/);
  const second = ephemeralKey('release-test-only-02');
  const cycle = structuredClone(fixture.trustStore);
  cycle.keys[0].supersedes = second.keyId;
  cycle.keys.push({ key_id: second.keyId, algorithm: 'Ed25519', fingerprint_sha256: second.fingerprint, public_key_spki_base64: second.publicKeySpkiBase64, valid_from: '2026-08-01T00:00:00Z', status: 'ACTIVE', supersedes: KEY_ID });
  assert.throws(() => validateTrustStore(cycle), /TRUST_ROTATION_CYCLE/);
});

test('revoked keys always fail; retired keys only allow bounded historical verification', async () => {
  const revoked = await releaseFixture({ status: 'REVOKED', revokedAt: '2026-08-02T00:00:00Z', revocationReason: 'TEST_ONLY compromise' });
  assert.throws(() => verifyTrustedSignature({ trustStore: revoked.trustStore, envelope: revoked.manifestEnvelope, bytes: revoked.manifestBytes, at: NOW }), /TRUST_KEY_REVOKED/);
  const retired = await releaseFixture({ status: 'RETIRED', validUntil: '2026-08-03T00:00:00Z' });
  assert.throws(() => resolveTrustedKey({ trustStore: retired.trustStore, keyId: KEY_ID, fingerprintSha256: retired.key.fingerprint, at: NOW }), /TRUST_KEY_RETIRED/);
  assert.equal(resolveTrustedKey({ trustStore: retired.trustStore, keyId: KEY_ID, fingerprintSha256: retired.key.fingerprint, at: NOW, usage: 'HISTORICAL_VERIFICATION' }).record.status, 'RETIRED');
  assert.throws(() => resolveTrustedKey({ trustStore: retired.trustStore, keyId: KEY_ID, fingerprintSha256: retired.key.fingerprint, at: '2026-08-04T00:00:00Z', usage: 'HISTORICAL_VERIFICATION' }), /TRUST_KEY_EXPIRED/);
});

test('rotation overlap and authenticated event binding are deterministic', () => {
  const previous = ephemeralKey('release-test-only-01');
  const next = ephemeralKey('release-test-only-02');
  const event = { schema_version: 1, event_id: 'key-event-test-only-rotation-01', event_type: 'ROTATION', effective_at: '2026-08-02T00:00:00Z', authorization_sha256: 'a'.repeat(64), authenticated_metadata_sha256: 'b'.repeat(64), previous_key_id: previous.keyId, new_key_id: next.keyId, overlap_until: '2026-09-02T00:00:00Z' };
  const store = { schema_version: 1, trust_store_id: 'release-trust-test-only', version: 2, generated_at: NOW, key_events_sha256: canonicalSha256([event]), keys: [
    { key_id: previous.keyId, algorithm: 'Ed25519', fingerprint_sha256: previous.fingerprint, public_key_spki_base64: previous.publicKeySpkiBase64, valid_from: '2026-07-01T00:00:00Z', valid_until: event.overlap_until, status: 'RETIRED' },
    { key_id: next.keyId, algorithm: 'Ed25519', fingerprint_sha256: next.fingerprint, public_key_spki_base64: next.publicKeySpkiBase64, valid_from: event.effective_at, status: 'ACTIVE', supersedes: previous.keyId },
  ] };
  assert.equal(validateKeyEvents(store, [event]).ok, true);
  assert.deepEqual(evaluateRotation({ trustStore: store, event, at: '2026-08-01T00:00:00Z' }).accepted_key_ids, [previous.keyId]);
  assert.deepEqual(evaluateRotation({ trustStore: store, event, at: '2026-08-15T00:00:00Z' }).accepted_key_ids, [previous.keyId, next.keyId]);
  assert.deepEqual(evaluateRotation({ trustStore: store, event, at: '2026-10-01T00:00:00Z' }).accepted_key_ids, [next.keyId]);
  const changed = structuredClone(event); changed.overlap_until = '2026-09-03T00:00:00Z';
  assert.throws(() => validateKeyEvents(store, [changed]), /KEY_EVENTS_BINDING_MISMATCH/);
});

test('revocation event must match authenticated store metadata', () => {
  const key = ephemeralKey();
  const event = { schema_version: 1, event_id: 'key-event-test-only-revocation-01', event_type: 'REVOCATION', effective_at: NOW, authorization_sha256: 'a'.repeat(64), authenticated_metadata_sha256: 'b'.repeat(64), key_id: key.keyId, reason: 'TEST_ONLY compromise' };
  const store = { schema_version: 1, trust_store_id: 'release-trust-test-only', version: 2, generated_at: NOW, key_events_sha256: canonicalSha256([event]), keys: [{ key_id: key.keyId, algorithm: 'Ed25519', fingerprint_sha256: publicKeyFingerprint(key.publicKey), public_key_spki_base64: key.publicKeySpkiBase64, valid_from: '2026-08-01T00:00:00Z', status: 'REVOKED', revoked_at: NOW, revocation_reason: event.reason }] };
  assert.equal(validateKeyEvents(store, [event]).ok, true);
  const contradictory = structuredClone(store); contradictory.keys[0].revocation_reason = 'different';
  assert.throws(() => validateKeyEvents(contradictory, [event]), /REVOCATION_METADATA_MISMATCH/);
});
