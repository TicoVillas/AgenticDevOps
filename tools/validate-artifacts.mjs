import { resolve } from 'node:path';
import { validateArtifactFile, validateArtifacts } from './lib/artifacts.mjs';

const [type, path] = process.argv.slice(2);
const result = type && path
  ? await validateArtifactFile(type, resolve(path))
  : await validateArtifacts();
console.log(JSON.stringify({ validator: 'validate-artifacts', ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
