import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { validateArtifact } from '../../tools/lib/artifacts.mjs';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';

const hash = 'b'.repeat(64);

test('M1 artifact selection_ref is optional and validates reference plus sha256 when present', async () => {
  const artifact = await readYaml(resolve(frameworkRoot, 'contracts/templates/artifact.yaml'));
  assert.equal((await validateArtifact('requirements', artifact)).ok, true);
  artifact.selection_ref = { reference: 'contracts/selections/round-1.yaml', sha256: hash };
  assert.equal((await validateArtifact('requirements', artifact)).ok, true);
  artifact.selection_ref.sha256 = 'invalid';
  assert.equal((await validateArtifact('requirements', artifact)).ok, false);
});

test('M1 transition requires a valid selection_ref', async () => {
  const transition = await readYaml(resolve(frameworkRoot, 'contracts/templates/transition-manifest.yaml'));
  assert.equal((await validateArtifact('transition-manifest', transition)).ok, true);
  delete transition.selection_ref;
  assert.equal((await validateArtifact('transition-manifest', transition)).ok, false);
});
