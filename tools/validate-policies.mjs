import { validatePolicies } from './lib/policies.mjs';

const result = await validatePolicies();
console.log(JSON.stringify({ validator: 'validate-policies', ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
