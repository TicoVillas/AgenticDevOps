import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { validateHandoff } from '../../tools/lib/adapters.mjs';
import { classifyDryRun } from '../../tools/lib/dry-run.mjs';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';
import { evaluateAssurance } from '../../tools/lib/profile.mjs';
import { classifyTransition, expectedSessionStrategy } from '../../tools/lib/transition.mjs';
import { validateWorkflow } from '../../tools/lib/workflow.mjs';

const safeAuthority = {
  scope_unchanged: true,
  paths_unchanged: true,
  permissions_unchanged: true,
  git_actions_requested: false,
  git_actions_authorized: false,
  remote_actions_requested: false,
  remote_actions_authorized: false,
};

function transition(from, to, strategy, current = 'author', destination = 'assurance') {
  return {
    from_phase: from,
    to_phase: to,
    authorization_current: true,
    artifact_final: true,
    hashes_match: true,
    assurance_satisfied: true,
    evidence_sufficient: true,
    guard_results: [{ name: 'contract', passed: true }],
    pending_decision: false,
    checkpoint_pending: false,
    authority: safeAuthority,
    session: { strategy, current_identity: current, destination_identity: destination },
    independence_required: strategy === 'NEW_INDEPENDENT',
  };
}

test('eval: routing core remains valid and human checkpoints are explicit', async () => {
  const result = await validateWorkflow();
  assert.equal(result.ok, true, result.errors.join('\n'));
  const workflow = await readYaml(resolve(frameworkRoot, 'core/workflow.yaml'));
  assert.ok(workflow.human_transitions.some(({ from, to }) => from === 'validate-delivery' && to === 'final-review'));
  assert.ok(workflow.human_transitions.some(({ from, to }) => from === 'final-review' && to === 'delivery-closeout'));
});

test('eval: LIGHT is eligible only for the contracted small local case and escalates on findings', async () => {
  const eligible = await evaluateAssurance({ profileAssurance: 'LIGHT', requested: 'LIGHT', specType: 'QUICK_SPEC', size: 'SMALL', locality: 'LOCAL', reversibility: 'HIGH', risk: 'LOW', materialFinding: false, guardFailed: false });
  assert.equal(eligible.assurance, 'LIGHT');
  const escalated = await evaluateAssurance({ profileAssurance: 'LIGHT', requested: 'LIGHT', specType: 'QUICK_SPEC', size: 'SMALL', locality: 'LOCAL', reversibility: 'HIGH', risk: 'LOW', materialFinding: true, guardFailed: false });
  assert.equal(escalated.assurance, 'STANDARD');
});

test('eval: dry-run is safe locally and preserves a checkpoint for production', () => {
  const base = {
    authorization_current: true,
    scope_contained: true,
    snapshot_matches: true,
    evidence_complete: true,
    observability_available: true,
    preconditions: [],
    partial_effect_state: 'NONE',
    mutation: 'REVERSIBLE',
    rollback: { available: true, plan: 'restore local output' },
    environment: 'LOCAL_ISOLATED',
    operation_class: 'LOCAL_WRITE',
    external_effect: false,
    secrets_present: false,
    data_classes: [],
    risk: 'LOW',
    reversibility: 'HIGH',
    ambiguity: 'LOW',
    blast_radius: 'LOCAL',
    determinism: 'DETERMINISTIC',
    idempotency: 'IDEMPOTENT',
    equivalence: 'VALIDATED',
  };
  assert.equal(classifyDryRun(base).decision, 'AUTO_APPLY_ELIGIBLE');
  assert.equal(classifyDryRun({ ...base, environment: 'PRODUCTION' }).decision, 'CHECKPOINT_REQUIRED');
});

test('eval: chaining keeps initial assurance independent and follow-up continuity', async () => {
  const workflow = await readYaml(resolve(frameworkRoot, 'core/workflow.yaml'));
  const initial = transition('execute-contract', 'validate-delivery', 'NEW_INDEPENDENT', 'executor', 'validator');
  assert.equal(classifyTransition(initial, workflow).decision, 'CHAINED');
  const invalid = transition('execute-contract', 'validate-delivery', 'NEW_INDEPENDENT', 'executor', 'executor');
  assert.equal(classifyTransition(invalid, workflow).decision, 'BLOCKED');
  assert.equal(expectedSessionStrategy('correct-from-validation', 'validate-delivery'), 'ORIGINAL_VALIDATOR');
});

test('eval: response economy and Kiro Default remain enforced', async () => {
  const handoff = JSON.parse(await (await import('node:fs/promises')).readFile(resolve(frameworkRoot, 'tests/adapters/snapshots/handoff.json'), 'utf8'));
  assert.equal((await validateHandoff(handoff)).ok, true);
  const kiro = await readYaml(resolve(frameworkRoot, 'adapters/kiro/adapter.yaml'));
  assert.equal(kiro.agent, 'Default');
});
