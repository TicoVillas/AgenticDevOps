import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, rm, symlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import {
  LEGACY_RETIREMENTS,
  buildDistributionSnapshot,
  classifyDistributionState,
} from '../../tools/lib/distribution.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const CONTENT = Buffer.from('canonical source\n');
const HASH = sha256(CONTENT);

function manifest(destination = 'core/example.md') {
  return {
    source_catalog: [{ id: 'source-example', path: 'core/example.md', sha256: HASH }],
    managed_items: [{ id: 'item-example', source_id: 'source-example', destination, mode: '0644' }],
    legacy_retirements: [{ path: 'steering/workflow-core.md', baseline_sha256: sha256('legacy\n') }],
  };
}

async function roots() {
  const base = await mkdtemp(resolve(tmpdir(), 'distribution-snapshot-'));
  const sourceRoot = resolve(base, 'source');
  const destinationRoot = resolve(base, 'destination');
  await mkdir(resolve(sourceRoot, 'core'), { recursive: true });
  await mkdir(destinationRoot, { recursive: true });
  await writeFile(resolve(sourceRoot, 'core/example.md'), CONTENT);
  return { base, sourceRoot, destinationRoot };
}

async function withRoots(callback) {
  const value = await roots();
  try { return await callback(value); }
  finally { await rm(value.base, { recursive: true, force: true }); }
}

const state = (destination, options = {}) => classifyDistributionState({
  item: { id: 'item-example', destination: 'core/example.md', mode: '0644' },
  source: { presence: 'PRESENT', file_type: 'REGULAR_FILE', sha256: HASH, expected_sha256: HASH },
  destination,
  ...options,
});

test('classifier covers managed, divergent, unmanaged and unknown states', () => {
  assert.equal(state({ presence: 'ABSENT' }), 'ABSENT');
  assert.equal(state({ presence: 'PRESENT', file_type: 'REGULAR_FILE', sha256: HASH, mode: '0644', metadata_applicable: true }), 'IDENTICAL');
  assert.equal(state({ presence: 'PRESENT', file_type: 'REGULAR_FILE', sha256: HASH, mode: '0600', metadata_applicable: true }), 'METADATA_DIVERGENT');
  assert.equal(state({ presence: 'PRESENT', file_type: 'REGULAR_FILE', sha256: 'a'.repeat(64), mode: '0644' }, { knownManagedHashes: ['a'.repeat(64)] }), 'MANAGED_OUTDATED');
  assert.equal(state({ presence: 'PRESENT', file_type: 'REGULAR_FILE', sha256: 'b'.repeat(64), mode: '0644' }, { priorReceipt: { actions: [{ item_id: 'item-example', after_sha256: 'a'.repeat(64) }] } }), 'MANAGED_DIVERGENT');
  assert.equal(state({ presence: 'PRESENT', file_type: 'REGULAR_FILE', sha256: 'c'.repeat(64), mode: '0644' }), 'UNMANAGED_PRESENT');
  assert.equal(state({ presence: 'PRESENT', file_type: 'REGULAR_FILE', sha256: 'c'.repeat(64), mode: '0644' }, { priorReceipt: { unknown_paths: ['core/example.md'] } }), 'UNKNOWN_PARTIAL');
  assert.equal(state({ blocked_state: 'SYMLINK_UNEXPECTED' }), 'SYMLINK_UNEXPECTED');
  assert.equal(state({ blocked_state: 'OUTSIDE_ROOT' }), 'OUTSIDE_ROOT');
  assert.equal(state({ blocked_state: 'TYPE_CONFLICT' }), 'TYPE_CONFLICT');
  assert.equal(classifyDistributionState({ item: { id: 'x' }, source: { presence: 'PRESENT', sha256: 'x', expected_sha256: 'y' }, destination: { presence: 'ABSENT' } }), 'SOURCE_HASH_MISMATCH');
});

test('snapshot identifies absent, identical and metadata divergence without timestamps', async () => {
  await withRoots(async ({ sourceRoot, destinationRoot }) => {
    let snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest(), platform: 'linux' });
    assert.equal(snapshot.items[0].state, 'ABSENT');

    const destination = resolve(destinationRoot, 'core/example.md');
    await mkdir(dirname(destination), { recursive: true });
    await writeFile(destination, CONTENT);
    await chmod(destination, 0o644);
    snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest(), platform: 'linux' });
    assert.equal(snapshot.items[0].state, 'IDENTICAL');
    const hashBeforeTimestampChange = snapshot.snapshot_sha256;
    await utimes(destination, new Date(1_000), new Date(2_000));
    snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest(), platform: 'linux' });
    assert.equal(snapshot.snapshot_sha256, hashBeforeTimestampChange);

    await chmod(destination, 0o600);
    snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest(), platform: 'linux' });
    assert.equal(snapshot.items[0].state, 'METADATA_DIVERGENT');
    const windows = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest(), platform: 'win32' });
    assert.equal(windows.items[0].state, 'IDENTICAL');
    assert.equal(windows.items[0].destination_observation.metadata_applicable, false);
  });
});

