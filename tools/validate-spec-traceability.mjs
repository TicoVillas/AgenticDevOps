import { resolve } from 'node:path';
import { frameworkRoot } from './lib/io.mjs';
import { validateSpecTraceability } from './lib/spec-traceability.mjs';

const root = process.argv[2] ? resolve(process.argv[2]) : frameworkRoot;
const result = await validateSpecTraceability(root);
console.log(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
