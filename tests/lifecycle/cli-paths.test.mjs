import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { EXIT_CODES, parseLifecycleArgs, runLifecycleCli, sanitizeMessage } from '../../tools/lib/lifecycle/cli.mjs';
import { assertFreshContinuationAuthority, validateAuthorizationEnvelope } from '../../tools/lib/lifecycle/authorization.mjs';
import { assertSyntheticLifecycleRoots, containedLifecyclePath } from '../../tools/lib/lifecycle/paths.mjs';

const roots = ['/tmp/m5/source', '/tmp/m5/destination', '/tmp/m5/state', '/tmp/m5/cache', '/tmp/m5/temp'];
const args = ['install', '--source', roots[0], '--destination', roots[1], '--state', roots[2], '--cache', roots[3], '--temp', roots[4], '--format', 'json'];

test('CLI parser accepts explicit normalized roots and applies format default after parsing', () => {
  const parsed = parseLifecycleArgs(args);
  assert.equal(parsed.command, 'install');
  assert.equal(parsed.options.format, 'json');
  assert.equal(parsed.options.apply, false);
  assert.equal(parseLifecycleArgs(['help']).options.format, 'human');
});

test('CLI usage, authorization and runtime failures have stable exit codes and structured output', async () => {
  const resume = await runLifecycleCli(['resume', ...args.slice(1)], { execute: async () => assert.fail('must not execute') });
  assert.equal(resume.exitCode, EXIT_CODES.USAGE);
  assert.equal(resume.result.reason_code, 'RESUME_REQUIRES_APPLY');

  const apply = await runLifecycleCli([...args, '--apply'], { execute: async () => assert.fail('must not execute') });
  assert.equal(apply.exitCode, EXIT_CODES.USAGE);
  assert.equal(apply.result.reason_code, 'AUTHORIZATION_REQUIRED');

  const blocked = await runLifecycleCli(args, { execute: async () => { throw Object.assign(new Error('SYNTHETIC_RUNTIME_INJECTION_REQUIRED'), { code: 'SYNTHETIC_RUNTIME_INJECTION_REQUIRED' }); } });
  assert.equal(blocked.exitCode, EXIT_CODES.BLOCKED);
  assert.equal(blocked.result.sanitized, true);
});

test('root guards reject overlap, prohibited roots, traversal, backslash and NUL', () => {
  const sandbox = '/tmp/m5-sandbox';
  assert.throws(() => assertSyntheticLifecycleRoots({ sourceRoot: `${sandbox}/source`, destinationRoot: `${sandbox}/source/nested`, stateRoot: `${sandbox}/state`, cacheRoot: `${sandbox}/cache`, tempRoot: `${sandbox}/temp`, sandboxRoot: sandbox, prohibitedRoots: [] }), /LIFECYCLE_ROOTS_MUST_BE_DISJOINT/);
  assert.throws(() => assertSyntheticLifecycleRoots({ sourceRoot: `${sandbox}/source`, destinationRoot: `${sandbox}/destination`, stateRoot: `${sandbox}/state`, cacheRoot: `${sandbox}/cache`, tempRoot: `${sandbox}/temp`, sandboxRoot: sandbox, prohibitedRoots: [`${sandbox}/destination`] }), /REAL_GLOBAL_ROOT_PROHIBITED/);
  for (const path of ['../escape', 'a\\b', 'a\0b', '/absolute']) assert.throws(() => containedLifecyclePath(resolve(sandbox), path));
});

test('sanitization removes credentials, private keys, prompts and user HOME paths', () => {
  const privateMarker = ['-----BEGIN ', 'PRIVATE KEY----- abc -----END ', 'PRIVATE KEY-----'].join('');
  const unsafe = `Authorization: Bearer top.secret token=github_pat_example prompt=private words file_content=secret /home/example/.kiro ${privateMarker}`;
  const safe = sanitizeMessage(unsafe);
  for (const fragment of ['top.secret', 'github_pat_example', 'private words', '/home/example', 'BEGIN PRIVATE KEY']) assert.equal(safe.includes(fragment), false);
  assert.match(safe, /\[REDACTED\]/);
});

test('authorization is explicit, current, scope-bound, and continuation never inherits APPLY authority', () => {
  const expected = {
    operation_id: 'resume-synthetic-0001',
    operation_class: 'RESUME',
    required_operation: 'RESUME',
    scope: { destination_root_id: 'SYNTHETIC_KIRO_ROOT', destination_root_sha256: 'a'.repeat(64), state_root_sha256: 'b'.repeat(64) },
    bindings: { plan_sha256: 'c'.repeat(64), snapshot_sha256: 'd'.repeat(64), source_sha256: 'e'.repeat(64), manifest_sha256: 'f'.repeat(64), lock_sha256: '1'.repeat(64) },
  };
  const envelope = {
    authorization_id: 'authorization-resume-0001',
    operation_id: expected.operation_id,
    operation_class: expected.operation_class,
    issued_at: '2026-08-05T11:00:00.000Z',
    expires_at: '2026-08-05T13:00:00.000Z',
    status: 'EXPLICITLY_AUTHORIZED',
    provenance: 'DIRECT_USER_AUTHORIZATION',
    synthetic_only: true,
    scope: expected.scope,
    bindings: expected.bindings,
    operations: ['RESUME'],
  };
  const now = new Date('2026-08-05T12:00:00.000Z');
  assert.equal(validateAuthorizationEnvelope(envelope, expected, { now }).ok, true);
  assert.equal(assertFreshContinuationAuthority(envelope, expected, { now }).ok, true);
  assert.throws(() => validateAuthorizationEnvelope({ ...envelope, status: 'DRAFT' }, expected, { now }), /AUTHORIZATION_NOT_EXPLICIT/);
  assert.throws(() => validateAuthorizationEnvelope({ ...envelope, scope: { ...envelope.scope, state_root_sha256: '2'.repeat(64) } }, expected, { now }), /AUTHORIZATION_SCOPE_DIVERGED/);
  assert.throws(() => validateAuthorizationEnvelope({ ...envelope, expires_at: '2026-08-05T12:00:00.000Z' }, expected, { now }), /AUTHORIZATION_EXPIRED/);
  assert.throws(() => assertFreshContinuationAuthority({ ...envelope, operations: ['RESUME', 'APPLY'] }, expected, { now }), /INHERITED_APPLY_AUTHORITY_PROHIBITED/);
});