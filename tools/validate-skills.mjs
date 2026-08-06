import { validateSkills } from './lib/skills.mjs';

const result = await validateSkills();
console.log(JSON.stringify({ validator: 'validate-skills', ...result }, null, 2));
if (!result.ok) process.exitCode = 1;
