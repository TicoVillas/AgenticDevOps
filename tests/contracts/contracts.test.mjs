import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';
import { validateArtifact, validateArtifacts } from '../../tools/lib/artifacts.mjs';

const template = (name) => readYaml(resolve(frameworkRoot, `contracts/templates/${name}.yaml`));

test('all shared schemas compile under Ajv strict mode', async () => {
  const result = await validateArtifacts();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.ok(result.count >= 16);
});

test('artifact template validates and missing status is rejected', async () => {
  const valid = await template('artifact');
  assert.equal((await validateArtifact('requirements', valid)).ok, true);
  delete valid.status;
  const invalid = await validateArtifact('requirements', valid);
  assert.equal(invalid.ok, false);
  assert.ok(invalid.errors.some((error) => error.includes("required property 'status'")));
});

test('finding and warning share one strict schema', async () => {
  const valid = await template('finding');
  assert.equal((await validateArtifact('finding', valid)).ok, true);
  valid.id = 'invalid';
  assert.equal((await validateArtifact('finding', valid)).ok, false);
});

test('application profile and seven-field override templates validate', async () => {
  assert.equal((await validateArtifact('application-profile', await template('application-profile'))).ok, true);
  const override = await template('application-profile.override');
  assert.equal((await validateArtifact('application-profile-override', override)).ok, true);
  delete override.authorization_ref;
  assert.equal((await validateArtifact('application-profile-override', override)).ok, false);
});

test('dry-run and transition manifests reuse the evidence envelope', async () => {
  const dryRun = await template('dry-run-manifest');
  const transition = await template('transition-manifest');
  assert.equal((await validateArtifact('dry-run-manifest', dryRun)).ok, true);
  assert.equal((await validateArtifact('transition-manifest', transition)).ok, true);
  dryRun.sanitization.secrets_removed = false;
  assert.equal((await validateArtifact('dry-run-manifest', dryRun)).ok, false);
});

test('unknown artifact type fails closed', async () => {
  const result = await validateArtifact('unknown', {});
  assert.equal(result.ok, false);
});
