import { writeFrameworkLock } from './lib/source-lock.mjs';

const lock = await writeFrameworkLock();
console.log(JSON.stringify({ status: 'GENERATED', files: Object.keys(lock.files).length }));
