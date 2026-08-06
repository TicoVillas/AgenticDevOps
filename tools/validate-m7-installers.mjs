import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { frameworkRoot, readYaml } from './lib/io.mjs';
import { validateM7InstallersReport } from './lib/installer/m7-report.mjs';
import { runInstallerBootstrap } from './lib/installer/bootstrap.mjs';
import { formatAjvErrors, loadSchemaRegistry } from './lib/schema.mjs';
import { validateValidationBinding } from './lib/validation-bindings.mjs';

const MILESTONE = 'M7';
const runtimeFiles = Object.freeze([
  'installers/install.sh', 'installers/install.ps1', 'tools/installer-bootstrap.mjs',
  'tools/lib/installer/bootstrap.mjs', 'tools/lib/installer/downloader.mjs', 'tools/lib/installer/staging.mjs',
]);
const testFiles = Object.freeze([
  'tests/installers/harness.mjs', 'tests/installers/bootstrap-contract.test.mjs',
  'tests/installers/downloader.test.mjs', 'tests/installers/verify-extract-security.test.mjs',
]);
const forbiddenRuntimeTokens = Object.freeze([
  'node:child_process', 'node:http', 'node:https', 'node:net', 'node:dns', 'fetch(',
  'process.env', 'GITHUB_TOKEN', 'GH_TOKEN', 'github_pat_', 'curl ', 'wget ',
  'Invoke-WebRequest', 'Invoke-Expression', 'iex ', 'npm install', 'apt-get',
]);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function validateM7Installers(root = frameworkRoot) {
  const errors = [];
  let ajv;
  try { ({ ajv } = await loadSchemaRegistry(root)); }
  catch (error) { errors.push(`schema-registry: ${error.message}`); }
  try {
    const schema = await readYaml(resolve(root, 'contracts/schemas/installer-handoff.schema.yaml'));
    if (schema.$id !== 'urn:agentic-devops:installer-handoff:3.0') errors.push('installer-handoff: unexpected schema ID');
    if (schema.additionalProperties !== false) errors.push('installer-handoff: additionalProperties false required');
    const template = await readYaml(resolve(root, 'contracts/templates/installer-handoff.yaml'));
    const validate = ajv?.getSchema(schema.$id);
    if (!validate || !validate(template)) errors.push(`installer-handoff: template invalid: ${formatAjvErrors(validate?.errors).join('; ')}`);
  } catch (error) { errors.push(`installer-handoff: ${error.message}`); }

  const sources = new Map();
  for (const path of [...runtimeFiles, ...testFiles]) {
    try { sources.set(path, await readFile(resolve(root, path), 'utf8')); }
    catch (error) { errors.push(`${path}: ${error.message}`); }
  }
  for (const path of runtimeFiles) {
    const source = sources.get(path) ?? '';
    for (const token of forbiddenRuntimeTokens) if (source.includes(token)) errors.push(`${path}: forbidden boundary token ${token}`);
    if (/function\s+(?:planDistribution|buildDistributionSnapshot|executeLifecycleCommand)\b/.test(source)) errors.push(`${path}: duplicated planner/lifecycle semantic detected`);
  }
  const downloader = sources.get('tools/lib/installer/downloader.mjs') ?? '';
  for (const adapter of ['GH_AUTHENTICATED', 'API_FINE_GRAINED_READ_ONLY', 'OFFLINE_BUNDLE']) if (!downloader.includes(adapter)) errors.push(`downloader missing ${adapter}`);
  if (!downloader.includes("from '../release.mjs'")) errors.push('downloader must reuse release identity helpers');
  const staging = sources.get('tools/lib/installer/staging.mjs') ?? '';
  for (const reuse of ["from '../release.mjs'", "from '../release-trust.mjs'", "from '../release-security.mjs'", "from '../archive.mjs'", "from '../archive-restore.mjs'", "from '../lifecycle/paths.mjs'"]) if (!staging.includes(reuse)) errors.push(`staging missing reuse ${reuse}`);
  const bootstrap = sources.get('tools/lib/installer/bootstrap.mjs') ?? '';
  if (!bootstrap.includes('parseLifecycleArgs')) errors.push('bootstrap must reuse lifecycle CLI parsing');
  for (const binding of ['verifyBeforeExtract', 'verificationCapabilities', 'runInstallerPipeline', 'TRANSPORT_INJECTION_REQUIRED']) if (!bootstrap.includes(binding)) errors.push(`bootstrap missing verified handoff binding ${binding}`);
  const standalone = await runInstallerBootstrap([
    '--adapter', 'BASH', '--operation', 'install', '--release-id', 'release-310', '--release-version', '3.1.0', '--release-tag', 'v3.1.0', '--release-commit', 'a'.repeat(40),
    '--repository', 'TicoVillas/AgenticDevOps', '--release-reference', 'releases/download/v3.1.0/assets', '--source', '/arbitrary/unverified/source', '--destination', '/synthetic/destination',
    '--state', '/synthetic/state', '--cache', '/synthetic/cache', '--temp', '/synthetic/temp', '--operation-id', 'install-synthetic-0001',
  ]);
  if (standalone.ok || standalone.handoff !== null || standalone.reason_code !== 'TRANSPORT_INJECTION_REQUIRED') errors.push('standalone bootstrap must block arbitrary source without injected transport');
  try {
    const schema = await readYaml(resolve(root, 'contracts/schemas/installer-handoff.schema.yaml'));
    if (!schema.required?.includes('verification')) errors.push('installer-handoff: verification must be required');
    for (const field of ['method', 'release_identity_sha256', 'manifest_sha256', 'payload_root', 'file_count', 'staging_root']) if (!schema.properties?.verification?.required?.includes(field)) errors.push(`installer-handoff: verification missing required ${field}`);
  } catch (error) { errors.push(`installer-handoff verification binding: ${error.message}`); }
  for (const wrapper of ['installers/install.sh', 'installers/install.ps1']) {
    const source = sources.get(wrapper) ?? '';
    if (!source.includes('tools/installer-bootstrap.mjs')) errors.push(`${wrapper}: must delegate to Node installer bootstrap`);
    if (source.includes('--apply')) errors.push(`${wrapper}: apply must not execute inside wrapper`);
  }

  try {
    const packageDocument = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
    if (!packageDocument.files?.includes('installers/')) errors.push('package files must include installers/');
    if (packageDocument.scripts?.['validate:m7'] !== 'node tools/validate-m7-installers.mjs') errors.push('validate:m7 script missing');
  } catch (error) { errors.push(`package: ${error.message}`); }
  const binding = await validateValidationBinding(root, { milestone: MILESTONE });
  errors.push(...binding.errors.map((error) => `validation-binding: ${error}`));
  const report = await validateM7InstallersReport(root);
  errors.push(...report.errors);
  return Object.freeze({
    ok: errors.length === 0,
    errors,
    runtime_file_count: runtimeFiles.length,
    test_file_count: testFiles.length,
    package_lock_sha256: binding.observed?.package_lock_sha256 ?? null,
    binding_context: binding.binding_context,
    binding_contract_version: binding.binding_contract_version,
    network_access_authorized: false,
    credential_access_authorized: false,
    direct_global_write: false,
    node_auto_install: false,
    linux_validation: 'SYNTHETICALLY_VALIDATED',
    windows_validation: 'PROJECTED',
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const root = process.argv[2] ? resolve(process.argv[2]) : frameworkRoot;
  const result = await validateM7Installers(root);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
