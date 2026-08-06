import { validateWorkflow } from './lib/workflow.mjs';

const result = await validateWorkflow();
console.log(JSON.stringify({ validator: 'validate-workflow', ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
