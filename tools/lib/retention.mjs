import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import YAML from 'yaml';
import { frameworkRoot, walk } from './io.mjs';

export const RETENTION_POLICY_PATH = 'policies/OperationalRetentionPolicy.md';

export function parseRetentionPolicy(text) {
  const matches = [...String(text).matchAll(/```ya?ml\s*\n([\s\S]*?)```/g)];
  if (matches.length !== 1) throw new Error('RETENTION_POLICY_REQUIRES_ONE_YAML_BLOCK');
  const document = YAML.parse(matches[0][1]);
  const policy = document?.retention_policy;
  validateRetentionPolicyShape(policy);
  return policy;
}

export function validateRetentionPolicyShape(policy) {
  const errors = [];
  if (policy?.schema_version !== 1) errors.push('schema_version must be 1');
  for (const name of ['receipts', 'journals', 'tombstones']) if (policy?.records?.[name] !== 'INDEFINITE') errors.push(`${name} must be INDEFINITE`);
  if (policy?.backups?.installation_original !== 'ENTIRE_INSTALLATION') errors.push('installation_original must cover ENTIRE_INSTALLATION');
  if (!Number.isInteger(policy?.backups?.successful_versions?.minimum_count) || policy.backups.successful_versions.minimum_count < 1) errors.push('minimum_count must be a positive integer');
  if (!Number.isInteger(policy?.backups?.successful_versions?.minimum_days) || policy.backups.successful_versions.minimum_days < 1) errors.push('minimum_days must be a positive integer');
  if (!Number.isInteger(policy?.backups?.post_uninstall_days) || policy.backups.post_uninstall_days < 1) errors.push('post_uninstall_days must be a positive integer');
  const outcomes = policy?.legal_holds?.outcomes;
  const reconciliation = policy?.legal_holds?.reconciliation_states;
  if (!Array.isArray(outcomes) || !outcomes.includes('UNKNOWN') || !outcomes.includes('PARTIAL')) errors.push('UNKNOWN and PARTIAL holds are required');
  if (!Array.isArray(reconciliation) || !reconciliation.includes('UNRECONCILED')) errors.push('UNRECONCILED hold is required');
  if (errors.length) throw new Error(errors.join('; '));
  return true;
}

export async function loadRetentionPolicy(root = frameworkRoot) {
  return parseRetentionPolicy(await readFile(resolve(root, RETENTION_POLICY_PATH), 'utf8'));
}

export function retentionDecision(record, policy, { now = new Date() } = {}) {
  validateRetentionPolicyShape(policy);
  if (!record || typeof record !== 'object') return { retain: true, reason: 'INVALID_RECORD' };
  if (record.legal_hold?.active === true) return { retain: true, reason: 'LEGAL_HOLD' };
  if (policy.legal_holds.outcomes.includes(record.outcome) || policy.legal_holds.reconciliation_states.includes(record.reconciliation_status)) return { retain: true, reason: 'LEGAL_HOLD' };
  if (record.kind && policy.records[record.kind] === 'INDEFINITE') return { retain: true, reason: 'INDEFINITE' };
  if (record.kind !== 'backup') return { retain: true, reason: 'UNKNOWN_CLASS' };
  if (record.retention_class === 'INSTALLATION_ORIGINAL' && record.installation_active !== false) return { retain: true, reason: 'INSTALLATION_ORIGINAL' };
  const date = new Date(record.created_at);
  if (Number.isNaN(date.getTime()) || !(now instanceof Date) || Number.isNaN(now.getTime()) || date > now) return { retain: true, reason: 'INVALID_TIME' };
  const ageDays = (now.getTime() - date.getTime()) / 86_400_000;
  if (record.retention_class === 'SUCCESSFUL_VERSION') {
    if (!Number.isInteger(record.success_rank) || record.success_rank <= policy.backups.successful_versions.minimum_count || ageDays < policy.backups.successful_versions.minimum_days) return { retain: true, reason: 'SUCCESSFUL_VERSION_WINDOW' };
    return { retain: false, reason: 'ELIGIBLE' };
  }
  if (record.retention_class === 'POST_UNINSTALL') return ageDays < policy.backups.post_uninstall_days ? { retain: true, reason: 'POST_UNINSTALL_WINDOW' } : { retain: false, reason: 'ELIGIBLE' };
  return { retain: true, reason: 'UNKNOWN_RETENTION_CLASS' };
}

function duplicatePatternsFrom(policy) {
  validateRetentionPolicyShape(policy);
  const values = policy.backups;
  return [
    new RegExp(`(?:minimumSuccessfulVersions|minimum_count)\\s*[:=]\\s*${values.successful_versions.minimum_count}\\b`),
    new RegExp(`(?:minimumRetentionDays|minimum_days)\\s*[:=]\\s*${values.successful_versions.minimum_days}\\b`),
    new RegExp(`(?:postUninstallDays|post_uninstall_days)\\s*[:=]\\s*${values.post_uninstall_days}\\b`),
  ];
}

export function scanRetentionSourceOfTruth(entries, policy) {
  const errors = [];
  const patterns = duplicatePatternsFrom(policy);
  for (const entry of entries) for (const pattern of patterns) if (pattern.test(entry.text)) errors.push(`${entry.path}: duplicated retention value`);
  return errors;
}

export async function validateRetention(root = frameworkRoot) {
  const errors = [];
  let policy;
  try { policy = await loadRetentionPolicy(root); } catch (error) { errors.push(error.message); }
  const entries = [];
  for (const path of await walk(resolve(root, 'tools'))) {
    const rel = relative(root, path).split(sep).join('/');
    if (!/(?:plan|validat)[^/]*\.mjs$/.test(rel) || rel.endsWith('/validate-retention.mjs')) continue;
    entries.push({ path: rel, text: await readFile(path, 'utf8') });
  }
  if (policy) errors.push(...scanRetentionSourceOfTruth(entries, policy));
  return { ok: errors.length === 0, errors, policy, scannedConsumers: entries.length };
}
