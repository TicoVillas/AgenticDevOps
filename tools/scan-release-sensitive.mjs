import { resolve } from 'node:path';
import { frameworkRoot } from './lib/io.mjs';
import { scanSensitiveTree } from './lib/release-security.mjs';

const root = process.argv[2] ? resolve(process.argv[2]) : frameworkRoot;
const result = await scanSensitiveTree(root, { exclude: ['node_modules'], permitLabeledSynthetic: false });
console.log(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
