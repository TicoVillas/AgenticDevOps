import { execFileSync } from 'node:child_process';
import { checkRuntime } from './lib/runtime.mjs';

let npmVersion = null;
try {
  npmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8', timeout: 10_000 }).trim();
} catch {
  // checkRuntime returns the fail-closed state.
}
const result = checkRuntime({ npmVersion });
console.log(JSON.stringify(result, null, 2));
if (!result.ok) process.exitCode = 2;
