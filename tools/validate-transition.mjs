import { resolve } from 'node:path';
import { readYaml } from './lib/io.mjs';
import { validateTransition } from './lib/transition.mjs';

const path = resolve(process.argv[2] ?? 'contracts/templates/transition-manifest.yaml');
const result = await validateTransition(await readYaml(path));
console.log(JSON.stringify({ validator: 'validate-transition', path, ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
