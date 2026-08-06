import test from 'node:test';
import assert from 'node:assert/strict';
import { detectDuplicateParagraphs, scanToolCoupling, validatePolicies } from '../../tools/lib/policies.mjs';

test('seven canonical policies have unique ownership and no coupling', async () => {
  const result = await validatePolicies();
  assert.equal(result.ok, true, [...result.errors, ...result.warnings].join('\n'));
  assert.equal(result.policyCount, 7);
  assert.equal(new Set(Object.values(result.ownership)).size, Object.keys(result.ownership).length);
});

test('ACC-015 rejects concrete model catalog outside adapters', () => {
  const errors = scanToolCoupling([{ path: 'policies/invalid.md', text: 'Select GPT-5.6 Sol as a permanent model.' }]);
  assert.equal(errors.length > 0, true);
});

test('ACC-015 accepts capability-only wording', () => {
  const errors = scanToolCoupling([{ path: 'policies/valid.md', text: 'Require high reasoning capability and an equivalent fallback.' }]);
  assert.deepEqual(errors, []);
});

test('duplicate normative paragraphs are detected across owners', () => {
  const paragraph = 'This intentionally duplicated normative paragraph is long enough to represent a copied rule and must be referenced from one canonical owner rather than repeated across documents.';
  const duplicates = detectDuplicateParagraphs([
    { path: 'policies/a.md', text: paragraph },
    { path: 'contracts/b.md', text: paragraph },
  ]);
  assert.equal(duplicates.length, 1);
});
