import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { createNodeFilesystemAdapter } from '../../adapters/lifecycle/node-filesystem.mjs';
import { parseLifecycleArgs } from '../../tools/lib/lifecycle/cli.mjs';
import { createSyntheticLifecycleRuntime, executeLifecycleCommand } from '../../tools/lib/lifecycle/engine.mjs';

export const clock = () => new Date('2026-08-05T12:00:00.000Z');
export const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export async function createLifecycleHarness({ faultInjector = async () => {}, payload = 'synthetic lifecycle payload\n', destinationPayload = null } = {}) {
  const sandboxRoot = await mkdtemp(resolve(tmpdir(), 'agentic-m5-lifecycle-'));
  const roots = Object.fromEntries(['source', 'destination', 'state', 'cache', 'temp'].map((name) => [name, resolve(sandboxRoot, name)]));
  await Promise.all(Object.values(roots).map((path) => mkdir(path, { recursive: true, mode: 0o700 })));
  await mkdir(resolve(roots.source, 'payload'), { recursive: true });
  await mkdir(resolve(roots.source, 'adapters/kiro'), { recursive: true });
  const payloadBytes = Buffer.from(payload);
  await writeFile(resolve(roots.source, 'payload/managed.txt'), payloadBytes);
  if (destinationPayload !== null) {
    await mkdir(resolve(roots.destination, 'managed'), { recursive: true });
    await writeFile(resolve(roots.destination, 'managed/file.txt'), destinationPayload);
  }
  const manifest = {
    schema_version: 1,
    source_catalog: [{ id: 'source-managed', path: 'payload/managed.txt', sha256: sha256(payloadBytes) }],
    managed_items: [{ id: 'managed-file', source_id: 'source-managed', destination: 'managed/file.txt', depends_on: [], self_update: false, apply_phase: 'SUPPORT', mode: '0644' }],
    legacy_retirements: [],
  };
  await writeFile(resolve(roots.source, 'adapters/kiro/distribution-manifest.yaml'), YAML.stringify(manifest));
  await writeFile(resolve(roots.source, 'framework.lock'), `${JSON.stringify({ format: 1, algorithm: 'sha256', files: {} })}\n`);
  await writeFile(resolve(roots.source, 'package.json'), `${JSON.stringify({ name: 'synthetic-source', files: ['payload/'] })}\n`);
  const fs = createNodeFilesystemAdapter();
  const runtime = createSyntheticLifecycleRuntime({
    fs,
    sandboxRoot,
    prohibitedRoots: [resolve(sandboxRoot, 'prohibited-real-like-root')],
    clock,
    sessionId: 'synthetic-session-0001',
    processId: 4242,
    isProcessActive: (candidate) => candidate === 4242,
    faultInjector,
    validateManifest: false,
    knownManagedHashes: destinationPayload === null ? {} : { 'managed-file': [sha256(destinationPayload)] },
  });
  const operationId = 'install-synthetic-0001';
  let authorizationSequence = 0;
  const baseArgs = ['--source', roots.source, '--destination', roots.destination, '--state', roots.state, '--cache', roots.cache, '--temp', roots.temp, '--operation-id', operationId, '--format', 'json'];

  async function plan(command = 'install') {
    return executeLifecycleCommand(parseLifecycleArgs([command, ...baseArgs]), runtime);
  }

  async function authorize(planResult, { operations = ['PLAN', 'APPLY'], operationClass = 'INSTALL', authorizationId = null } = {}) {
    authorizationSequence += 1;
    const id = authorizationId ?? `authorization-synthetic-${String(authorizationSequence).padStart(4, '0')}`;
    const request = planResult.result.authorization_request;
    const envelope = {
      schema_version: 1,
      authorization_id: id,
      operation_id: request.operation_id,
      operation_class: operationClass,
      issued_at: '2026-08-05T11:00:00.000Z',
      expires_at: '2026-08-05T13:00:00.000Z',
      status: 'EXPLICITLY_AUTHORIZED',
      provenance: 'DIRECT_USER_AUTHORIZATION',
      synthetic_only: true,
      scope: request.scope,
      bindings: request.bindings,
      operations,
    };
    const path = resolve(sandboxRoot, `${id}.json`);
    await writeFile(path, `${JSON.stringify(envelope)}\n`, { flag: 'wx', mode: 0o600 });
    return { envelope, path };
  }

  async function apply(planResult, command = 'install') {
    const { path } = await authorize(planResult, { operationClass: command.toUpperCase() });
    return executeLifecycleCommand(parseLifecycleArgs([command, ...baseArgs, '--apply', '--authorization', path]), runtime);
  }

  return Object.freeze({
    sandboxRoot,
    roots,
    fs,
    runtime,
    operationId,
    baseArgs,
    payload: payloadBytes,
    plan,
    authorize,
    apply,
    cleanup: () => rm(sandboxRoot, { recursive: true, force: true }),
  });
}

export async function treeDigest(root) {
  const entries = [];
  async function visit(directory, prefix = '') {
    const names = (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of names) {
      const logical = prefix ? `${prefix}/${entry.name}` : entry.name;
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        entries.push(`d:${logical}`);
        await visit(absolute, logical);
      } else if (entry.isFile()) entries.push(`f:${logical}:${sha256(await readFile(absolute))}`);
      else entries.push(`x:${logical}`);
    }
  }
  await visit(root);
  return sha256(entries.join('\n'));
}
