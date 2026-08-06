import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';
import { classifyApplicationProfile, evaluateAssurance, hashProfile, validateApplicationProfile, validateProfileOverride } from '../../tools/lib/profile.mjs';

const exposures = ['LOCAL_ISOLATED', 'INTERNAL_RESTRICTED', 'EXTERNAL_RESTRICTED', 'PUBLIC'];
const impacts = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
const expected = {
  LOCAL_ISOLATED: ['LIGHT', 'STANDARD', 'HIGH_RISK', 'HIGH_RISK'],
  INTERNAL_RESTRICTED: ['STANDARD', 'STANDARD', 'HIGH_RISK', 'HIGH_RISK'],
  EXTERNAL_RESTRICTED: ['STANDARD', 'HIGH_RISK', 'HIGH_RISK', 'HIGH_RISK'],
  PUBLIC: ['HIGH_RISK', 'HIGH_RISK', 'HIGH_RISK', 'HIGH_RISK'],
};
const baseProfile = () => readYaml(resolve(frameworkRoot, 'contracts/templates/application-profile.yaml'));

test('ACC-005 classifies all 16 exposure and impact pairs objectively', async () => {
  for (const exposure of exposures) {
    for (const [index, impact] of impacts.entries()) {
      const profile = await baseProfile();
      profile.exposure = exposure;
      profile.impact = impact;
      const result = await classifyApplicationProfile(profile);
      assert.equal(result.assurance, expected[exposure][index], `${exposure}/${impact}`);
    }
  }
});

test('internal network never grants LIGHT implicit trust', async () => {
  const profile = await baseProfile();
  profile.exposure = 'INTERNAL_RESTRICTED';
  assert.equal((await classifyApplicationProfile(profile)).assurance, 'STANDARD');
});

test('contextual high-risk triggers escalate the profile', async () => {
  const profile = await baseProfile();
  profile.context.data_classes = ['regulated'];
  assert.equal((await classifyApplicationProfile(profile)).assurance, 'HIGH_RISK');
});

test('valid seven-field override requires authorization, time and matching base hash', async () => {
  const profile = await baseProfile();
  const override = {
    scope: ['delivery'], rationale: 'Authorized bounded material exception.', authorization_ref: 'AUTH-1',
    authorized_at: '2026-07-28T00:00:00Z', expires_at: '2026-08-28T00:00:00Z',
    base_profile_hash: hashProfile(profile), source_evidence: ['decision'],
  };
  const result = await validateProfileOverride(override, { baseProfile: profile, validAuthorizationRefs: ['AUTH-1'], now: new Date('2026-07-29T00:00:00Z') });
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('each required override field fails closed when absent', async () => {
  const profile = await baseProfile();
  const valid = {
    scope: ['delivery'], rationale: 'Authorized bounded material exception.', authorization_ref: 'AUTH-1',
    authorized_at: '2026-07-28T00:00:00Z', expires_at: '2026-08-28T00:00:00Z',
    base_profile_hash: hashProfile(profile), source_evidence: ['decision'],
  };
  for (const field of Object.keys(valid)) {
    const candidate = structuredClone(valid);
    delete candidate[field];
    assert.equal((await validateProfileOverride(candidate, { baseProfile: profile, validAuthorizationRefs: ['AUTH-1'], now: new Date('2026-07-29T00:00:00Z') })).ok, false, field);
  }
});

test('override rejects unknown authorization, expiration and base drift independently', async () => {
  const profile = await baseProfile();
  const make = () => ({
    scope: ['delivery'], rationale: 'Authorized bounded material exception.', authorization_ref: 'AUTH-1',
    authorized_at: '2026-07-28T00:00:00Z', expires_at: '2026-08-28T00:00:00Z',
    base_profile_hash: hashProfile(profile), source_evidence: ['decision'],
  });
  assert.match((await validateProfileOverride(make(), { baseProfile: profile, now: new Date('2026-07-29T00:00:00Z') })).errors.join(' '), /not confirmed/);
  const expired = make(); expired.expires_at = '2026-07-28T12:00:00Z';
  assert.match((await validateProfileOverride(expired, { baseProfile: profile, validAuthorizationRefs: ['AUTH-1'], now: new Date('2026-07-29T00:00:00Z') })).errors.join(' '), /expired/);
  const drift = make(); drift.base_profile_hash = 'b'.repeat(64);
  assert.match((await validateProfileOverride(drift, { baseProfile: profile, validAuthorizationRefs: ['AUTH-1'], now: new Date('2026-07-29T00:00:00Z') })).errors.join(' '), /does not match/);
});

test('ACC-006 LIGHT eligibility and escalation are deterministic', async () => {
  const eligible = { requested: 'LIGHT', profileAssurance: 'LIGHT', specType: 'QUICK_SPEC', size: 'SMALL', locality: 'LOCAL', reversibility: 'HIGH', risk: 'LOW' };
  assert.equal((await evaluateAssurance(eligible)).assurance, 'LIGHT');
  assert.equal((await evaluateAssurance({ ...eligible, materialFinding: true })).assurance, 'STANDARD');
  assert.equal((await evaluateAssurance({ ...eligible, guardFailed: true })).assurance, 'STANDARD');
  assert.equal((await evaluateAssurance({ ...eligible, size: 'LARGE' })).assurance, 'STANDARD');
});

test('control analysis reports insufficient and excessive bundles', async () => {
  const valid = await baseProfile();
  assert.equal((await validateApplicationProfile({ profile: valid })).ok, true);
  const insufficient = structuredClone(valid); insufficient.controls.baseline = ['validate-boundaries'];
  assert.match((await validateApplicationProfile({ profile: insufficient })).errors.join(' '), /Missing baseline control/);
  const excessive = structuredClone(valid); excessive.controls.contextual = ['validate-boundaries'];
  assert.match((await validateApplicationProfile({ profile: excessive })).warnings.join(' '), /Excessive/);
});
