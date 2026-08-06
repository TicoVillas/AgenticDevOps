import { validateArtifact } from './artifacts.mjs';

export function normalizeDryRunInput(input) {
  const normalized = structuredClone(input);
  for (const field of ['environment', 'operation_class', 'risk', 'reversibility', 'ambiguity', 'blast_radius', 'mutation', 'determinism', 'idempotency', 'equivalence', 'partial_effect_state']) {
    if (normalized[field] != null) normalized[field] = String(normalized[field]).trim().toUpperCase().replaceAll('-', '_').replaceAll(' ', '_');
  }
  return normalized;
}

function hasSensitiveData(classes = []) {
  return classes.some((value) => /sensitive|regulated|credential|confidential|personal/i.test(String(value)));
}

export function classifyDryRun(input) {
  const manifest = normalizeDryRunInput(input);
  const blocked = [];
  const checkpoints = [];

  for (const field of ['authorization_current', 'scope_contained', 'snapshot_matches', 'evidence_complete', 'observability_available']) {
    if (manifest[field] !== true) blocked.push(`${field}:required-true`);
  }
  for (const precondition of manifest.preconditions ?? []) if (precondition.passed !== true) blocked.push(`precondition:${precondition.name}`);
  if (manifest.partial_effect_state === 'UNKNOWN') blocked.push('partial-effect:unknown');
  if (manifest.mutation !== 'NONE' && manifest.rollback?.available !== true) blocked.push('rollback:required');
  if (!manifest.rollback?.plan) blocked.push('rollback:plan-required');

  if (['SHARED', 'STAGING', 'PRODUCTION'].includes(manifest.environment)) checkpoints.push(`environment:${manifest.environment}`);
  if (['REMOTE_WRITE', 'DATA_SCHEMA', 'PERMISSION_SECURITY', 'INFRASTRUCTURE'].includes(manifest.operation_class)) checkpoints.push(`operation-class:${manifest.operation_class}`);
  if (manifest.external_effect === true) checkpoints.push('external-effect');
  if (manifest.secrets_present === true) checkpoints.push('secrets-present');
  if (hasSensitiveData(manifest.data_classes)) checkpoints.push('sensitive-data');
  if (['HIGH', 'CRITICAL'].includes(manifest.risk)) checkpoints.push(`risk:${manifest.risk}`);
  if (['LOW', 'NONE'].includes(manifest.reversibility)) checkpoints.push(`reversibility:${manifest.reversibility}`);
  if (manifest.ambiguity === 'HIGH') checkpoints.push('ambiguity:HIGH');
  if (['BROAD', 'UNKNOWN'].includes(manifest.blast_radius)) checkpoints.push(`blast-radius:${manifest.blast_radius}`);
  if (manifest.determinism !== 'DETERMINISTIC') checkpoints.push(`determinism:${manifest.determinism}`);
  if (!['IDEMPOTENT', 'REPEAT_BLOCKED'].includes(manifest.idempotency)) checkpoints.push(`idempotency:${manifest.idempotency}`);
  if (manifest.equivalence !== 'VALIDATED') checkpoints.push(`equivalence:${manifest.equivalence}`);
  if (manifest.mutation === 'IRREVERSIBLE') checkpoints.push('mutation:IRREVERSIBLE');
  if (manifest.partial_effect_state === 'KNOWN_RECOVERABLE') checkpoints.push('partial-effect:known-recoverable');

  const decision = blocked.length ? 'BLOCKED' : checkpoints.length ? 'CHECKPOINT_REQUIRED' : 'AUTO_APPLY_ELIGIBLE';
  return { decision, blocked, checkpoints, normalized: manifest };
}

export async function validateDryRun(manifest) {
  const structural = await validateArtifact('dry-run-manifest', manifest);
  if (!structural.ok) return { ok: false, errors: structural.errors, decision: 'BLOCKED', blocked: ['schema-invalid'], checkpoints: [] };
  const classified = classifyDryRun(manifest);
  const errors = [];
  if (manifest.decision !== classified.decision) errors.push(`Declared decision ${manifest.decision} differs from computed ${classified.decision}`);
  return { ok: errors.length === 0, errors, ...classified };
}
