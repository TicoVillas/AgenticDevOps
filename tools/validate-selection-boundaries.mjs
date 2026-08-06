import { validateSelectionBoundaries } from './lib/policies.mjs';

const result = await validateSelectionBoundaries();
console.log(JSON.stringify({ validator: 'validate-selection-boundaries', ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
