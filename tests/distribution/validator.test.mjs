import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import YAML from 'yaml';
import {
  DISTRIBUTION_MANIFEST,
  validateDistributionManifest,
} from '../../tools/lib/distribution.mjs';
import { frameworkRoot } from '../../tools/lib/io.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const manifestSource = resolve(frameworkRoot, DISTRIBUTION_MANIFEST);
const packageSource = resolve(frameworkRoot, 'package.json');

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'distribution-validator-'));
  const manifest = YAML.parse(await readFile(manifestSource, 'utf8'));
  const packageManifest = JSON.parse(await readFile(packageSource, 'utf8'));
  const lock = { format: 1, algorithm: 'sha256', files: {} };
  for (const source of manifest.source_catalog) {
    const content = Buffer.from(`synthetic:${source.id}\n`);
    const target = resolve(root, source.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
    const hash = sha256(content);
    lock.files[source.path] = hash;
    if (source.hash_mode === 'LOCKED_SHA256') source.sha256 = hash;
  }
  return { root, manifest, lock, packageManifest };
}

async function withFixture(callback) {
  const value = await fixture();
  try { return await callback(value); }
  finally { await rm(value.root, { recursive: true, force: true }); }
}

const validate = (value, overrides = {}) => validateDistributionManifest({
  ...value,
  schemaRoot: frameworkRoot,
  checkGenerated: false,
  ...overrides,
});

test('validator accepts a complete synthetic catalog and performs no mutation', async () => {
  await withFixture(async (value) => {
    const before = structuredClone(value.lock);
    const result = await validate(value);
    assert.equal(result.ok, true, result.errors.join('\n'));
    assert.equal(result.managedCount, 64);
    assert.equal(result.retirementCount, 9);
    assert.deepEqual(value.lock, before);
    for (const [path, hash] of Object.entries(value.lock.files)) assert.equal(sha256(await readFile(resolve(value.root, path))), hash);
  });
});

test('validator rejects missing, unlocked and hash-divergent sources', async () => {
  await withFixture(async (value) => {
    const path = value.manifest.source_catalog.find((source) => source.hash_mode === 'LOCKED_SHA256').path;
    await unlink(resolve(value.root, path));
    let result = await validate(value);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /Source unavailable/);

    await writeFile(resolve(value.root, path), 'tampered\n');
    result = await validate(value);
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /Source hash mismatch/);

    value.lock.files['unlocked-extra.txt'] = 'a'.repeat(64);
    result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /Locked source is not cataloged/);
  });
});

test('validator rejects duplicate and case-fold-colliding destinations', async () => {
  await withFixture(async (value) => {
    value.manifest.managed_items[1].destination = value.manifest.managed_items[0].destination;
    let result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /Duplicate destination/);

    value.manifest.managed_items[1].destination = value.manifest.managed_items[0].destination.toUpperCase();
    result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /Case-fold destination collision/);
  });
});

test('validator rejects traversal, absolute paths and unknown dependencies', async () => {
  await withFixture(async (value) => {
    value.manifest.managed_items[0].destination = '../escape';
    let result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);

    value.manifest.managed_items[0].destination = '/absolute';
    result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);

    value.manifest.managed_items[0].destination = 'core/WorkflowRouter.md';
    value.manifest.managed_items[0].depends_on = ['unknown-item'];
    result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /Unknown dependency/);
  });
});

test('validator rejects source-only destinations and non-Kiro adapters', async () => {
  await withFixture(async (value) => {
    value.manifest.managed_items[0].source_id = 'distribution-manifest';
    let result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /non-installable class SOURCE_ONLY/);

    const chatgpt = value.manifest.source_catalog.find((source) => source.path === 'adapters/chatgpt/adapter.yaml');
    chatgpt.class = 'GLOBAL_KIRO_MANAGED';
    value.manifest.managed_items[0].source_id = chatgpt.id;
    result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /Non-Kiro adapter/);
  });
});

test('validator rejects self-update drift, cycles and package omissions', async () => {
  await withFixture(async (value) => {
    const bootstrap = value.manifest.managed_items.find((item) => item.id === 'skill-bootstrap');
    bootstrap.self_update = false;
    let result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /only self-update/);

    bootstrap.self_update = true;
    const first = value.manifest.managed_items[0];
    first.depends_on = ['skill-bootstrap'];
    result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /cycle/);

    first.depends_on = [];
    value.packageManifest.files = value.packageManifest.files.filter((entry) => entry !== 'adapters/');
    result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /absent from package payload rules/);
  });
});

test('validator rejects exact retirement and generated steering drift', async () => {
  await withFixture(async (value) => {
    value.manifest.legacy_retirements[0].baseline_sha256 = 'b'.repeat(64);
    const result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);
    assert.match(result.errors.join('\n'), /retirements differ/);
  });

  const manifest = YAML.parse(await readFile(manifestSource, 'utf8'));
  const lock = { format: 1, algorithm: 'sha256', files: Object.fromEntries(manifest.source_catalog.map((source) => [source.path, source.sha256 ?? 'a'.repeat(64)])) };
  const packageManifest = JSON.parse(await readFile(packageSource, 'utf8'));
  const result = await validateDistributionManifest({ root: frameworkRoot, manifest, lock, packageManifest, checkFilesystem: false, checkGenerated: true });
  assert.equal(result.errors.some((error) => error.includes('Generated agentic-workflow steering drift')), false);
});

test('validator rejects an orphan GLOBAL_KIRO_MANAGED contract source', async () => {
  await withFixture(async (value) => {
    const orphanHash = 'f'.repeat(64);
    value.manifest.source_catalog.push({
      id: 'schema-orphan-regression',
      path: 'contracts/schemas/orphan-regression.schema.yaml',
      version: '3.0.0',
      class: 'GLOBAL_KIRO_MANAGED',
      adapter_scope: 'universal',
      hash_mode: 'LOCKED_SHA256',
      sha256: orphanHash,
    });
    value.lock.files['contracts/schemas/orphan-regression.schema.yaml'] = orphanHash;

    const result = await validate(value, { checkFilesystem: false });
    assert.equal(result.ok, false);
    assert.match(
      result.errors.join('\n'),
      /GLOBAL_KIRO_MANAGED source must map to exactly one managed item: schema-orphan-regression .* received 0/,
    );
  });
});