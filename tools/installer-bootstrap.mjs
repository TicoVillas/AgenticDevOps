#!/usr/bin/env node
import { runInstallerBootstrap } from './lib/installer/bootstrap.mjs';

const result = await runInstallerBootstrap(process.argv.slice(2));
process.stdout.write(`${JSON.stringify(result)}\n`);
process.exitCode = result.exit_code;
