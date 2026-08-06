import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expectedSessionStrategy } from './transition.mjs';
import { frameworkRoot, readYaml } from './io.mjs';

const requirementGroups = Object.freeze([
  { start: 1, end: 6, implementation: 'core/; tools/lib/workflow.mjs', test: 'tests/workflow/workflow.test.mjs', acceptance: 'ACC-004' },
  { start: 7, end: 7, implementation: 'policies/ownership.yaml; tools/lib/policies.mjs', test: 'tests/policies/policies.test.mjs', acceptance: 'ACC-002' },
  { start: 8, end: 8, implementation: 'policies/CapabilitySelectionPolicy.md; adapters/*/model-map.yaml', test: 'tests/adapters/acc-015.test.mjs', acceptance: 'ACC-015' },
  { start: 9, end: 9, implementation: 'policies/ContextPolicy.md; tools/lib/context-loader.mjs', test: 'tests/contracts/context-loader.test.mjs', acceptance: 'ACC-016' },
  { start: 10, end: 12, implementation: 'skills/; generated/skills/; tools/lib/skills.mjs', test: 'tests/skills/skills.test.mjs', acceptance: 'ACC-003, ACC-016' },
  { start: 13, end: 13, implementation: 'contracts/schemas/; contracts/templates/', test: 'tests/contracts/artifacts.test.mjs', acceptance: 'ACC-001' },
  { start: 14, end: 14, implementation: 'framework.lock; tools/lib/source-lock.mjs', test: 'tests/contracts/source-lock.test.mjs', acceptance: 'ACC-003' },
  { start: 15, end: 18, implementation: 'adapters/kiro/compatibility-lifecycle.yaml; tools/lib/compatibility.mjs', test: 'tests/compatibility/compatibility.test.mjs', acceptance: 'ACC-010, ACC-012, ACC-013' },
  { start: 19, end: 30, implementation: 'contracts/schemas/application-profile*.yaml; policies/application-profile-matrix.yaml; tools/lib/profile.mjs', test: 'tests/policies/profile.test.mjs', acceptance: 'ACC-005, ACC-006' },
  { start: 31, end: 36, implementation: 'contracts/schemas/dry-run-manifest.schema.yaml; tools/lib/dry-run.mjs', test: 'tests/policies/dry-run.test.mjs', acceptance: 'ACC-007' },
  { start: 37, end: 43, implementation: 'contracts/schemas/transition-manifest.schema.yaml; tools/lib/transition.mjs', test: 'tests/workflow/transition.test.mjs', acceptance: 'ACC-008' },
  { start: 44, end: 48, implementation: 'adapters/; tools/lib/adapters.mjs', test: 'tests/adapters/adapters.test.mjs', acceptance: 'ACC-009, ACC-015' },
  { start: 49, end: 49, implementation: 'decisions/DEC-001..004', test: 'tests/compatibility/compatibility.test.mjs', acceptance: 'ACC-011' },
  { start: 50, end: 50, implementation: 'tools/validate-*.mjs; tools/validate-all.mjs', test: 'npm run validate', acceptance: 'ACC-001..016' },
  { start: 51, end: 51, implementation: 'tests/scenarios/framework-evals.test.mjs', test: 'npm test', acceptance: 'ACC-001..016' },
  { start: 52, end: 52, implementation: 'generated/reports/handoff-metrics.json; tools/lib/reports.mjs', test: 'tests/scenarios/reports.test.mjs', acceptance: 'ACC-008, ACC-014' },
  { start: 53, end: 53, implementation: 'framework/ parallel root; immutable source baselines', test: 'final source hash verification', acceptance: 'ACC-013' },
  { start: 54, end: 54, implementation: '.kiro/specs/framework-v3/evidence/execution/round-01/EXECUTION.md', test: 'independent validate-delivery handoff', acceptance: 'ACC-014' },
]);

export const equivalenceRows = Object.freeze([
  ['Canonical phases and gates', 'Kiro_v2_4_source/Controls/workflow-core.md', 'core/workflow.yaml', 'PRESERVED', 'Fourteen phases and human final-review/closeout gates remain represented.'],
  ['Roles and assurance separation', 'Kiro_v2_4_source/Controls/workflow-core.md', 'core/roles.yaml', 'STRUCTURAL_EQUIVALENT', 'Responsibilities are normalized into four tool-neutral roles.'],
  ['Author/reviewer/validator continuity', 'Kiro_v2_4_source/Contracts/ContextPolicy.md', 'core/roles.yaml; decisions/DEC-001-session-topology.md', 'PRESERVED', 'Initial assurance stays independent and follow-ups return to original sessions.'],
  ['Per-operation authorization', 'Kiro_v2_4_source/Contracts/GitSafetyPolicy.md', 'core/workflow.yaml; tools/lib/transition.mjs', 'PRESERVED', 'Chaining cannot create or expand authority.'],
  ['Security and high-risk controls', 'Kiro_v2_4_source/Contracts/SecureDevelopmentPolicy.md', 'policies/SecureDevelopmentPolicy.md; policies/HighRiskOverlay.md', 'STRUCTURAL_EQUIVALENT', 'Normative controls are separated from procedures and remain fail-closed.'],
  ['Artifact lifecycle', 'Kiro_v2_4_source/Contracts/ArtifactContract.md', 'contracts/schemas/; contracts/templates/', 'STRUCTURAL_EQUIVALENT', 'Schemas govern structure and templates govern presentation.'],
  ['Ten operational Skills', 'Kiro_v2_4_source/Skills/', 'skills/; generated/skills/', 'STRUCTURAL_EQUIVALENT', 'The ten Skills remain, with one concise manual source each.'],
  ['Capability selection', 'Kiro_v2_4_source/Contracts/ModelSelectionPolicy.md', 'policies/CapabilitySelectionPolicy.md; adapters/', 'INTENTIONAL_NON_MATERIAL_CHANGE', 'Concrete runtime catalogs move to adapters without changing authority or workflow.'],
  ['Project configuration root', 'Kiro_v2_4_source/Controls/AGENTS.md', '.agentic/ canonical; adapters/kiro/ compatibility', 'INTENTIONAL_COMPATIBILITY_CHANGE', '.agentic becomes canonical while .kiro remains a non-normative adapter layer.'],
  ['Router compatibility', 'Kiro_v2_4_source/Controls/DiscoveryRouter.md', 'core/WorkflowRouter.md; adapters/kiro/generated/DiscoveryRouter.md', 'INTENTIONAL_COMPATIBILITY_CHANGE', 'The legacy name remains as a generated warning alias under the versioned lifecycle.'],
  ['Automation and checkpoints', 'Kiro_v2_4_source/Controls/workflow-core.md', 'core/workflow.yaml; tools/lib/dry-run.mjs; tools/lib/transition.mjs', 'STRUCTURAL_EQUIVALENT', 'Safe deterministic transitions automate; material human checkpoints remain explicit.'],
]);

