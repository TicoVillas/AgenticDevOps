import { resolve } from 'node:path';
import { frameworkRoot, readText, readYaml } from './io.mjs';
import { validateDocument } from './schema.mjs';

export function validateWorkflowDocuments({ workflow, rolesDocument, statusesDocument, humanView }) {
  const errors = [];
  const warnings = [];
  const phases = Array.isArray(workflow?.phases) ? workflow.phases : [];
  const phaseIds = phases.map(({ id }) => id);
  const phaseSet = new Set(phaseIds);
  const roles = new Set(Object.keys(rolesDocument?.roles ?? {}));

  if (phaseSet.size !== phaseIds.length) errors.push('Duplicate phase id');
  for (const phase of phases) {
    if (!roles.has(phase.role)) errors.push(`Unknown role ${phase.role} in ${phase.id}`);
    if (!statusesDocument?.statuses?.[phase.id]) errors.push(`Missing statuses for ${phase.id}`);
    if (!humanView.includes(phase.id)) warnings.push(`Human view does not name phase ${phase.id}`);
  }
  for (const phaseId of Object.keys(statusesDocument?.statuses ?? {})) {
    if (!phaseSet.has(phaseId)) errors.push(`Status set references unknown phase ${phaseId}`);
  }

  const automatic = Array.isArray(workflow?.automatic_transitions) ? workflow.automatic_transitions : [];
  const human = Array.isArray(workflow?.human_transitions) ? workflow.human_transitions : [];
  const allTransitions = [...automatic, ...human];
  for (const transition of allTransitions) {
    if (!phaseSet.has(transition.from)) errors.push(`Unknown transition source ${transition.from}`);
    if (!phaseSet.has(transition.to)) errors.push(`Unknown transition target ${transition.to}`);
  }

  const forbiddenAutomatic = [
    ['validate-delivery', 'final-review'],
    ['final-review', 'delivery-closeout'],
  ];
  for (const [from, to] of forbiddenAutomatic) {
    if (automatic.some((edge) => edge.from === from && edge.to === to)) {
      errors.push(`Human transition ${from} -> ${to} cannot be automatic`);
    }
    if (!human.some((edge) => edge.from === from && edge.to === to)) {
      errors.push(`Required human transition ${from} -> ${to} is absent`);
    }
  }

  const adjacency = new Map(phaseIds.map((id) => [id, []]));
  for (const { from, to } of allTransitions) adjacency.get(from)?.push(to);
  const visited = new Set();
  const queue = ['workflow-bootstrap', 'discovery-high-level'];
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    queue.push(...(adjacency.get(current) ?? []));
  }
  for (const id of phaseIds) if (!visited.has(id)) errors.push(`Unreachable phase ${id}`);

  return { ok: errors.length === 0, errors, warnings, counts: { phases: phaseIds.length, transitions: allTransitions.length } };
}

export async function validateWorkflow({ root = frameworkRoot } = {}) {
  const workflow = await readYaml(resolve(root, 'core/workflow.yaml'));
  const rolesDocument = await readYaml(resolve(root, 'core/roles.yaml'));
  const statusesDocument = await readYaml(resolve(root, 'core/statuses.yaml'));
  const humanView = await readText(resolve(root, 'core/workflow-core.md'));
  const schemaPairs = [
    [workflow, 'contracts/schemas/core/workflow.schema.yaml'],
    [rolesDocument, 'contracts/schemas/core/roles.schema.yaml'],
    [statusesDocument, 'contracts/schemas/core/statuses.schema.yaml'],
  ];
  const schemaErrors = [];
  for (const [document, schemaPath] of schemaPairs) {
    const result = validateDocument(document, await readYaml(resolve(root, schemaPath)));
    schemaErrors.push(...result.errors.map((error) => `${schemaPath}: ${error}`));
  }
  const semantic = validateWorkflowDocuments({ workflow, rolesDocument, statusesDocument, humanView });
  return { ...semantic, ok: semantic.ok && schemaErrors.length === 0, errors: [...schemaErrors, ...semantic.errors] };
}

export function assertTransitionAbsent(workflow, from, to) {
  return !workflow.automatic_transitions.some((edge) => edge.from === from && edge.to === to);
}
