import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { frameworkRoot, readText, readYaml } from '../../tools/lib/io.mjs';
import { assertTransitionAbsent, validateWorkflow, validateWorkflowDocuments } from '../../tools/lib/workflow.mjs';

async function documents() {
  return {
    workflow: await readYaml(resolve(frameworkRoot, 'core/workflow.yaml')),
    rolesDocument: await readYaml(resolve(frameworkRoot, 'core/roles.yaml')),
    statusesDocument: await readYaml(resolve(frameworkRoot, 'core/statuses.yaml')),
    humanView: await readText(resolve(frameworkRoot, 'core/workflow-core.md')),
  };
}

test('workflow schemas and semantics are valid', async () => {
  const result = await validateWorkflow();
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(result.counts.phases, 14);
});

test('final review and closeout entry remain human-authorized', async () => {
  const { workflow } = await documents();
  assert.equal(assertTransitionAbsent(workflow, 'validate-delivery', 'final-review'), true);
  assert.equal(assertTransitionAbsent(workflow, 'final-review', 'delivery-closeout'), true);
  assert.ok(workflow.human_transitions.some((edge) => edge.from === 'validate-delivery' && edge.to === 'final-review'));
  assert.ok(workflow.human_transitions.some((edge) => edge.from === 'final-review' && edge.to === 'delivery-closeout'));
});

test('all phases expose a non-empty status set', async () => {
  const { workflow, statusesDocument } = await documents();
  for (const { id } of workflow.phases) assert.ok(statusesDocument.statuses[id]?.length, id);
});

test('unknown transition edge is rejected', async () => {
  const input = await documents();
  input.workflow = structuredClone(input.workflow);
  input.workflow.automatic_transitions.push({ from: 'missing-phase', to: 'spec', guard: 'invalid' });
  const result = validateWorkflowDocuments(input);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Unknown transition source missing-phase')));
});

test('unknown status phase is rejected', async () => {
  const input = await documents();
  input.statusesDocument = structuredClone(input.statusesDocument);
  input.statusesDocument.statuses.unknown = ['COMPLETED'];
  const result = validateWorkflowDocuments(input);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('Status set references unknown phase unknown')));
});

test('CR-005 human transitions cannot migrate to the automatic allowlist', async () => {
  const input = await documents();
  input.workflow = structuredClone(input.workflow);
  input.workflow.automatic_transitions.push({ from: 'validate-delivery', to: 'final-review', guard: 'invalid' });
  const result = validateWorkflowDocuments(input);
  assert.ok(result.errors.some((error) => error.includes('cannot be automatic')));
});
