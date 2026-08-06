import { validateReports } from './lib/reports.mjs';

const result = await validateReports();
console.log(JSON.stringify({ validator: 'validate-reports', ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
