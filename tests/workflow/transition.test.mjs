import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';
import { classifyTransition, expectedSessionStrategy, validateTransition } from '../../tools/lib/transition.mjs';

async function base() { return readYaml(resolve(frameworkRoot, 'contracts/templates/transition-manifest.yaml')); }
async function workflow() { return readYaml(resolve(frameworkRoot, 'core/workflow.yaml')); }

function identitiesFor(strategy) {
  if (strategy === 'NEW_INDEPENDENT') return ['author-or-executor', 'independent-assurance'];
  return ['current-role', 'original-destination'];
}

async function manifestFor(from, to) {
  const manifest = await base();
  const strategy = expectedSessionStrategy(from, to) ?? 'SAME_SESSION';
  const [current_identity, destination_identity] = identitiesFor(strategy);
  manifest.from_phase = from;
  manifest.to_phase = to;
  manifest.from_skill = from;
  manifest.to_skill = to;
  manifest.session = { line: 'derived', strategy, current_identity, destination_identity };
  manifest.independence_required = strategy === 'NEW_INDEPENDENT';
  return manifest;
}

test('ACC-008 every initial automatic edge chains with its required topology', async () => {
  const graph = await workflow();
  for (const edge of graph.automatic_transitions) {
    const manifest = await manifestFor(edge.from, edge.to);
    const result = classifyTransition(manifest, graph);
    assert.equal(result.decision, 'CHAINED', `${edge.from} -> ${edge.to}: ${result.blocked.join(', ')}`);
  }
});

test('first contract review and first validation require independent identities', async () => {
  const graph = await workflow();
  for (const [from, to] of [['spec', 'contract-review'], ['execute-contract', 'validate-delivery']]) {
    const manifest = await manifestFor(from, to);
    manifest.session.destination_identity = manifest.session.current_identity;
    assert.equal(classifyTransition(manifest, graph).decision, 'BLOCKED');
  }
});

test('rework, correction and revalidation route to the original session role', () => {
  assert.equal(expectedSessionStrategy('contract-review', 'spec'), 'ORIGINAL_AUTHOR');
  assert.equal(expectedSessionStrategy('validate-delivery', 'correct-from-validation'), 'ORIGINAL_EXECUTOR');
  assert.equal(expectedSessionStrategy('correct-from-validation', 'validate-delivery'), 'ORIGINAL_VALIDATOR');
});

test('CR-005 final review and closeout entry remain human checkpoints', async () => {
  const graph = await workflow();
  for (const [from, to] of [['validate-delivery', 'final-review'], ['final-review', 'delivery-closeout']]) {
    const manifest = await manifestFor(from, to);
    manifest.decision = 'CHECKPOINT_REQUIRED';
    const result = await validateTransition(manifest);
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(result.automatic, false);
    assert.equal(result.human, true);
    assert.equal(result.decision, 'CHECKPOINT_REQUIRED');
  }
  assert.equal(graph.automatic_transitions.some((edge) => edge.from === 'final-review' && edge.to === 'delivery-closeout'), false);
});

test('unknown edge and failed material guards block', async () => {
  const graph = await workflow();
  const unknown = await manifestFor('spec', 'post-operation');
  assert.equal(classifyTransition(unknown, graph).decision, 'BLOCKED');
  for (const field of ['authorization_current', 'artifact_final', 'hashes_match', 'assurance_satisfied', 'evidence_sufficient']) {
    const manifest = await manifestFor('contract-review', 'execute-contract');
    manifest[field] = false;
    assert.equal(classifyTransition(manifest, graph).decision, 'BLOCKED', field);
  }
});

test('pending human decision or checkpoint prevents chaining', async () => {
  const graph = await workflow();
  for (const field of ['pending_decision', 'checkpoint_pending']) {
    const manifest = await manifestFor('contract-review', 'execute-contract');
    manifest[field] = true;
    assert.equal(classifyTransition(manifest, graph).decision, 'CHECKPOINT_REQUIRED', field);
  }
});

test('scope, path, permission, Git or remote authority cannot expand', async () => {
  const graph = await workflow();
  for (const field of ['scope_unchanged', 'paths_unchanged', 'permissions_unchanged']) {
    const manifest = await manifestFor('contract-review', 'execute-contract');
    manifest.authority[field] = false;
    assert.equal(classifyTransition(manifest, graph).decision, 'BLOCKED', field);
  }
  const git = await manifestFor('contract-review', 'execute-contract');
  git.authority.git_actions_requested = true;
  assert.equal(classifyTransition(git, graph).decision, 'BLOCKED');
  const remote = await manifestFor('contract-review', 'execute-contract');
  remote.authority.remote_actions_requested = true;
  assert.equal(classifyTransition(remote, graph).decision, 'BLOCKED');
});

test('declared transition decision cannot override computed guards', async () => {
  const manifest = await manifestFor('contract-review', 'execute-contract');
  manifest.hashes_match = false;
  const result = await validateTransition(manifest);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /differs from computed/);
});
