import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { frameworkRoot } from './io.mjs';

export const TRACEABILITY_REPORT = 'generated/reports/framework-governance-and-portability-traceability.md';
const SPEC_SLUG = 'framework-governance-and-portability';
const expectedCounts = Object.freeze({ SEL: 12, REP: 9, ARC: 10, REL: 18, INS: 14, LIF: 20, PRJ: 11, PLT: 7, CICD: 15, CLN: 6, NFR: 10, BR: 7, ACC: 18 });

const domainLinks = Object.freeze({
  SEL: ['Design: Selection guidance flow', 'M1', 'selection contract tests', 'selection validation report'],
  REP: ['Design: Layout and source ownership', 'M2/M9/M10', 'repository and source validators', 'source ownership report'],
  ARC: ['Design: Archive and provenance', 'M2.1/M3', 'archive contract and restore tests', 'archive provenance evidence'],
  REL: ['Design: Release contracts and supply chain', 'M2.1/M4', 'release schema and tamper tests', 'release validation evidence'],
  INS: ['Design: Installer without clone', 'M2.1/M5/M6', 'installer boundary tests', 'installer validation evidence'],
  LIF: ['Design: Lifecycle state and layouts', 'M2.1/M2.2/M5', 'lifecycle contract and recovery tests', 'journal/receipt evidence'],
  PRJ: ['Design: PROJECT_UPDATE isolation', 'M2.3/M8', 'project-update contract tests', 'project receipt evidence'],
  PLT: ['Design: Platform capability contract', 'M2.1/M7/M14', 'platform equivalence tests', 'platform capability evidence'],
  CICD: ['Design: Pipeline and GitHub controls', 'M2.8/M9', 'pipeline policy tests', 'pipeline evidence index'],
  CLN: ['Design: Cleanup and migration layout', 'M10/M15', 'cleanup gate tests', 'cleanup plan evidence'],
  NFR: ['Design: Cross-cutting quality attributes', 'M2/M5/M9/M15', 'cross-cutting regression tests', 'validation reports'],
  BR: ['Design: Business-rule guards', 'M2/M5/M8', 'business-rule negative tests', 'guard evidence'],
  ACC: ['Design: Acceptance matrix', 'M2.8 and linked milestones', 'acceptance tests', 'acceptance evidence'],
});

const specialLinks = Object.freeze({
  'NFR-010': ['Design: Compatibility and migration', 'M2.2/M2.8/M5.1/M9.7/M15.2', 'schema/receipt regression; lifecycle regression; source-to-sibling and pre-cleanup comparison', 'compatibility report linked to M2.8 matrix'],
  'BR-002': ['Design: Explicit authorization evidence', 'M2.8/M8.8', 'draft/review non-authorization validator; no implicit pipeline publish', 'report with draft/review authorization_granted: false'],
  'BR-004': ['Design: Real-state precedence', 'M2.8/M5.3/M9.1/M15.1–M15.2', 'valid artifact hash with divergent filesystem blocks preflight/plan', 'snapshot/plan report with SNAPSHOT_DIVERGED'],
  'BR-006': ['Design: Uncertain-operation hard stop', 'M5.8/fault injection', 'fault injection before/after write; read-only reconcile; blind retry rejection', 'PARTIAL/UNKNOWN journal and reconciliation decision'],
});

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

export async function locateSpec(start = frameworkRoot) {
  let current = resolve(start);
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = resolve(current, '.kiro/specs', SPEC_SLUG);
    if (await exists(resolve(candidate, 'requirements.md'))) return candidate;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  throw new Error(`SPEC_NOT_FOUND:${SPEC_SLUG}`);
}

export function extractRequirementIds(text) {
  const rows = [];
  const pattern = /^- \*\*([A-Z]+-\d{3})(?:\s+\([^)]+\))?(?:\s+—\s+([^*]+)|:)\*\*:?\s*(.*)$/gm;
  for (const match of String(text).matchAll(pattern)) rows.push({ id: match[1], requirement: (match[2] || match[3]).trim() });
  return rows;
}

export function validateRequirementSet(requirements) {
  const errors = [];
  const ids = requirements.map(({ id }) => id);
  for (const id of new Set(ids)) if (ids.filter((candidate) => candidate === id).length !== 1) errors.push(`Duplicate requirement ID ${id}`);
  for (const [prefix, count] of Object.entries(expectedCounts)) {
    const expected = Array.from({ length: count }, (_, index) => `${prefix}-${String(index + 1).padStart(3, '0')}`);
    const actual = ids.filter((id) => id.startsWith(`${prefix}-`));
    for (const id of expected) if (!actual.includes(id)) errors.push(`Missing requirement ID ${id}`);
    for (const id of actual) if (!expected.includes(id)) errors.push(`Unexpected requirement ID ${id}`);
  }
  if (ids.length !== 157) errors.push(`Expected exactly 157 requirement IDs, received ${ids.length}`);
  return errors;
}

const taskDomains = Object.freeze({ 1: 'SEL', 2: 'NFR', 3: 'ARC', 4: 'REL', 5: 'LIF', 6: 'INS', 7: 'PLT', 8: 'PRJ', 9: 'CICD', 10: 'REP', 11: 'CICD', 12: 'REL', 13: 'PLT', 14: 'PLT', 15: 'CLN' });

