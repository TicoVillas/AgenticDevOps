import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import YAML from 'yaml';
import {
  buildFrameworkLock,
  sha256,
  verifyFrameworkLock,
  writeFrameworkLock,
} from '../../tools/lib/source-lock.mjs';
import { generateSourceCatalog } from '../../tools/generate-source-catalog.mjs';

test('sha256 is deterministic', () => {
  assert.equal(sha256(Buffer.from('framework')), sha256(Buffer.from('framework')));
  assert.equal(sha256(Buffer.from('framework')).length, 64);
});

test('framework lock detects drift and unlocked files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'framework-lock-'));
  try {
    await writeFile(join(root, 'source.txt'), 'canonical\n');
    await writeFrameworkLock(root);
    assert.equal((await verifyFrameworkLock(root)).ok, true);
    await writeFile(join(root, 'source.txt'), 'drift\n');
    const drift = await verifyFrameworkLock(root);
    assert.equal(drift.ok, false);
    assert.ok(drift.errors.some((error) => error.includes('Hash mismatch')));
    await writeFile(join(root, 'new.txt'), 'unlocked\n');
    const unlocked = await verifyFrameworkLock(root);
    assert.ok(unlocked.errors.some((error) => error.includes('Unlocked file new.txt')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('logical source inventories exclude Git metadata and dependencies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'framework-inventory-'));
  const manifestPath = join(root, 'adapters/kiro/distribution-manifest.yaml');
  try {
    await mkdir(join(root, 'adapters/kiro'), { recursive: true });
    await mkdir(join(root, 'node_modules/example'), { recursive: true });
    await writeFile(manifestPath, 'managed_items: []\nsource_catalog: []\n');
    await writeFile(join(root, 'source.txt'), 'canonical\n');
    await writeFile(join(root, 'node_modules/example/index.js'), 'dependency\n');

    const lockBeforeGit = await buildFrameworkLock(root);
    await generateSourceCatalog(root);
    const catalogBeforeGit = YAML.parse(await readFile(manifestPath, 'utf8')).source_catalog.map((source) => source.path);

    await mkdir(join(root, '.git/objects'), { recursive: true });
    await writeFile(join(root, '.git/HEAD'), 'ref: refs/heads/main\n');
    await writeFile(join(root, '.git/objects/metadata'), 'operational\n');

    const lockAfterGit = await buildFrameworkLock(root);
    await generateSourceCatalog(root);
    const catalogAfterGit = YAML.parse(await readFile(manifestPath, 'utf8')).source_catalog.map((source) => source.path);
    const lockPaths = Object.keys(lockAfterGit.files);

    assert.deepEqual(Object.keys(lockBeforeGit.files), lockPaths);
    assert.deepEqual(catalogBeforeGit, catalogAfterGit);
    assert.ok(lockPaths.includes('source.txt'));
    assert.ok(catalogAfterGit.includes('source.txt'));
    assert.equal(lockPaths.some((path) => path === '.git' || path.startsWith('.git/')), false);
    assert.equal(catalogAfterGit.some((path) => path === '.git' || path.startsWith('.git/')), false);
    assert.equal(lockPaths.some((path) => path === 'node_modules' || path.startsWith('node_modules/')), false);
    assert.equal(catalogAfterGit.some((path) => path === 'node_modules' || path.startsWith('node_modules/')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
