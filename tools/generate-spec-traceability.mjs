import { resolve } from 'node:path';
import { frameworkRoot } from './lib/io.mjs';
import { generateSpecTraceability } from './lib/spec-traceability.mjs';

const root = process.argv[2] ? resolve(process.argv[2]) : frameworkRoot;
console.log(JSON.stringify({ generated: await generateSpecTraceability(root) }));
