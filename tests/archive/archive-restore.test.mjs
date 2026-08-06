import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  TRUST_HISTORICAL,
  TRUST_VERIFIED,
  assertSameInventory,
  createDeterministicSnapshot,
  inventorySource,
  parseTarGzip,
  sha256Bytes,
} from '../../tools/lib/archive.mjs';
import {
  assertArtifactBinding,
  assertCompleteBundleVerification,
  assertExtractableSnapshot,
  assertSourceUnchanged,
  createExclusiveRestoreRoot,
  extractSnapshotArchive,
  validateBundleRestorePlan,
  validateRestoreMembers,
} from '../../tools/lib/archive-restore.mjs';

const NOW = '2026-08-03T00:00:00.000Z';
const HEAD = '1'.repeat(40);

async function sourceFixture() {
  const root = await mkdtemp(join(tmpdir(), 'archive-restore-source-'));
  await mkdir(join(root, 'nested'));
  await writeFile(join(root, 'a.txt'), 'alpha\n');
  await writeFile(join(root, 'nested', 'b.txt'), 'beta\n');
  const inventory = await inventorySource({
    id: 'source-one',
    root,
    sourceKind: 'DIRECTORY',
    trustLabel: TRUST_VERIFIED,
    capturedAt: NOW,
  });
  return { root, inventory };
}

function membersFromInventory(inventory) {
  return inventory.files.map((file) => ({
    name: `${inventory.source_set_id}/${file.path}`,
    type: '0',
    size: file.size,
    sha256: file.sha256,
  }));
}

test('safe snapshot restore validates every member before writing and reproduces the canonical inventory', async () => {
  const { root: sourceRoot, inventory } = await sourceFixture();
  const work = await mkdtemp(join(tmpdir(), 'archive-restore-work-'));
  const archivePath = join(work, 'source-one.tar.gz');
  const built = await createDeterministicSnapshot({
    source: { id: 'source-one', root: sourceRoot, sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED },
    inventory,
    outputPath: archivePath,
    workDirectory: work,
  });
  const destinationRoot = join(work, 'restored');
  const result = await extractSnapshotArchive({
    archivePath,
    archive: {
      name: 'snapshots/source-one.tar.gz',
      source_set_id: 'source-one',
      kind: 'SNAPSHOT',
      format: 'TAR_GZIP',
      trust_label: TRUST_VERIFIED,
      sha256: built.sha256,
      size: built.size,
    },
    destinationRoot,
    inventory,
    capturedAt: NOW,
  });
  assert.equal(result.comparison, 'FILE_BY_FILE_IDENTICAL');
  assert.equal(result.file_count, 2);
  assert.equal(await readFile(join(destinationRoot, 'a.txt'), 'utf8'), 'alpha\n');
  assert.equal(await readFile(join(destinationRoot, 'nested', 'b.txt'), 'utf8'), 'beta\n');
});

test('corrupted archive and divergent checksum are rejected without touching approved artifacts', async () => {
  const { root: sourceRoot, inventory } = await sourceFixture();
  const work = await mkdtemp(join(tmpdir(), 'archive-restore-corrupt-'));
  const archivePath = join(work, 'source-one.tar.gz');
  const built = await createDeterministicSnapshot({
    source: { id: 'source-one', root: sourceRoot, sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED },
    inventory,
    outputPath: archivePath,
    workDirectory: work,
  });
  const corrupted = Buffer.from(await readFile(archivePath));
  corrupted[Math.floor(corrupted.length / 2)] ^= 0xff;
  assert.throws(() => parseTarGzip(corrupted));
  assert.throws(() => assertArtifactBinding(built, { name: 'source-one.tar.gz', sha256: 'f'.repeat(64), size: built.size }), /ARCHIVE_HASH_MISMATCH/);
});

test('missing, additional, traversal, absolute, backslash, NUL, and final inventory divergence are rejected', async () => {
  const { root, inventory } = await sourceFixture();
  const members = membersFromInventory(inventory);
  assert.throws(() => validateRestoreMembers({ members: members.slice(0, 1), sourceSetId: 'source-one', inventory }), /ARCHIVE_INVENTORY_MISMATCH/);
  assert.throws(() => validateRestoreMembers({ members: [...members, { ...members[0], name: 'source-one/extra.txt' }], sourceSetId: 'source-one', inventory }), /ARCHIVE_INVENTORY_MISMATCH|ARCHIVE_DUPLICATE_MEMBER/);
  for (const unsafe of ['source-one/../escape', 'source-one//absolute', 'source-one/a\\b', 'source-one/a\0b']) {
    const changed = structuredClone(members);
    changed[0].name = unsafe;
    assert.throws(() => validateRestoreMembers({ members: changed, sourceSetId: 'source-one', inventory }));
  }
  const absolute = structuredClone(members);
  absolute[0].name = '/etc/passwd';
  assert.throws(() => validateRestoreMembers({ members: absolute, sourceSetId: 'source-one', inventory }), /ARCHIVE_ROOT_MISMATCH/);
  await writeFile(join(root, 'extra.txt'), 'extra\n');
  const divergent = await inventorySource({ id: 'source-one', root, sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED, capturedAt: NOW });
  assert.throws(() => assertSameInventory(inventory, divergent), /SOURCE_MODIFIED_DURING_OPERATION/);
});

