import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  detectDuplicateInformation,
  detectDuplicateMetadata,
  readResponseSnapshot,
  validateAdapters,
  validateHandoff,
  validateResponse,
} from '../../tools/lib/adapters.mjs';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';

const snapshot = (name) => resolve(frameworkRoot, 'tests/adapters/snapshots', `${name}.json`);

for (const name of ['delta', 'handoff', 'review']) {
  test(`ACC-009 ${name} response snapshot obeys its profile`, async () => {
    const response = await readResponseSnapshot(snapshot(name));
    const result = await validateHandoff(response);
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(`${JSON.stringify(response, null, 2)}\n`, await readFile(snapshot(name), 'utf8'));
  });
}

test('adapter contract preserves core semantics and resolves concrete models only in adapters', async () => {
  const result = await validateAdapters();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.adapterCount, 4);
  assert.equal(result.modelMappings, 4);
});

test('Kiro adapter always uses Default and keeps .kiro non-normative', async () => {
  const adapter = await readYaml(resolve(frameworkRoot, 'adapters/kiro/adapter.yaml'));
  assert.equal(adapter.agent, 'Default');
  assert.equal(adapter.canonical_project_root, '.agentic');
  assert.deepEqual(adapter.compatibility, { root: '.kiro', normative: false });
});

test('ACC-009 rejects duplicated information across response sections', () => {
  const duplicates = detectDuplicateInformation({
    PREAMBLE: 'The canonical contract remains unchanged for this execution.',
    HANDOFF: 'The canonical contract remains unchanged for this execution.',
  });
  assert.equal(duplicates.length, 1);
});

test('ACC-009 rejects duplicated metadata across response sections', () => {
  const duplicates = detectDuplicateMetadata({ PREAMBLE: 'Status: READY', HANDOFF: 'Status: READY' });
  assert.equal(duplicates.length, 1);
});

test('HANDOFF rejects preambles and instructions beyond flexible budgets', async () => {
  const response = await readResponseSnapshot(snapshot('handoff'));
  response.sections.PREAMBLE = 'one\ntwo\nthree\nfour\nfive';
  response.sections.INSTRUCTION += '\n31\n32\n33\n34\n35\n36\n37';
  const result = await validateHandoff(response);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /preamble lines exceeds 4/);
  assert.match(result.errors.join('\n'), /instruction lines exceeds flexible maximum 36/);
});

test('REVIEW rejects sections outside decision, findings, missing evidence, and next phase', async () => {
  const profiles = await readYaml(resolve(frameworkRoot, 'adapters/chatgpt/response-profiles.yaml'));
  const result = validateResponse({
    profile: 'REVIEW',
    sections: { DECISION: 'APPROVED', FINDINGS: 'None', MISSING_EVIDENCE: 'None', NEXT_PHASE: 'Execute', SUMMARY: 'Repeated' },
  }, profiles);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /section SUMMARY is not allowed/);
});

test('FULL_ARTIFACT requires an explicit request', async () => {
  const profiles = await readYaml(resolve(frameworkRoot, 'adapters/chatgpt/response-profiles.yaml'));
  const result = validateResponse({ profile: 'FULL_ARTIFACT', sections: { BODY: 'Complete artifact content.' } }, profiles);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /requires explicit_request=true/);
});

test('HANDOFF requires recommendation, rationale, and fallback guidance', async () => {
  const response = await readResponseSnapshot(snapshot('handoff'));
  delete response.sections.SELECTION_RATIONALE;
  const result = await validateHandoff(response);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /missing section SELECTION_RATIONALE/);
});
