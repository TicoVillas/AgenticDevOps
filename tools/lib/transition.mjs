import { resolve } from 'node:path';
import { validateArtifact } from './artifacts.mjs';
import { frameworkRoot, readYaml } from './io.mjs';

export function expectedSessionStrategy(from, to) {
  if (['quick-spec', 'spec', 'bug-fix'].includes(from) && to === 'contract-review') return 'NEW_INDEPENDENT';
  if (from === 'execute-contract' && to === 'validate-delivery') return 'NEW_INDEPENDENT';
  if (from === 'contract-review') return 'ORIGINAL_AUTHOR';
  if (from === 'validate-delivery' && to === 'correct-from-validation') return 'ORIGINAL_EXECUTOR';
  if (from === 'correct-from-validation' && to === 'validate-delivery') return 'ORIGINAL_VALIDATOR';
  if (from === 'low-level-discovery' && ['quick-spec', 'spec', 'bug-fix'].includes(to)) return 'SAME_SESSION';
  if (from === 'workflow-bootstrap' && to === 'low-level-discovery') return 'ORIGINAL_AUTHOR';
  return null;
}

export function classifyTransition(manifest, workflow) {
  const blocked = [];
  const checkpoints = [];
  const automatic = workflow.automatic_transitions.some((edge) => edge.from === manifest.from_phase && edge.to === manifest.to_phase);
  const human = workflow.human_transitions.some((edge) => edge.from === manifest.from_phase && edge.to === manifest.to_phase);
  if (!automatic && !human) blocked.push('edge:not-allowlisted');
  if (human) checkpoints.push('edge:human-authorization-required');

  for (const field of ['authorization_current', 'artifact_final', 'hashes_match', 'assurance_satisfied', 'evidence_sufficient']) {
    if (manifest[field] !== true) blocked.push(`${field}:required-true`);
  }
  for (const guard of manifest.guard_results ?? []) if (guard.passed !== true) blocked.push(`guard:${guard.name}`);
  if (manifest.pending_decision === true) checkpoints.push('decision:pending');
  if (manifest.checkpoint_pending === true) checkpoints.push('checkpoint:pending');

  const authority = manifest.authority ?? {};
  for (const field of ['scope_unchanged', 'paths_unchanged', 'permissions_unchanged']) if (authority[field] !== true) blocked.push(`authority:${field}`);
  if (authority.git_actions_requested && !authority.git_actions_authorized) blocked.push('authority:git-not-authorized');
  if (authority.remote_actions_requested && !authority.remote_actions_authorized) blocked.push('authority:remote-not-authorized');

  if (automatic) {
    const expected = expectedSessionStrategy(manifest.from_phase, manifest.to_phase);
    if (!expected) blocked.push('session:no-strategy-defined');
    else if (manifest.session?.strategy !== expected) blocked.push(`session:expected-${expected}`);
    const mustBeIndependent = expected === 'NEW_INDEPENDENT';
    if (manifest.independence_required !== mustBeIndependent) blocked.push(`session:independence-flag-${mustBeIndependent}`);
    if (mustBeIndependent && manifest.session?.current_identity === manifest.session?.destination_identity) blocked.push('session:assurance-must-be-independent');
  }

  const decision = blocked.length ? 'BLOCKED' : checkpoints.length ? 'CHECKPOINT_REQUIRED' : 'CHAINED';
  return { decision, blocked, checkpoints, automatic, human };
}

export async function validateTransition(manifest, { root = frameworkRoot } = {}) {
  const structural = await validateArtifact('transition-manifest', manifest, root);
  if (!structural.ok) return { ok: false, errors: structural.errors, decision: 'BLOCKED', blocked: ['schema-invalid'], checkpoints: [] };
  const workflow = await readYaml(resolve(root, 'core/workflow.yaml'));
  const classified = classifyTransition(manifest, workflow);
  const errors = [];
  if (manifest.decision !== classified.decision) errors.push(`Declared decision ${manifest.decision} differs from computed ${classified.decision}`);
  return { ok: errors.length === 0, errors, ...classified, manifest };
}
