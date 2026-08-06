import { generateKiroSteering } from './lib/distribution.mjs';

const generated = await generateKiroSteering();
console.log(JSON.stringify({ status: 'GENERATED', path: generated }));
