import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareDualBuilds,
  validateNpmPackReport,
  validatePackageConfiguration,
  validatePackageEntries,
} from '../../tools/lib/ci/policy.mjs';

test('package allowlist accepts runtime content and excludes governance', () => {
  const result = validatePackageEntries(['package.json', 'framework.lock', 'core/WorkflowRouter.md', 'tools/validate-all.mjs']);
  assert.equal(result.ok, true);
  assert.equal(result.governance_excluded, true);
});

test('package allowlist rejects governance and unclassified content', () => {
  const result = validatePackageEntries(['package.json', 'framework.lock', '.github/workflows/release.yml', 'tests/ci/workflows.test.mjs', 'README.private']);
  assert.equal(result.ok, false);
  assert(result.errors.some((error) => error.startsWith('GOVERNANCE_IN_PACKAGE:')));
  assert(result.errors.includes('PACKAGE_PATH_OUTSIDE_ALLOWLIST:README.private'));
});

test('npm pack report is checked by the same package policy', () => {
  const result = validateNpmPackReport([{ files: [{ path: 'package.json' }, { path: 'framework.lock' }, { path: 'contracts/templates/artifact.yaml' }] }]);
  assert.equal(result.ok, true);
});

test('package configuration is an explicit runtime allowlist', () => {
  const files = ['adapters/', 'contracts/', 'core/', 'decisions/', 'examples/', 'generated/', 'installers/', 'policies/', 'skills/', 'tools/', 'framework.lock'];
  assert.equal(validatePackageConfiguration({ files }).ok, true);
  assert.equal(validatePackageConfiguration({ files: [...files, '.github/'] }).ok, false);
});

test('dual builds compare logical path hash and size identity', () => {
  const first = [{ path: 'package.tgz', bytes: Buffer.from('same') }];
  assert.equal(compareDualBuilds(first, first).result, 'EQUIVALENT');
  assert.equal(compareDualBuilds(first, [{ path: 'package.tgz', bytes: Buffer.from('different') }]).result, 'BLOCKED_REPRODUCIBILITY_DRIFT');
});
