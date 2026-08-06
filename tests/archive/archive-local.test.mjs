import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  TRUST_HISTORICAL,
  TRUST_VERIFIED,
  assertSameInventory,
  createDeterministicSnapshot,
  inventorySource,
  parseTarGzip,
  sha256Bytes,
  validateLogicalPath,
  validateM3Manifest,
  verifyArchiveRecord,
  verifyBundleRefs,
  verifySnapshotArchive,
  verifySnapshotMembers,
} from '../../tools/lib/archive.mjs';

const NOW = '2026-08-02T00:00:00.000Z';
const H = 'a'.repeat(64);

async function fixtureRoot() {
  const root = await mkdtemp(join(tmpdir(), 'archive-local-test-'));
  await mkdir(join(root, 'nested'));
  await writeFile(join(root, 'a.txt'), 'alpha\n');
  await writeFile(join(root, 'nested', 'b.txt'), 'beta\n');
  return root;
}

function manifestFixture() {
  return {
    schema_version: 1,
    manifest_id: 'archive-test-manifest',
    created_at: NOW,
    trust_label: 'HISTORICAL_UNTRUSTED',
    source_sets: [
      { id: 'historical-tgz', origin: 'workspace:historical.tgz', captured_at: NOW, source_kind: 'FILE', trust_label: TRUST_HISTORICAL, git_bundle: false },
      { id: 'source-one', origin: 'workspace:source', captured_at: NOW, source_kind: 'DIRECTORY', trust_label: TRUST_VERIFIED, git_bundle: false },
    ],
    files: [
      { source_set_id: 'historical-tgz', path: 'historical.tgz', sha256: H, size: 1 },
      { source_set_id: 'source-one', path: 'a.txt', sha256: H, size: 1 },
    ],
    archives: [
      { source_set_id: 'historical-tgz', name: 'snapshots/historical.tgz', kind: 'HISTORICAL_OPAQUE', format: 'OPAQUE_TGZ', trust_label: TRUST_HISTORICAL, algorithm: 'sha256', sha256: H, size: 1, reproducible: false },
      { source_set_id: 'source-one', name: 'snapshots/source-one.tar.gz', kind: 'SNAPSHOT', format: 'TAR_GZIP', trust_label: TRUST_VERIFIED, algorithm: 'sha256', sha256: H, size: 1, logical_root: 'source-one', reproducible: true, normalization: { mtime_epoch: 0, owner: 0, group: 0, mode: '0644', gzip_name_and_time: false } },
    ],
  };
}

test('strict inventory is canonical and detects source mutation', async () => {
  const root = await fixtureRoot();
  const before = await inventorySource({ id: 'source-one', root, sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED, capturedAt: NOW });
  assert.deepEqual(before.files.map((file) => file.path), ['a.txt', 'nested/b.txt']);
  const same = await inventorySource({ id: 'source-one', root, sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED, capturedAt: NOW });
  assert.doesNotThrow(() => assertSameInventory(before, same));
  await writeFile(join(root, 'a.txt'), 'changed\n');
  const changed = await inventorySource({ id: 'source-one', root, sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED, capturedAt: NOW });
  assert.throws(() => assertSameInventory(before, changed), /SOURCE_MODIFIED_DURING_OPERATION/);
});

test('inventory rejects symlinks and case-fold collisions', async () => {
  const symlinkRoot = await fixtureRoot();
  await symlink('a.txt', join(symlinkRoot, 'link.txt'));
  await assert.rejects(inventorySource({ id: 'source-one', root: symlinkRoot, sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED, capturedAt: NOW }), /SYMLINK_UNEXPECTED/);
  const collisionRoot = await mkdtemp(join(tmpdir(), 'archive-case-test-'));
  await writeFile(join(collisionRoot, 'A.txt'), 'a');
  await writeFile(join(collisionRoot, 'a.txt'), 'b');
  await assert.rejects(inventorySource({ id: 'source-one', root: collisionRoot, sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED, capturedAt: NOW }), /CASE_FOLD_COLLISION/);
});

test('logical paths reject traversal, absolute, backslash, NUL, and control characters', () => {
  for (const path of ['../a', '/a', 'a\\b', 'a\0b', 'a\nb', 'a//b']) assert.throws(() => validateLogicalPath(path));
  assert.equal(validateLogicalPath('nested/a.txt'), 'nested/a.txt');
});

