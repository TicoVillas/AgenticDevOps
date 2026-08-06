import { generateM6ProjectUpdateReport } from './lib/project-update/m6-report.mjs';

const report = await generateM6ProjectUpdateReport();
console.log(JSON.stringify({ status: 'GENERATED', report }));