test('symlink, hard link, device or special type, and case-fold collision members are rejected', async () => {
  const { inventory } = await sourceFixture();
  const members = membersFromInventory(inventory);
  for (const type of ['2', '1', '3', '4', '5', '6']) {
    const changed = structuredClone(members);
    changed[0].type = type;
    assert.throws(() => validateRestoreMembers({ members: changed, sourceSetId: 'source-one', inventory }), /ARCHIVE_TYPE_CONFLICT/);
  }
  const collision = [
    { name: 'source-one/A.txt', type: '0', size: 1, sha256: sha256Bytes(Buffer.from('a')) },
    { name: 'source-one/a.txt', type: '0', size: 1, sha256: sha256Bytes(Buffer.from('b')) },
  ];
  assert.throws(() => validateRestoreMembers({ members: collision, sourceSetId: 'source-one', inventory }), /CASE_FOLD_COLLISION/);
});

test('incomplete bundle and divergent HEAD are rejected before repository restoration', () => {
  assert.doesNotThrow(() => assertCompleteBundleVerification({ stdout: 'The bundle records a complete history.\n', stderr: 'bundle is okay\n' }));
  assert.doesNotThrow(() => assertCompleteBundleVerification({ stdout: '', stderr: 'The bundle records a complete history.\n' }));
  assert.throws(() => assertCompleteBundleVerification({ stdout: 'bundle is okay\n', stderr: '' }), /GIT_BUNDLE_INCOMPLETE/);
  const expectedRefs = [
    { oid: HEAD, ref: 'refs/heads/main' },
    { oid: HEAD, ref: 'refs/remotes/origin/HEAD' },
    { oid: HEAD, ref: 'refs/remotes/origin/main' },
  ];
  const complete = [...expectedRefs, { oid: HEAD, ref: 'HEAD' }];
  assert.deepEqual(validateBundleRestorePlan({ expectedRefs, bundleRefs: complete, expectedHead: HEAD }), {
    expected_ref_count: 3,
    advertised_ref_count: 4,
  });
  assert.throws(() => validateBundleRestorePlan({ expectedRefs, bundleRefs: complete.slice(0, 2), expectedHead: HEAD }), /GIT_BUNDLE_REF_MISMATCH/);
  assert.throws(() => validateBundleRestorePlan({ expectedRefs, bundleRefs: complete, expectedHead: '2'.repeat(40) }), /GIT_BUNDLE_HEAD_MISMATCH/);
});

test('historical untrusted TGZ cannot enter the extraction path', () => {
  assert.throws(() => assertExtractableSnapshot({
    kind: 'HISTORICAL_OPAQUE',
    format: 'OPAQUE_TGZ',
    trust_label: TRUST_HISTORICAL,
  }), /HISTORICAL_TGZ_EXTRACTION_FORBIDDEN/);
});

test('restore root must be new and its controllable ancestry cannot contain a symlink', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'archive-restore-root-'));
  const root = join(parent, 'new-root');
  assert.equal(await createExclusiveRestoreRoot(root), root);
  await assert.rejects(createExclusiveRestoreRoot(root), /RESTORE_ROOT_PREEXISTING/);
  const symlinkParent = await mkdtemp(join(tmpdir(), 'archive-restore-symlink-'));
  const real = join(symlinkParent, 'real');
  await mkdir(real);
  await symlink(real, join(symlinkParent, 'link'));
  await assert.rejects(createExclusiveRestoreRoot(join(symlinkParent, 'link', 'root')), /SYMLINK_ANCESTRY/);
});

test('redownload source modification during operation is detected fail-closed', async () => {
  const { root, inventory: before } = await sourceFixture();
  await writeFile(join(root, 'a.txt'), 'changed\n');
  const after = await inventorySource({ id: 'source-one', root, sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED, capturedAt: NOW });
  assert.throws(() => assertSourceUnchanged(before, after), /REDOWNLOAD_MODIFIED_DURING_OPERATION/);
});
