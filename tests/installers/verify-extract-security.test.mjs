import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { verifyBeforeExtract } from '../../tools/lib/installer/staging.mjs';
import { fileMember, installerFixture, NOW, stagingHarness } from './harness.mjs';

async function absent(path) { try { await access(path); return false; } catch (error) { if (error.code === 'ENOENT') return true; throw error; } }

async function expectMemberFailure(members, pattern) {
  const fixture = await installerFixture({ members });
  const harness = await stagingHarness();
  try {
    await assert.rejects(verifyBeforeExtract({ download: fixture.download, expectedIdentity: fixture.identity, stagingRoot: harness.staging, at: NOW }), pattern);
    assert.equal(await absent(resolve(harness.staging, 'payload')), true);
    assert.deepEqual(await readdir(harness.staging), []);
  } finally { await harness.cleanup(); }
}

test('valid verified payload extracts regular files only and rereads hashes', async (t) => {
  const fixture = await installerFixture();
  const harness = await stagingHarness();
  t.after(harness.cleanup);
  const result = await verifyBeforeExtract({ download: fixture.download, expectedIdentity: fixture.identity, stagingRoot: harness.staging, at: NOW });
  assert.equal(result.file_count, 2);
  assert.equal(result.verification, 'REREAD_HASH_SIZE_MATCH');
  assert.match(await readFile(resolve(result.payload_root, 'core/runtime.txt'), 'utf8'), /^synthetic:/);
  assert.equal(resolve(result.payload_root).startsWith(resolve(harness.staging)), true);
  assert.equal(await absent(resolve(harness.destination, 'core/runtime.txt')), true);
});

test('manifest tamper, signature mismatch, and checksum mismatch materialize zero payload files', async () => {
  for (const role of ['manifest', 'manifest_signature', 'checksums']) {
    const fixture = await installerFixture();
    const harness = await stagingHarness();
    try {
      const name = fixture.request.artifact_roles[role];
      const artifact = fixture.download.artifacts.find((entry) => entry.name === name);
      artifact.bytes[0] ^= 0x01;
      await assert.rejects(verifyBeforeExtract({ download: fixture.download, expectedIdentity: fixture.identity, stagingRoot: harness.staging, at: NOW }));
      assert.equal(await absent(resolve(harness.staging, 'payload')), true, role);
      assert.deepEqual(await readdir(harness.staging), [], role);
    } finally { await harness.cleanup(); }
  }
});

test('logical guards reject traversal, backslash, NUL and absolute paths before extraction', async () => {
  for (const path of ['../escape', 'a\\b', 'a\0b', '/absolute']) await expectMemberFailure([fileMember(path)], /PATH_(?:TRAVERSAL|BACKSLASH|CONTROL_CHARACTER|ABSOLUTE)/);
});

test('logical guards reject symlink, hardlink and special members', async () => {
  for (const [type, pattern] of [['SYMLINK', /SYMLINK_UNEXPECTED/], ['HARDLINK', /HARDLINK_UNEXPECTED/], ['DEVICE', /SPECIAL_TYPE_UNEXPECTED/]]) {
    await expectMemberFailure([{ ...fileMember('unsafe'), type }], pattern);
  }
});

test('duplicate/type conflict and case-fold collision are rejected', async () => {
  await expectMemberFailure([fileMember('same'), fileMember('same')], /ARCHIVE_DUPLICATE_MEMBER/);
  await expectMemberFailure([fileMember('same'), { ...fileMember('same'), type: 'SYMLINK' }], /TYPE_CONFLICT/);
  await expectMemberFailure([fileMember('Case.txt'), fileMember('case.txt')], /CASE_FOLD_COLLISION/);
});

test('staging must be new, owned, mode 0700, disjoint and contained', async (t) => {
  const harness = await stagingHarness();
  t.after(harness.cleanup);
  const fixture = await installerFixture();
  const extracted = await verifyBeforeExtract({ download: fixture.download, expectedIdentity: fixture.identity, stagingRoot: harness.staging, at: NOW });
  assert.equal(extracted.payload_root, resolve(harness.staging, 'payload'));
  assert.equal(await absent(resolve(harness.destination, 'payload')), true);
});
