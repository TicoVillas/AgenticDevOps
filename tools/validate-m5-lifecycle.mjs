import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { frameworkRoot, readYaml, walk } from './lib/io.mjs';
import { validateRetention } from './lib/retention.mjs';
import { formatAjvErrors, loadSchemaRegistry } from './lib/schema.mjs';
import { validateM5Reports } from './lib/lifecycle/m5-reports.mjs';
import { validateValidationBinding } from './lib/validation-bindings.mjs';

const MILESTONE = 'M5';
const contracts = Object.freeze(['authorization-envelope', 'lifecycle-event-log', 'lifecycle-cli-result']);
const requiredRuntime = Object.freeze([
  'adapters/lifecycle/node-filesystem.mjs',
  'tools/lifecycle-cli.mjs',
  'tools/lib/lifecycle/atomic-writer.mjs',
  'tools/lib/lifecycle/authorization.mjs',
  'tools/lib/lifecycle/cli.mjs',
  'tools/lib/lifecycle/engine.mjs',
  'tools/lib/lifecycle/event-evidence.mjs',
  'tools/lib/lifecycle/paths.mjs',
  'tools/lib/lifecycle/reconcile.mjs',
  'tools/lib/lifecycle/retention-planner.mjs',
  'tools/lib/lifecycle/state-store.mjs',
  'tools/lib/lifecycle/uninstall.mjs',
]);
const requiredTests = Object.freeze([
  'tests/lifecycle/cli-paths.test.mjs',
  'tests/lifecycle/durability-reconcile.test.mjs',
  'tests/lifecycle/engine-integration.test.mjs',
  'tests/lifecycle/uninstall-retention-evidence.test.mjs',
]);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slash = (value) => value.split(sep).join('/');

export async function validateM5Lifecycle(root = frameworkRoot) {
  const errors = [];
  let ajv;
  try {
    ({ ajv } = await loadSchemaRegistry(root));
  } catch (error) {
    errors.push(`schema-registry: ${error.message}`);
  }
  for (const name of contracts) {
    try {
      const schema = await readYaml(resolve(root, 'contracts/schemas', `${name}.schema.yaml`));
      if (schema.$id !== `urn:agentic-devops:${name}:3.0`) errors.push(`${name}: unexpected schema ID`);
      if (schema.additionalProperties !== false) errors.push(`${name}: additionalProperties false required`);
      const template = await readYaml(resolve(root, 'contracts/templates', `${name}.yaml`));
      const validate = ajv?.getSchema(schema.$id);
      if (!validate || !validate(template)) errors.push(`${name}: template invalid: ${formatAjvErrors(validate?.errors).join('; ')}`);
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }

  const sources = new Map();
  for (const path of [...requiredRuntime, ...requiredTests]) {
    try { sources.set(path, await readFile(resolve(root, path), 'utf8')); }
    catch (error) { errors.push(`${path}: ${error.message}`); }
  }
  const engine = sources.get('tools/lib/lifecycle/engine.mjs') ?? '';
  const installation = await readFile(resolve(root, 'tools/lib/installation.mjs'), 'utf8');
  if (!engine.includes("from '../distribution.mjs'") || !engine.includes("from '../installation.mjs'")) errors.push('lifecycle engine must delegate to existing distribution and installation modules');
  for (const [path, text] of sources) {
    if (path.startsWith('tests/')) continue;
    for (const token of ['homedir(', 'process.env.HOME', 'node:child_process', 'fetch(']) if (text.includes(token)) errors.push(`${path}: forbidden runtime boundary token ${token}`);
    if (/function\s+planDistribution\b/.test(text) || /function\s+buildDistributionSnapshot\b/.test(text)) errors.push(`${path}: second lifecycle planner detected`);
  }
  if (!installation.includes("from './lifecycle/atomic-writer.mjs'") || !installation.includes('journalStore.recordIntent')) errors.push('installation engine is not wired to durable lifecycle capabilities');

  const binding = await validateValidationBinding(root, { milestone: MILESTONE });
  errors.push(...binding.errors.map((error) => `validation-binding: ${error}`));
  try {
    const lockBytes = await readFile(resolve(root, 'package-lock.json'));
    const packageLock = JSON.parse(lockBytes.toString('utf8'));
    const expected = { ajv: '8.20.0', 'ajv-formats': '3.0.1', yaml: '2.9.0' };
    if (JSON.stringify(packageLock.packages?.['']?.dependencies) !== JSON.stringify(expected)) errors.push('package-lock root dependencies changed');
  } catch (error) {
    errors.push(`package-lock: ${error.message}`);
  }

  const retention = await validateRetention(root);
  errors.push(...retention.errors.map((error) => `retention: ${error}`));
  const reports = await validateM5Reports(root);
  errors.push(...reports.errors);

  const lifecycleFiles = (await walk(resolve(root, 'tools/lib/lifecycle'))).map((path) => slash(relative(root, path)));
  return Object.freeze({
    ok: errors.length === 0,
    errors,
    contract_count: contracts.length,
    runtime_file_count: requiredRuntime.length,
    test_file_count: requiredTests.length,
    lifecycle_file_count: lifecycleFiles.length,
    retention_consumers_scanned: retention.scannedConsumers,
    report_count: reports.report_count,
    package_lock_sha256: binding.observed?.package_lock_sha256 ?? null,
    binding_context: binding.binding_context,
    binding_contract_version: binding.binding_contract_version,
    real_global_access_authorized: false,
    stage_b_executed: false,
    m6_executed: false,
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const root = process.argv[2] ? resolve(process.argv[2]) : frameworkRoot;
  const result = await validateM5Lifecycle(root);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