test('snapshot blocks source tampering, traversal and unexpected types', async () => {
  await withRoots(async ({ sourceRoot, destinationRoot }) => {
    await writeFile(resolve(sourceRoot, 'core/example.md'), 'tampered\n');
    let snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest() });
    assert.equal(snapshot.items[0].state, 'SOURCE_HASH_MISMATCH');

    snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest('../escape') });
    assert.equal(snapshot.items[0].state, 'OUTSIDE_ROOT');

    await writeFile(resolve(sourceRoot, 'core/example.md'), CONTENT);
    await mkdir(resolve(destinationRoot, 'core/example.md'), { recursive: true });
    snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest() });
    assert.equal(snapshot.items[0].state, 'TYPE_CONFLICT');
  });
});

test('snapshot blocks symlink at destination and ancestor without following it', async () => {
  await withRoots(async ({ base, sourceRoot, destinationRoot }) => {
    const outside = resolve(base, 'outside');
    await mkdir(outside, { recursive: true });
    await symlink(outside, resolve(destinationRoot, 'core'));
    let snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest() });
    assert.equal(snapshot.items[0].state, 'SYMLINK_UNEXPECTED');

    await rm(resolve(destinationRoot, 'core'));
    await mkdir(resolve(destinationRoot, 'core'), { recursive: true });
    await symlink(resolve(outside, 'file.md'), resolve(destinationRoot, 'core/example.md'));
    snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest() });
    assert.equal(snapshot.items[0].state, 'SYMLINK_UNEXPECTED');
  });
});

test('legacy observations distinguish absent, exact and modified content', async () => {
  await withRoots(async ({ sourceRoot, destinationRoot }) => {
    let snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest() });
    assert.equal(snapshot.retirements[0].state, 'ABSENT');
    const legacy = resolve(destinationRoot, 'steering/workflow-core.md');
    await mkdir(dirname(legacy), { recursive: true });
    await writeFile(legacy, 'legacy\n');
    snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest() });
    assert.equal(snapshot.retirements[0].state, 'LEGACY_ACTIVE_CONFLICT');
    await writeFile(legacy, 'locally modified\n');
    snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest() });
    assert.equal(snapshot.retirements[0].state, 'LEGACY_MODIFIED');
  });
});


test('snapshot blocks a source symlink without reading its target', async () => {
  await withRoots(async ({ base, sourceRoot, destinationRoot }) => {
    const source = resolve(sourceRoot, 'core/example.md');
    const outside = resolve(base, 'outside-source.md');
    await writeFile(outside, CONTENT);
    await rm(source);
    await symlink(outside, source);
    const snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: manifest() });
    assert.equal(snapshot.items[0].state, 'SYMLINK_UNEXPECTED');
  });
});

test('snapshot classifies all nine legacy paths as absent, exact and modified', async () => {
  await withRoots(async ({ sourceRoot, destinationRoot }) => {
    const legacyContents = new Map(LEGACY_RETIREMENTS.map(([path], index) => [path, Buffer.from(`legacy-${index}\n`)]));
    const fullManifest = {
      ...manifest(),
      legacy_retirements: [...legacyContents].map(([path, bytes]) => ({ path, baseline_sha256: sha256(bytes) })),
    };

    let snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: fullManifest });
    assert.equal(snapshot.retirements.length, 9);
    assert.ok(snapshot.retirements.every((entry) => entry.state === 'ABSENT'));

    for (const [path, bytes] of legacyContents) {
      const target = resolve(destinationRoot, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes);
    }
    snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: fullManifest });
    assert.ok(snapshot.retirements.every((entry) => entry.state === 'LEGACY_ACTIVE_CONFLICT'));

    for (const path of legacyContents.keys()) await writeFile(resolve(destinationRoot, path), 'locally modified\n');
    snapshot = await buildDistributionSnapshot({ sourceRoot, destinationRoot, manifest: fullManifest });
    assert.ok(snapshot.retirements.every((entry) => entry.state === 'LEGACY_MODIFIED'));
  });
});