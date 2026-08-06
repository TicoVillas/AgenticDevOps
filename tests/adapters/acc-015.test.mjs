import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { validateAdapters } from '../../tools/lib/adapters.mjs';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';
import { scanToolCoupling } from '../../tools/lib/policies.mjs';

test('ACC-015 rejects a concrete model outside adapters', () => {
  const errors = scanToolCoupling([{ path: 'core/invalid.yaml', text: 'preferred_model: GPT-5.6 Sol' }]);
  assert.equal(errors.length, 1);
});

test('ACC-015 resolves concrete preferred and fallback models through adapters', async () => {
  const result = await validateAdapters();
  assert.equal(result.ok, true, result.errors.join('\n'));
  for (const adapter of ['codex', 'claude']) {
    const map = await readYaml(resolve(frameworkRoot, 'adapters', adapter, 'model-map.yaml'));
    for (const mapping of map.mappings) {
      assert.ok(mapping.capability);
      assert.ok(mapping.effort);
      assert.ok(mapping.preferred_model);
      assert.ok(mapping.fallback_model);
    }
  }
});
