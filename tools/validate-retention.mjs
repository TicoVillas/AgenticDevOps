import { resolve } from 'node:path';
import { frameworkRoot } from './lib/io.mjs';
import { validateRetention } from './lib/retention.mjs';

const root = process.argv[2] ? resolve(process.argv[2]) : frameworkRoot;
const result = await validateRetention(root);
console.log(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
