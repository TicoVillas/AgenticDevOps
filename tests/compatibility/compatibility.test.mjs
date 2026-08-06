import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  evaluateCompatibilityLifecycle,
  renderDiscoveryRouterAlias,
  scanLegacyConsumers,
  validateCompatibility,
  validateDecisionRecords,
} from '../../tools/lib/compatibility.mjs';
import { frameworkRoot, readText, readYaml } from '../../tools/lib/io.mjs';

test('ACC-011 four versioned Decision Records have valid references', async () => {
  const result = await validateDecisionRecords();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.count, 4);
});

test('ACC-010 v3.0 DiscoveryRouter is a generated warning alias', async () => {
  const canonical = await readText(resolve(frameworkRoot, 'core/WorkflowRouter.md'));
  const alias = await readFile(resolve(frameworkRoot, 'adapters/kiro/generated/DiscoveryRouter.md'), 'utf8');
  assert.equal(alias, renderDiscoveryRouterAlias(canonical));
  const result = await validateCompatibility();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.match(result.warnings.join('\n'), /deprecated compatibility/);
});

test('consumer scan ignores the alias itself and finds actual references', () => {
  const consumers = scanLegacyConsumers([
    { path: 'adapters/kiro/generated/DiscoveryRouter.md', text: 'DiscoveryRouter.md' },
    { path: 'consumer/config.md', text: 'Load DiscoveryRouter.md', isNew: true },
  ]);
  assert.deepEqual(consumers, [{ path: 'consumer/config.md', isNew: true }]);
});

test('ACC-010 v3.1 rejects new legacy consumers', async () => {
  const lifecycle = await readYaml(resolve(frameworkRoot, 'adapters/kiro/compatibility-lifecycle.yaml'));
  const result = evaluateCompatibilityLifecycle(lifecycle, '3.1', [{ path: 'new/consumer.md', isNew: true }]);
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /New legacy consumer rejected/);
});

test('ACC-010 v3.2 blocks removal with consumers and permits it after a zero-consumer scan', async () => {
  const lifecycle = await readYaml(resolve(frameworkRoot, 'adapters/kiro/compatibility-lifecycle.yaml'));
  const blocked = evaluateCompatibilityLifecycle(lifecycle, '3.2', [{ path: 'legacy/consumer.md', isNew: false }]);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.removalEligible, false);
  const eligible = evaluateCompatibilityLifecycle(lifecycle, '3.2', []);
  assert.equal(eligible.ok, true);
  assert.equal(eligible.removalEligible, true);
});

test('generated alias drift fails closed', async () => {
  const root = await mkdtemp(join(tmpdir(), 'compatibility-drift-'));
  try {
    await mkdir(resolve(root, 'core'), { recursive: true });
    await mkdir(resolve(root, 'adapters/kiro/generated'), { recursive: true });
    const canonical = '# Router\n';
    const lifecycle = await readText(resolve(frameworkRoot, 'adapters/kiro/compatibility-lifecycle.yaml'));
    await writeFile(resolve(root, 'core/WorkflowRouter.md'), canonical);
    await writeFile(resolve(root, 'adapters/kiro/compatibility-lifecycle.yaml'), lifecycle);
    await writeFile(resolve(root, 'adapters/kiro/generated/DiscoveryRouter.md'), `${renderDiscoveryRouterAlias(canonical)}drift`);
    const result = await validateCompatibility({ root, consumerEntries: [] });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /alias drift/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
