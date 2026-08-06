import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { frameworkRoot } from '../../tools/lib/io.mjs';
import { buildSpecTraceability, expectedSpecTraceability, extractMaterialTasks, extractRequirementIds, locateSpec, parseTraceabilityReport, validateSpecTraceability, validateTraceabilityRows } from '../../tools/lib/spec-traceability.mjs';

test('ACC-016 extracts exactly 157 unique Spec IDs from the parent root', async () => {
  const spec = await locateSpec(frameworkRoot);
  const requirements = extractRequirementIds(await readFile(resolve(spec, 'requirements.md'), 'utf8'));
  assert.equal(requirements.length, 157);
  assert.equal(new Set(requirements.map(({ id }) => id)).size, 157);
  assert.equal(buildSpecTraceability(requirements).length, 157);
});

test('traceability generation is deterministic and validates from an in-memory report', async () => {
  const first = await expectedSpecTraceability();
  const second = await expectedSpecTraceability();
  assert.equal(first, second);
  const result = await validateSpecTraceability(frameworkRoot, { text: first });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.requirementCount, 157);
});

test('traceability validator rejects duplicate IDs and empty columns', async () => {
  const rows = parseTraceabilityReport(await expectedSpecTraceability());
  rows[1].id = rows[0].id;
  rows[2].test = '';
  const errors = validateTraceabilityRows(rows);
  assert.ok(errors.some((error) => error.includes('Duplicate requirement ID')));
  assert.ok(errors.some((error) => error.includes('empty test')));
});

test('mandatory transversal links name concrete tasks, tests, and evidence', async () => {
  const rows = parseTraceabilityReport(await expectedSpecTraceability());
  assert.match(rows.find(({ id }) => id === 'NFR-010').task, /M2\.2\/M2\.8\/M5\.1\/M9\.7\/M15\.2/);
  assert.match(rows.find(({ id }) => id === 'BR-002').task, /M2\.8\/M8\.8/);
  assert.match(rows.find(({ id }) => id === 'BR-004').evidence, /SNAPSHOT_DIVERGED/);
  assert.match(rows.find(({ id }) => id === 'BR-006').task, /fault injection/);
});

test('ACC-016 reverse coverage rejects a material task without a requirement row link', async () => {
  const rows = parseTraceabilityReport(await expectedSpecTraceability());
  const errors = validateTraceabilityRows(rows, extractMaterialTasks('- [ ] M99.1 Material future task'));
  assert.ok(errors.includes('Untraced material task M99.1'));
});