test('M3 runtime manifest requires explicit archive binding, canonical order, and exact historical trust', () => {
  assert.equal(validateM3Manifest(manifestFixture()).ok, true);
  const missingBinding = manifestFixture(); delete missingBinding.archives[0].source_set_id;
  assert.equal(validateM3Manifest(missingBinding).ok, false);
  const wrongTrust = manifestFixture(); wrongTrust.source_sets[0].trust_label = TRUST_VERIFIED;
  assert.equal(validateM3Manifest(wrongTrust).ok, false);
  const wrongArchiveTrust = manifestFixture(); wrongArchiveTrust.archives[0].trust_label = TRUST_VERIFIED;
  assert.equal(validateM3Manifest(wrongArchiveTrust).ok, false);
  const unsorted = manifestFixture(); unsorted.archives.reverse();
  assert.equal(validateM3Manifest(unsorted).ok, false);
  const duplicate = manifestFixture(); duplicate.archives.push(structuredClone(duplicate.archives[1]));
  assert.equal(validateM3Manifest(duplicate).ok, false);
});

test('deterministic snapshot dual-build matches inventory and rejects corruption/hash mismatch', async () => {
  const root = await fixtureRoot();
  const work = await mkdtemp(join(tmpdir(), 'archive-work-test-'));
  const output = join(work, 'snapshot.tar.gz');
  const source = { id: 'source-one', root, sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED };
  const inventory = await inventorySource({ ...source, capturedAt: NOW });
  const built = await createDeterministicSnapshot({ source, inventory, outputPath: output, workDirectory: work });
  assert.equal(built.dual_build_match, true);
  const verified = await verifySnapshotArchive({ archivePath: output, sourceSetId: source.id, inventory });
  assert.equal(verified.member_count, 2);
  const bytes = await readFile(output);
  bytes[Math.floor(bytes.length / 2)] ^= 0xff;
  await writeFile(output, bytes);
  await assert.rejects(verifySnapshotArchive({ archivePath: output, sourceSetId: source.id, inventory }));
});

test('archive member verification rejects missing, extra, duplicate, traversal, type conflict, and archive hash mismatch', async () => {
  const root = await fixtureRoot();
  const work = await mkdtemp(join(tmpdir(), 'archive-members-test-'));
  const output = join(work, 'snapshot.tar.gz');
  const source = { id: 'source-one', root, sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED };
  const inventory = await inventorySource({ ...source, capturedAt: NOW });
  await createDeterministicSnapshot({ source, inventory, outputPath: output, workDirectory: work });
  const members = parseTarGzip(await readFile(output));
  assert.deepEqual(members.map((member) => member.name), ['source-one/a.txt', 'source-one/nested/b.txt']);
  const missing = structuredClone(inventory); missing.files = missing.files.slice(0, 1);
  assert.throws(() => verifySnapshotMembers({ members, sourceSetId: source.id, inventory: missing }), /ARCHIVE_INVENTORY_MISMATCH/);
  const extra = structuredClone(inventory); extra.files.push({ source_set_id: source.id, path: 'extra.txt', sha256: sha256Bytes(Buffer.from('extra')), size: 5 });
  assert.throws(() => verifySnapshotMembers({ members, sourceSetId: source.id, inventory: extra }), /ARCHIVE_INVENTORY_MISMATCH/);
  assert.throws(() => verifySnapshotMembers({ members: [...members, structuredClone(members[0])], sourceSetId: source.id, inventory }), /ARCHIVE_DUPLICATE_MEMBER/);
  const traversal = structuredClone(members); traversal[0].name = 'source-one/../escape';
  assert.throws(() => verifySnapshotMembers({ members: traversal, sourceSetId: source.id, inventory }), /PATH_TRAVERSAL/);
  const typeConflict = structuredClone(members); typeConflict[0].type = '2';
  assert.throws(() => verifySnapshotMembers({ members: typeConflict, sourceSetId: source.id, inventory }), /ARCHIVE_TYPE_CONFLICT/);
  await assert.rejects(verifyArchiveRecord(work, { name: 'missing.bin', sha256: H, size: 1 }), /ENOENT/);
  await writeFile(join(work, 'wrong.bin'), 'wrong');
  await assert.rejects(verifyArchiveRecord(work, { name: 'wrong.bin', sha256: H, size: 5 }), /ARCHIVE_HASH_MISMATCH/);
});

test('bundle verification rejects a missing ref, changed OID, and unreachable HEAD', () => {
  const head = '1'.repeat(40);
  const other = '2'.repeat(40);
  const sourceRefs = [{ oid: head, ref: 'refs/heads/main' }, { oid: other, ref: 'refs/remotes/origin/main' }];
  assert.deepEqual(verifyBundleRefs(sourceRefs, structuredClone(sourceRefs), head), { source_ref_count: 2, bundle_ref_count: 2 });
  assert.throws(() => verifyBundleRefs(sourceRefs, sourceRefs.slice(0, 1), head), /GIT_BUNDLE_REF_MISMATCH/);
  const changed = structuredClone(sourceRefs); changed[1].oid = head;
  assert.throws(() => verifyBundleRefs(sourceRefs, changed, head), /GIT_BUNDLE_REF_MISMATCH/);
  assert.throws(() => verifyBundleRefs(sourceRefs, sourceRefs, '3'.repeat(40)), /GIT_BUNDLE_HEAD_UNREACHABLE/);
});
