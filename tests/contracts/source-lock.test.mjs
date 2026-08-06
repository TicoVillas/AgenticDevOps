import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sha256, verifyFrameworkLock, writeFrameworkLock } from '../../tools/lib/source-lock.mjs';

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
