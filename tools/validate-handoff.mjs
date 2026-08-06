import { resolve } from 'node:path';
import { frameworkRoot } from './lib/io.mjs';
import { readResponseSnapshot, validateHandoff } from './lib/adapters.mjs';

const snapshotPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(frameworkRoot, 'tests/adapters/snapshots/handoff.json');
const response = await readResponseSnapshot(snapshotPath);
const result = await validateHandoff(response);
console.log(JSON.stringify({ validator: 'validate-handoff', snapshot: snapshotPath, ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
