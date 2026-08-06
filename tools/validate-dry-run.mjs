import { resolve } from 'node:path';
import { readYaml } from './lib/io.mjs';
import { validateDryRun } from './lib/dry-run.mjs';

const path = resolve(process.argv[2] ?? 'contracts/templates/dry-run-manifest.yaml');
const result = await validateDryRun(await readYaml(path));
console.log(JSON.stringify({ validator: 'validate-dry-run', path, ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
