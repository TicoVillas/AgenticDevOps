import { generateSkills } from './lib/skills.mjs';

const generated = await generateSkills();
console.log(JSON.stringify({ status: 'GENERATED', count: generated.length, generated }, null, 2));