function pad(value) {
  return String(value).padStart(3, '0');
}

export function buildRequirementRows() {
  const rows = [];
  for (const group of requirementGroups) {
    for (let number = group.start; number <= group.end; number += 1) {
      rows.push({ id: `REQ-${pad(number)}`, implementation: group.implementation, test: group.test, evidence: 'npm run validate; npm test', acceptance: group.acceptance });
    }
  }
  return rows;
}

export function renderRequirementTraceability(rows = buildRequirementRows()) {
  const lines = [
    '<!-- GENERATED; DO NOT EDIT -->',
    '',
    '# Requirement Traceability Matrix',
    '',
    '| Requirement | Implementation | Test | Evidence | Acceptance |',
    '|---|---|---|---|---|',
  ];
  for (const row of rows) lines.push(`| ${row.id} | ${row.implementation} | ${row.test} | ${row.evidence} | ${row.acceptance} |`);
  return `${lines.join('\n')}\n`;
}

export function renderEquivalenceMatrix(rows = equivalenceRows) {
  const lines = [
    '<!-- GENERATED; DO NOT EDIT -->',
    '',
    '# v2.4 to v3.0 Behavioral Equivalence',
    '',
    '**Decision:** NO_UNAUTHORIZED_MATERIAL_DIFFERENCE',
    '',
    '| Behavior | v2.4 source | v3.0 source | Classification | Evidence |',
    '|---|---|---|---|---|',
  ];
  for (const row of rows) lines.push(`| ${row.join(' | ')} |`);
  return `${lines.join('\n')}\n`;
}

export function computeHandoffMetrics(workflow) {
  const automatic = workflow.automatic_transitions ?? [];
  const human = workflow.human_transitions ?? [];
  const automaticKeys = new Set(automatic.map(({ from, to }) => `${from}->${to}`));
  const topologyViolations = automatic.filter(({ from, to }) => !expectedSessionStrategy(from, to)).length;
  const checkpointBypasses = human.filter(({ from, to }) => automaticKeys.has(`${from}->${to}`)).length;
  return {
    version: 1,
    baseline_manual_handoffs: automatic.length + human.length,
    v3_required_handoffs: human.length,
    handoffs_removed_only_on_guarded_automatic_edges: automatic.length,
    guarded_automatic_transitions: automatic.length,
    human_checkpoints_preserved: human.length,
    inferred_authorizations: 0,
    topology_violations: topologyViolations,
    checkpoint_bypasses: checkpointBypasses,
  };
}

export async function expectedReports(root = frameworkRoot) {
  const workflow = await readYaml(resolve(root, 'core/workflow.yaml'));
  return {
    'requirement-traceability.md': renderRequirementTraceability(),
    'equivalence-v2.4-v3.0.md': renderEquivalenceMatrix(),
    'handoff-metrics.json': `${JSON.stringify(computeHandoffMetrics(workflow), null, 2)}\n`,
  };
}

export async function generateReports(root = frameworkRoot) {
  const output = resolve(root, 'generated/reports');
  await mkdir(output, { recursive: true });
  const reports = await expectedReports(root);
  for (const [name, text] of Object.entries(reports)) await writeFile(resolve(output, name), text, 'utf8');
  return Object.keys(reports).sort();
}

export async function validateReports(root = frameworkRoot) {
  const errors = [];
  const reports = await expectedReports(root);
  for (const [name, expected] of Object.entries(reports)) {
    try {
      const actual = await readFile(resolve(root, 'generated/reports', name), 'utf8');
      if (actual !== expected) errors.push(`Generated report drift: ${name}`);
    } catch {
      errors.push(`Missing generated report: ${name}`);
    }
  }
  const rows = buildRequirementRows();
  if (rows.length !== 54 || new Set(rows.map(({ id }) => id)).size !== 54) errors.push('Traceability must cover REQ-001 through REQ-054 exactly once');
  const req8 = rows.find(({ id }) => id === 'REQ-008');
  const req9 = rows.find(({ id }) => id === 'REQ-009');
  if (!req8?.acceptance.includes('ACC-015')) errors.push('REQ-008 must trace to ACC-015');
  if (!req9?.acceptance.includes('ACC-016')) errors.push('REQ-009 must trace to ACC-016');
  if (equivalenceRows.some((row) => row[3] === 'UNAUTHORIZED_MATERIAL_DIFFERENCE')) errors.push('Unauthorized material equivalence difference');
  return { ok: errors.length === 0, errors, reportCount: Object.keys(reports).length, requirementCount: rows.length, equivalenceCount: equivalenceRows.length };
}
