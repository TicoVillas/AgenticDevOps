import { validateSources } from './lib/sources.mjs';

const result = await validateSources();
console.log(JSON.stringify({ validator: 'validate-sources', ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
