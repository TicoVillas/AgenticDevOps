import { resolve } from 'node:path';
import { validateArtifact } from './artifacts.mjs';
import { frameworkRoot, readYaml } from './io.mjs';
import { sha256 } from './source-lock.mjs';

const assuranceRank = Object.freeze({ LIGHT: 0, STANDARD: 1, HIGH_RISK: 2 });

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
}

export function hashProfile(profile) {
  return sha256(Buffer.from(JSON.stringify(stableValue(profile))));
}

function containsTrigger(values, triggers) {
  const normalized = (values ?? []).map((value) => String(value).toLowerCase());
  return triggers.some((trigger) => normalized.some((value) => value.includes(trigger)));
}

export async function classifyApplicationProfile(profile, { root = frameworkRoot } = {}) {
  const rules = await readYaml(resolve(root, 'policies/application-profile-matrix.yaml'));
  const base = rules.matrix?.[profile.exposure]?.[profile.impact];
  if (!base) return { ok: false, errors: ['Unknown exposure/impact combination'], assurance: null, rules: [] };
  let assurance = base;
  const triggered = [`matrix:${profile.exposure}:${profile.impact}:${base}`];
  for (const [field, triggers] of Object.entries(rules.high_risk_triggers)) {
    if (containsTrigger(profile.context?.[field], triggers)) {
      assurance = 'HIGH_RISK';
      triggered.push(`high-risk-trigger:${field}`);
    }
  }
  if ((profile.context?.integrations ?? []).length && assurance === 'LIGHT') {
    assurance = 'STANDARD';
    triggered.push('integration-requires-standard');
  }
  if ((profile.context?.identities ?? []).length && assurance === 'LIGHT') {
    assurance = 'STANDARD';
    triggered.push('identity-requires-standard');
  }
  return { ok: true, errors: [], assurance, rules: triggered };
}

export async function evaluateControls(profile, { root = frameworkRoot } = {}) {
  const rules = await readYaml(resolve(root, 'policies/application-profile-matrix.yaml'));
  const baseline = new Set(profile.controls?.baseline ?? []);
  const contextual = new Set(profile.controls?.contextual ?? []);
  const errors = rules.baseline_controls.filter((control) => !baseline.has(control)).map((control) => `Missing baseline control ${control}`);
  const warnings = [...contextual].filter((control) => baseline.has(control)).map((control) => `Excessive duplicate contextual control ${control}`);
  return { ok: errors.length === 0, errors, warnings };
}

export async function validateProfileOverride(override, { baseProfile, validAuthorizationRefs = [], now = new Date(), root = frameworkRoot } = {}) {
  const structural = await validateArtifact('application-profile-override', override, root);
  const errors = [...structural.errors];
  if (!structural.ok) return { ok: false, errors };
  if (!validAuthorizationRefs.includes(override.authorization_ref)) errors.push('authorization_ref is not confirmed');
  const authorizedAt = new Date(override.authorized_at);
  const expiresAt = new Date(override.expires_at);
  if (!(expiresAt > authorizedAt)) errors.push('expires_at must be later than authorized_at');
  if (!(expiresAt > now)) errors.push('override is expired or not future-valid');
  if (!baseProfile || override.base_profile_hash !== hashProfile(baseProfile)) errors.push('base_profile_hash does not match the canonical base profile');
  return { ok: errors.length === 0, errors };
}

export async function evaluateAssurance(change, { root = frameworkRoot } = {}) {
  const rules = await readYaml(resolve(root, 'policies/application-profile-matrix.yaml'));
  const triggered = [];
  let assurance = assuranceRank[change.profileAssurance] > assuranceRank[change.requested] ? change.profileAssurance : change.requested;
  if (change.requested === 'LIGHT') {
    const eligibility = rules.light_eligibility;
    const eligible = change.specType === eligibility.spec_type
      && change.size === eligibility.size
      && change.locality === eligibility.locality
      && change.reversibility === eligibility.reversibility
      && change.risk === eligibility.risk;
    if (!eligible) {
      assurance = assuranceRank[assurance] > assuranceRank.STANDARD ? assurance : 'STANDARD';
      triggered.push('light-ineligible');
    }
    if (change.materialFinding || change.guardFailed) {
      assurance = assuranceRank[assurance] > assuranceRank.STANDARD ? assurance : 'STANDARD';
      triggered.push(change.materialFinding ? 'material-finding' : 'guard-failed');
    }
  }
  return { assurance, rules: triggered };
}

export async function validateApplicationProfile({ profile, override = null, validAuthorizationRefs = [], now = new Date(), root = frameworkRoot }) {
  const structural = await validateArtifact('application-profile', profile, root);
  const errors = [...structural.errors];
  const warnings = [];
  if (!structural.ok) return { ok: false, errors, warnings };
  const classification = await classifyApplicationProfile(profile, { root });
  const controls = await evaluateControls(profile, { root });
  errors.push(...classification.errors, ...controls.errors);
  warnings.push(...controls.warnings);
  if (assuranceRank[profile.assurance_recommendation] < assuranceRank[classification.assurance]) {
    errors.push(`Declared assurance ${profile.assurance_recommendation} is below computed ${classification.assurance}`);
  } else if (assuranceRank[profile.assurance_recommendation] > assuranceRank[classification.assurance]) {
    warnings.push(`Declared assurance ${profile.assurance_recommendation} exceeds computed ${classification.assurance}`);
  }
  let overrideResult = null;
  if (override) {
    overrideResult = await validateProfileOverride(override, { baseProfile: profile, validAuthorizationRefs, now, root });
    errors.push(...overrideResult.errors);
  }
  return { ok: errors.length === 0, errors, warnings, classification, controls, override: overrideResult, profileHash: hashProfile(profile) };
}
