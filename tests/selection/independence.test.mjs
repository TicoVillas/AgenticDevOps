import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { classifyTransition } from '../../tools/lib/transition.mjs';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';

async function inputs() {
  const manifest = await readYaml(resolve(frameworkRoot, 'contracts/templates/transition-manifest.yaml'));
  const workflow = await readYaml(resolve(frameworkRoot, 'core/workflow.yaml'));
  manifest.from_phase = 'execute-contract';
  manifest.to_phase = 'validate-delivery';
  manifest.session.strategy = 'NEW_INDEPENDENT';
  manifest.session.current_identity = 'executor-session';
  manifest.session.destination_identity = 'validator-session';
  manifest.independence_required = true;
  return { manifest, workflow };
}

test('M1 assurance independence is unchanged by family or model selection', async () => {
  const { manifest, workflow } = await inputs();
  const first = { ...manifest, effective_selection: { family: 'family-a', model: 'tier-a' } };
  const second = { ...manifest, effective_selection: { family: 'family-b', model: 'tier-b' } };
  assert.deepEqual(classifyTransition(first, workflow), classifyTransition(second, workflow));
  assert.equal(classifyTransition(first, workflow).decision, 'CHAINED');
});

test('M1 assurance independence fails only when required role/session identities coincide', async () => {
  const { manifest, workflow } = await inputs();
  manifest.session.destination_identity = manifest.session.current_identity;
  manifest.effective_selection = { family: 'any-family', model: 'any-tier' };
  const result = classifyTransition(manifest, workflow);
  assert.equal(result.decision, 'BLOCKED');
  assert.ok(result.blocked.includes('session:assurance-must-be-independent'));
});
