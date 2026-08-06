import { generateM8CiReport } from './lib/ci/m8-report.mjs';

const report = await generateM8CiReport();
console.log(JSON.stringify({ status: 'GENERATED', report }));
