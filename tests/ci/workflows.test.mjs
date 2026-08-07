import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { frameworkRoot } from '../../tools/lib/io.mjs';
import { collectWorkflowUses, validatePinnedActions } from '../../tools/lib/ci/policy.mjs';
import { validateM8Ci } from '../../tools/validate-m8-ci.mjs';

async function workflow(name) {
  return YAML.parse(await readFile(resolve(frameworkRoot, '.github/workflows', name), 'utf8'));
}

test('all external actions are pinned to full commit hashes', async () => {
  for (const name of ['pr.yml', 'release.yml']) {
    const document = await workflow(name);
    assert.equal(validatePinnedActions(document).ok, true);
    assert(collectWorkflowUses(document).length > 0);
  }
});

test('PR workflow is read-only and exposes no signing context', async () => {
  const source = await readFile(resolve(frameworkRoot, '.github/workflows/pr.yml'), 'utf8');
  const document = YAML.parse(source);
  assert(document.on.pull_request !== undefined);
  assert.equal(document.on.pull_request_target, undefined);
  assert.deepEqual(document.permissions, { contents: 'read' });
  assert(!source.includes('secrets.'));
  for (const required of ['npm ci --ignore-scripts', 'npm run validate', 'npm test', 'git diff --exit-code', 'npm pack --dry-run', 'scan-release-sensitive.mjs', 'Clean dual pack comparison']) assert(source.includes(required), required);
});

test('release workflow separates draft checkpoint publish and reverification', async () => {
  const source = await readFile(resolve(frameworkRoot, '.github/workflows/release.yml'), 'utf8');
  const document = YAML.parse(source);
  for (const id of ['clean-build', 'protected-signing', 'draft', 'draft-redownload-reverify', 'immutability-gate', 'independent-checkpoint', 'publish', 'external-redownload-reverify']) assert(document.jobs[id], id);
  assert.equal(document.jobs.publish.needs, 'independent-checkpoint');
  assert.equal(document.jobs['independent-checkpoint'].needs, 'immutability-gate');
  assert.equal(document.jobs['external-redownload-reverify'].needs, 'publish');
  assert.notEqual(document.jobs.draft.environment, document.jobs.publish.environment);
  assert.equal(document.jobs['immutability-gate'].outputs.decision_sha256, '${{ steps.evaluate.outputs.decision_sha256 }}');
  assert(source.includes('tools/evaluate-m8-release-gate.mjs'));
  assert(source.includes('IMMUTABILITY_DECISION_SHA256'));
  assert(source.includes('M12 protected signer integration is not authorized or configured by M8'));
  assert(source.includes('compensating_control_json'));
  assert(source.includes('compensating_control_authorization_sha256'));
});

test('dual-pack filenames are dynamic and version literals are absent', async () => {
  const prSource = await readFile(resolve(frameworkRoot, '.github/workflows/pr.yml'), 'utf8');
  const releaseSource = await readFile(resolve(frameworkRoot, '.github/workflows/release.yml'), 'utf8');
  for (const source of [prSource, releaseSource]) {
    assert.equal(source.includes('agentic-devops-framework-v3-3.0.0.tgz'), false);
    assert.equal(source.includes('agentic-devops-framework-v3-3.1.0.tgz'), false);
    assert(source.includes('package_filename_a="$(npm pack --ignore-scripts --pack-destination'));
    assert(source.includes('package_filename_b="$(npm pack --ignore-scripts --pack-destination'));
    assert(source.includes('test "$package_filename_a" = "$package_filename_b"'));
  }
  assert(prSource.includes('cmp "$RUNNER_TEMP/pack-a/$package_filename_a" "$RUNNER_TEMP/pack-b/$package_filename_b"'));
  assert(releaseSource.includes('cmp "$RUNNER_TEMP/build-a/$package_filename_a" "$RUNNER_TEMP/build-b/$package_filename_b"'));
  assert(releaseSource.includes("printf 'package_filename=%s\\n' \"$package_filename_a\" >> \"$GITHUB_OUTPUT\""));
  assert(releaseSource.includes('${{ runner.temp }}/build-a/${{ steps.dual_build.outputs.package_filename }}'));
});

test('M8 validator accepts the inactive local workflows', async () => {
  const result = await validateM8Ci();
  assert.deepEqual(result.errors, []);
  assert.equal(result.ok, true);
  assert.equal(result.workflow_activation, false);
  assert.equal(result.publish_authorized, false);
});
