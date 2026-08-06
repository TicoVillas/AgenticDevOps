#!/usr/bin/env node
import { runLifecycleCli } from './lib/lifecycle/cli.mjs';
import { executeLifecycleCommand } from './lib/lifecycle/engine.mjs';

const response = await runLifecycleCli(process.argv.slice(2), { execute: executeLifecycleCommand });
process.stdout.write(response.output);
process.exitCode = response.exitCode;
