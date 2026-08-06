import { generateReports } from './lib/reports.mjs';

const reports = await generateReports();
console.log(JSON.stringify({ status: 'GENERATED', reports }));
