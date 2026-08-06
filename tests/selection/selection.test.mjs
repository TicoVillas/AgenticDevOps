import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';
import { compareSelection, validateSelection } from '../../tools/lib/selection.mjs';

const fixture = (name) => readYaml(resolve(frameworkRoot, 'tests/selection/fixtures', `${name}.yaml`));

for (const [name, expected, blocked] of [
  ['match', 'MATCH', false],
  ['user-selected-alternative', 'USER_SELECTED_ALTERNATIVE', false],
  ['fallback-used', 'FALLBACK_USED', false],
  ['not-reported', 'NOT_REPORTED', true],
]) {
  test(`M1 selection fixture computes ${expected}`, async () => {
    const document = await fixture(name);
    assert.equal(compareSelection(document), expected);
    const result = await validateSelection(document);
    assert.equal(result.structurallyValid, true, result.errors.join('\n'));
    assert.equal(result.comparisonValid, true, result.errors.join('\n'));
    assert.equal(result.blocked, blocked);
    assert.equal(result.ok, !blocked);
  });
}

test('M1 user divergence and valid fallback produce no warning or finding', async () => {
  for (const name of ['user-selected-alternative', 'fallback-used']) {
    const result = await validateSelection(await fixture(name));
    assert.deepEqual(result.warnings, []);
    assert.deepEqual(result.findings, []);
    assert.equal(result.ok, true, result.errors.join('\n'));
  }
});

test('M1 rejects a declared result that differs from deterministic comparison', async () => {
  const result = await validateSelection(await fixture('invalid-comparison'));
  assert.equal(result.comparisonValid, false);
  assert.match(result.errors.join('\n'), /differs from computed USER_SELECTED_ALTERNATIVE/);
});

test('M1 strict schema rejects unknown selection fields', async () => {
  const result = await validateSelection(await fixture('invalid-structure'));
  assert.equal(result.structurallyValid, false);
  assert.match(result.errors.join('\n'), /additional properties/);
});

test('M1 invalid fallback flag is classified as an alternative and rejected as inconsistent', async () => {
  const document = await fixture('fallback-used');
  document.effective_selection.model = 'different-tier';
  const result = await validateSelection(document);
  assert.equal(result.comparisonResult, 'USER_SELECTED_ALTERNATIVE');
  assert.equal(result.comparisonValid, false);
  assert.deepEqual(result.warnings, []);
  assert.deepEqual(result.findings, []);
});

test('M1 provider-neutral execution selection template validates', async () => {
  const document = await readYaml(resolve(frameworkRoot, 'contracts/templates/execution-selection.yaml'));
  const result = await validateSelection(document);
  assert.equal(result.ok, true, result.errors.join('\n'));
});
