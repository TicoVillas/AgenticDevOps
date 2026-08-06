import { validateAdapters } from './lib/adapters.mjs';

const result = await validateAdapters();
console.log(JSON.stringify({ validator: 'validate-adapters', ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
