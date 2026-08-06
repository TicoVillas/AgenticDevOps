import { resolve } from 'node:path';
import { frameworkRoot } from './lib/io.mjs';
import { validateM2Contracts } from './lib/m2-contracts.mjs';

const root = process.argv[2] ? resolve(process.argv[2]) : frameworkRoot;
const result = await validateM2Contracts(root);
console.log(JSON.stringify(result));
if (!result.ok) process.exitCode = 1;
