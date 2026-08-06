import { validateDistributionManifest } from './lib/distribution.mjs';

const result = await validateDistributionManifest();
console.log(JSON.stringify({ validator: 'validate-distribution', ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
