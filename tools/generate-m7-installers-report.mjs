import { generateM7InstallersReport } from './lib/installer/m7-report.mjs';

const report = await generateM7InstallersReport();
console.log(JSON.stringify({ status: 'GENERATED', report }));
