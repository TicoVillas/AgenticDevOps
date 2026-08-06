#!/usr/bin/env node
import { resolve } from 'node:path';
import { executeArchiveRestore } from './lib/archive-restore.mjs';

function parseArgs(args) {
  const [command, ...rest] = args;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    if (!key?.startsWith('--') || rest[index + 1] === undefined) throw new Error(`INVALID_ARGUMENT:${key ?? ''}`);
    options[key.slice(2)] = rest[index + 1];
  }
  return { command, options };
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command !== 'execute') throw new Error(`UNKNOWN_COMMAND:${command ?? ''}`);
  for (const required of [
    'project-root',
    'redownload-root',
    'payload-relative',
    'restore-root',
    'operation-id',
    'expected-commit',
    'expected-tree',
    'expected-historical-head',
    'expected-inventory-sha256',
  ]) if (!options[required]) throw new Error(`MISSING_ARGUMENT:${required}`);
  const result = await executeArchiveRestore({
    redownloadRoot: resolve(options['redownload-root']),
    payloadRelative: options['payload-relative'],
    restoreRoot: resolve(options['restore-root']),
    operationId: options['operation-id'],
    expectedCommit: options['expected-commit'],
    expectedTree: options['expected-tree'],
    expectedHistoricalHead: options['expected-historical-head'],
    expectedInventorySha256: options['expected-inventory-sha256'],
    forbiddenRoots: [resolve(options['project-root'])],
    capturedAt: options['captured-at'],
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
