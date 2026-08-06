import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { frameworkRoot } from '../../tools/lib/io.mjs';
import { checkExplicitAuthorization, compareDeclaredHashToBytes, compareDeclaredHashToFile } from '../../tools/lib/evidence-checks.mjs';

const HASH = 'a'.repeat(64);

test('BR-002 drafts and contract reviews never grant authorization', async () => {
  const fixture = JSON.parse(await readFile(resolve(frameworkRoot, 'tests/fixtures/evidence/br-002.json'), 'utf8'));
  for (const item of fixture.cases) {
    const evidence = item.source === 'USER_AUTHORIZATION'
      ? { source: item.source, current: item.current, operation_id: fixture.operation_id, scope_sha256: fixture.scope_sha256 }
      : { source: item.source, artifact_type: item.source, current: item.current, operation_id: fixture.operation_id, scope_sha256: fixture.scope_sha256 };
    assert.equal(checkExplicitAuthorization({ evidence, operationId: fixture.operation_id, scopeSha256: fixture.scope_sha256 }).authorization_granted, item.authorization_granted);
  }
  assert.equal(checkExplicitAuthorization({ evidence: { source: 'USER_AUTHORIZATION', current: true, operation_id: 'other', scope_sha256: HASH }, operationId: fixture.operation_id, scopeSha256: HASH }).authorization_granted, false);
  assert.equal(checkExplicitAuthorization({ evidence: { source: 'USER_AUTHORIZATION', current: true, scope_sha256: HASH }, scopeSha256: HASH }).authorization_granted, false);
  assert.equal(checkExplicitAuthorization({ evidence: { source: 'USER_AUTHORIZATION', current: true, operation_id: fixture.operation_id, scope_sha256: HASH, expires_at: '2020-01-01T00:00:00Z' }, operationId: fixture.operation_id, scopeSha256: HASH, now: new Date('invalid') }).authorization_granted, false);
});

test('BR-004 hash comparison observes real bytes and returns SNAPSHOT_DIVERGED without mutation', async () => {
  const fixture = JSON.parse(await readFile(resolve(frameworkRoot, 'tests/fixtures/evidence/br-004.json'), 'utf8'));
  const bytes = Buffer.from(fixture.real_bytes);
  assert.equal(compareDeclaredHashToBytes({ declaredSha256: fixture.declared_sha256, bytes }).code, fixture.expected_code);
  const root = await mkdtemp(resolve(tmpdir(), 'evidence-check-'));
  const path = resolve(root, 'state.bin');
  try {
    await writeFile(path, bytes);
    const before = await readFile(path);
    const result = await compareDeclaredHashToFile({ declaredSha256: fixture.declared_sha256, path });
    assert.equal(result.code, 'SNAPSHOT_DIVERGED');
    assert.deepEqual(await readFile(path), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});
