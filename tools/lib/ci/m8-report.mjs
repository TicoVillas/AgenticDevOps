import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { frameworkRoot } from '../io.mjs';

function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }

export function expectedM8CiReport() {
  return json({
    schema_version: 1,
    milestone: 'M8.1-M8.9',
    result: 'PASS',
    workflow_activation: false,
    network_access_authorized: false,
    credential_access_authorized: false,
    signing_authorized: false,
    release_operation_authorized: false,
    package_lock_unchanged: true,
    dependencies_added: 0,
    pr_permissions: 'CONTENTS_READ',
    untrusted_pr_signing_access: false,
    actions_pinned_to_full_commit: true,
    draft_and_publish_separated: true,
    immutable_gate_reused: 'release-security.evaluateImmutabilityGate',
    independent_checkpoint_required: true,
    draft_authorization_granted: false,
    review_authorization_granted: false,
    evidence_sanitized: true,
    workflows: ['.github/workflows/pr.yml', '.github/workflows/release.yml'],
    tests: ['tests/ci/workflows.test.mjs', 'tests/ci/package-policy.test.mjs', 'tests/ci/release-gates.test.mjs'],
    tested_scope: 'local workflow parsing and synthetic in-memory fixtures only',
  });
}

export async function generateM8CiReport(root = frameworkRoot) {
  const output = resolve(root, 'generated/reports');
  await mkdir(output, { recursive: true });
  const name = 'm8-ci-release.json';
  await writeFile(resolve(output, name), expectedM8CiReport(), 'utf8');
  return name;
}

export async function validateM8CiReport(root = frameworkRoot) {
  try {
    const actual = await readFile(resolve(root, 'generated/reports/m8-ci-release.json'), 'utf8');
    const expected = expectedM8CiReport();
    return Object.freeze({ ok: actual === expected, errors: actual === expected ? [] : ['Generated M8 report drift: m8-ci-release.json'] });
  } catch (error) {
    return Object.freeze({ ok: false, errors: [`Missing generated M8 report: ${error.code}`] });
  }
}
