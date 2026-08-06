import { generateM5Reports } from './lib/lifecycle/m5-reports.mjs';

const reports = await generateM5Reports();
console.log(JSON.stringify({ status: 'GENERATED', reports }));
