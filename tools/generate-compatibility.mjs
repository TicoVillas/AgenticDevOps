import { generateCompatibility } from './lib/compatibility.mjs';

const generated = await generateCompatibility();
console.log(JSON.stringify({ status: 'GENERATED', path: generated }));