export function extractMaterialTasks(text) {
  const tasks = [];
  for (const match of String(text).matchAll(/^\s*- \[[ xX]\] (M(\d+)\.\d+)\s+(.+)$/gm)) tasks.push({ id: match[1], milestone: Number(match[2]), title: match[3].trim() });
  return tasks;
}

export function buildSpecTraceability(requirements, materialTasks = []) {
  const errors = validateRequirementSet(requirements);
  if (errors.length) throw new Error(errors.join('; '));
  const rows = requirements.map(({ id, requirement }) => {
    const prefix = id.split('-')[0];
    const [design, task, test, evidence] = specialLinks[id] ?? domainLinks[prefix];
    return { id, requirement, design, task, test, evidence };
  });
  for (const [milestone, prefix] of Object.entries(taskDomains)) {
    const concrete = materialTasks.filter((task) => task.milestone === Number(milestone)).map((task) => task.id);
    if (concrete.length === 0) continue;
    const row = rows.find((candidate) => candidate.id.startsWith(`${prefix}-`) && !Object.hasOwn(specialLinks, candidate.id));
    if (!row) throw new Error(`NO_REQUIREMENT_ROW_FOR_MILESTONE:M${milestone}`);
    row.task = `${row.task}; ${concrete.join('/')}`;
  }
  return rows;
}

function cell(value) {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ').trim();
}

export function renderSpecTraceability(rows) {
  const lines = ['<!-- GENERATED; DO NOT EDIT -->', '', '# Framework Governance and Portability Traceability', '', '| ID | Requirement | Design | Task | Test | Evidence |', '|---|---|---|---|---|---|'];
  for (const row of rows) lines.push(`| ${row.id} | ${cell(row.requirement)} | ${cell(row.design)} | ${cell(row.task)} | ${cell(row.test)} | ${cell(row.evidence)} |`);
  return `${lines.join('\n')}\n`;
}

export function validateTraceabilityRows(rows, materialTasks = []) {
  const errors = validateRequirementSet(rows);
  for (const row of rows) for (const field of ['requirement', 'design', 'task', 'test', 'evidence']) if (!String(row[field] ?? '').trim()) errors.push(`${row.id}: empty ${field}`);
  const linkedTasks = new Set(rows.flatMap((row) => [...String(row.task).matchAll(/\bM\d+\.\d+\b/g)].map((match) => match[0])));
  for (const task of materialTasks) if (!linkedTasks.has(task.id)) errors.push(`Untraced material task ${task.id}`);
  for (const [id, links] of Object.entries(specialLinks)) {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) continue;
    for (const [index, field] of ['design', 'task', 'test', 'evidence'].entries()) if (row[field] !== links[index]) errors.push(`${id}: required ${field} linkage missing`);
  }
  return errors;
}

export function parseTraceabilityReport(text) {
  const rows = [];
  for (const line of String(text).split('\n')) {
    if (!/^\| [A-Z]+-\d{3} \|/.test(line)) continue;
    const cells = line.slice(1, -1).split(/(?<!\\)\|/).map((value) => value.trim().replaceAll('\\|', '|'));
    if (cells.length !== 6) throw new Error(`INVALID_TRACEABILITY_ROW:${line}`);
    rows.push({ id: cells[0], requirement: cells[1], design: cells[2], task: cells[3], test: cells[4], evidence: cells[5] });
  }
  return rows;
}

export async function expectedSpecTraceability(root = frameworkRoot) {
  const spec = await locateSpec(root);
  const [requirementsText, tasksText] = await Promise.all([
    readFile(resolve(spec, 'requirements.md'), 'utf8'),
    readFile(resolve(spec, 'tasks.md'), 'utf8'),
  ]);
  return renderSpecTraceability(buildSpecTraceability(extractRequirementIds(requirementsText), extractMaterialTasks(tasksText)));
}

export async function generateSpecTraceability(root = frameworkRoot) {
  const output = resolve(root, TRACEABILITY_REPORT);
  await mkdir(dirname(output), { recursive: true });
  const text = await expectedSpecTraceability(root);
  await writeFile(output, text, 'utf8');
  return output;
}

export async function validateSpecTraceability(root = frameworkRoot, { text } = {}) {
  const errors = [];
  let expected;
  try { expected = await expectedSpecTraceability(root); } catch (error) { return { ok: false, errors: [error.message], requirementCount: 0 }; }
  let actual = text;
  if (actual == null) {
    try { actual = await readFile(resolve(root, TRACEABILITY_REPORT), 'utf8'); }
    catch { errors.push(`Missing generated report: ${TRACEABILITY_REPORT}`); }
  }
  if (actual != null) {
    let rows = [];
    try {
      const spec = await locateSpec(root);
      const materialTasks = extractMaterialTasks(await readFile(resolve(spec, 'tasks.md'), 'utf8'));
      rows = parseTraceabilityReport(actual);
      errors.push(...validateTraceabilityRows(rows, materialTasks));
    }
    catch (error) { errors.push(error.message); }
    if (actual !== expected) errors.push(`Generated report drift: ${TRACEABILITY_REPORT}`);
    return { ok: errors.length === 0, errors, requirementCount: rows.length };
  }
  return { ok: false, errors, requirementCount: 0 };
}

export { expectedCounts as specRequirementCounts, specialLinks as mandatoryTraceabilityLinks };
