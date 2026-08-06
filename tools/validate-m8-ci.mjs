import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { frameworkRoot, readYaml } from './lib/io.mjs';
import { validateM8CiReport } from './lib/ci/m8-report.mjs';
import {
  collectWorkflowUses,
  validateNpmPackReport,
  validatePackageConfiguration,
  validatePinnedActions,
} from './lib/ci/policy.mjs';
import { formatAjvErrors, loadSchemaRegistry } from './lib/schema.mjs';
import { validateValidationBinding } from './lib/validation-bindings.mjs';

const MILESTONE = 'M8';
const REQUIRED_RELEASE_JOBS = Object.freeze([
  'clean-build', 'protected-signing', 'draft', 'draft-redownload-reverify',
  'immutability-gate', 'independent-checkpoint', 'publish', 'external-redownload-reverify',
]);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function runText(workflow) {
  return Object.values(workflow?.jobs ?? {}).flatMap((job) => job?.steps ?? []).map((step) => step?.run ?? '').join('\n');
}

function hasOnlyReadPermission(permission) {
  return permission === undefined || permission === 'none' || permission === 'read';
}

async function loadWorkflow(root, name, errors) {
  try {
    const source = await readFile(resolve(root, '.github/workflows', name), 'utf8');
    return { source, document: YAML.parse(source) };
  } catch (error) {
    errors.push(`workflow:${name}:${error.message}`);
    return { source: '', document: {} };
  }
}

export async function validateM8Ci(root = frameworkRoot) {
  const errors = [];
  let ajv;
  try { ({ ajv } = await loadSchemaRegistry(root)); }
  catch (error) { errors.push(`schema-registry:${error.message}`); }

  try {
    const schema = await readYaml(resolve(root, 'contracts/schemas/ci-evidence-index.schema.yaml'));
    if (schema.$id !== 'urn:agentic-devops:ci-evidence-index:3.0') errors.push('ci-evidence-index:unexpected schema ID');
    if (schema.additionalProperties !== false) errors.push('ci-evidence-index:additionalProperties false required');
    const template = await readYaml(resolve(root, 'contracts/templates/ci-evidence-index.yaml'));
    const validate = ajv?.getSchema(schema.$id);
    if (!validate || !validate(template)) errors.push(`ci-evidence-index:template invalid:${formatAjvErrors(validate?.errors).join('; ')}`);
    if (template.authorization_granted !== false || template.sanitized !== true) errors.push('ci-evidence-index:template must be sanitized and non-authorizing');
  } catch (error) { errors.push(`ci-evidence-index:${error.message}`); }

  const pr = await loadWorkflow(root, 'pr.yml', errors);
  const release = await loadWorkflow(root, 'release.yml', errors);
  for (const [name, workflow] of [['pr.yml', pr.document], ['release.yml', release.document]]) {
    const pinned = validatePinnedActions(workflow);
    errors.push(...pinned.errors.map((error) => `${name}:${error}`));
    if (collectWorkflowUses(workflow).length === 0) errors.push(`${name}:pinned actions required`);
  }

  const prOn = pr.document?.on ?? {};
  if (!Object.hasOwn(prOn, 'pull_request')) errors.push('pr.yml:pull_request trigger required');
  if (Object.hasOwn(prOn, 'pull_request_target')) errors.push('pr.yml:pull_request_target forbidden');
  if (pr.document?.permissions?.contents !== 'read') errors.push('pr.yml:top-level contents read required');
  for (const [id, job] of Object.entries(pr.document?.jobs ?? {})) {
    if (job.environment !== undefined) errors.push(`pr.yml:${id}:environment forbidden`);
    for (const [scope, permission] of Object.entries(job.permissions ?? {})) if (!hasOnlyReadPermission(permission)) errors.push(`pr.yml:${id}:${scope} write permission forbidden`);
  }
  if (pr.source.includes('secrets.')) errors.push('pr.yml:untrusted PR secret access forbidden');
  const prCommands = runText(pr.document);
  for (const token of ['npm ci --ignore-scripts', 'npm run validate', 'npm test', 'git diff --exit-code', 'npm pack --dry-run', 'validate:distribution', 'scan-release-sensitive.mjs', 'cmp ']) {
    if (!prCommands.includes(token)) errors.push(`pr.yml:missing required command:${token}`);
  }

  const releaseJobs = release.document?.jobs ?? {};
  for (const id of REQUIRED_RELEASE_JOBS) if (!releaseJobs[id]) errors.push(`release.yml:missing job:${id}`);
  if (!release.document?.on?.workflow_dispatch?.inputs?.compensating_control_json) errors.push('release.yml:explicit compensating-control input required');
  if (!release.document?.on?.workflow_dispatch?.inputs?.compensating_control_authorization_sha256) errors.push('release.yml:compensating-control authorization binding required');
  if (releaseJobs['protected-signing']?.environment !== 'release-signing') errors.push('release.yml:protected signing environment required');
  if (releaseJobs.draft?.environment !== 'release-draft') errors.push('release.yml:separate draft environment required');
  if (releaseJobs.publish?.environment !== 'release-publish') errors.push('release.yml:separate publish environment required');
  if (releaseJobs['independent-checkpoint']?.environment !== 'release-publish-checkpoint') errors.push('release.yml:independent checkpoint environment required');
  if (releaseJobs.publish?.needs !== 'independent-checkpoint') errors.push('release.yml:publish must depend directly on independent checkpoint');
  if (releaseJobs['independent-checkpoint']?.needs !== 'immutability-gate') errors.push('release.yml:checkpoint must depend on immutability gate');
  if (releaseJobs['external-redownload-reverify']?.needs !== 'publish') errors.push('release.yml:external reverify must follow publish');
  if (releaseJobs['draft-redownload-reverify']?.needs !== 'draft') errors.push('release.yml:draft reverify must be distinct and follow draft');
  if (releaseJobs['immutability-gate']?.outputs?.decision_sha256 !== '${{ steps.evaluate.outputs.decision_sha256 }}') errors.push('release.yml:READY decision hash output required');
  if (releaseJobs.draft?.permissions?.contents !== 'write' || releaseJobs.publish?.permissions?.contents !== 'write') errors.push('release.yml:write permission limited to explicit draft/publish jobs');
  for (const [id, job] of Object.entries(releaseJobs)) {
    if (!['draft', 'publish'].includes(id) && job.permissions?.contents === 'write') errors.push(`release.yml:${id}:unexpected contents write`);
  }
  const releaseCommands = runText(release.document);
  for (const token of ['npm ci --ignore-scripts', 'git diff --exit-code', 'npm pack --dry-run', 'scan-release-sensitive.mjs', '--draft', 'release download', '--draft=false', 'evaluate-m8-release-gate.mjs', 'IMMUTABILITY_DECISION_SHA256', 'M12 protected signer integration is not authorized or configured by M8']) {
    if (!releaseCommands.includes(token)) errors.push(`release.yml:missing required gate:${token}`);
  }
  if (/raw\.githubusercontent\.com|refs\/heads\//i.test(release.source)) errors.push('release.yml:mutable release source forbidden');

  try {
    const packageDocument = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
    const packagePolicy = validatePackageConfiguration(packageDocument);
    errors.push(...packagePolicy.errors.map((error) => `package:${error}`));
    if (packageDocument.scripts?.['validate:m8'] !== 'node tools/validate-m8-ci.mjs') errors.push('package:validate:m8 script missing');
    if (packageDocument.scripts?.['generate:m8-report'] !== 'node tools/generate-m8-ci-report.mjs') errors.push('package:generate:m8-report script missing');
  } catch (error) { errors.push(`package:${error.message}`); }

  const binding = await validateValidationBinding(root, { milestone: MILESTONE });
  errors.push(...binding.errors.map((error) => `validation-binding:${error}`));

  try {
    const [policySource, gateSource] = await Promise.all([
      readFile(resolve(root, 'tools/lib/ci/policy.mjs'), 'utf8'),
      readFile(resolve(root, 'tools/evaluate-m8-release-gate.mjs'), 'utf8'),
    ]);
    for (const reuse of ["from '../release.mjs'", "from '../release-security.mjs'", "from '../canonical-json.mjs'"]) if (!policySource.includes(reuse)) errors.push(`policy:missing reuse:${reuse}`);
    if (!gateSource.includes("from './lib/release-security.mjs'") || !gateSource.includes('evaluateImmutabilityGate')) errors.push('release-gate:must reuse M4 immutability evaluator');
    if (/function\s+(?:evaluateImmutabilityGate|verifyDetachedSignature|planDistribution)\b/.test(`${policySource}\n${gateSource}`)) errors.push('policy:duplicated release/planner semantic');
  } catch (error) { errors.push(`policy:${error.message}`); }

  const report = await validateM8CiReport(root);
  errors.push(...report.errors);
  return Object.freeze({
    ok: errors.length === 0,
    errors,
    workflow_count: 2,
    release_job_count: Object.keys(releaseJobs).length,
    package_lock_sha256: binding.observed?.package_lock_sha256 ?? null,
    binding_context: binding.binding_context,
    binding_contract_version: binding.binding_contract_version,
    workflow_activation: false,
    network_access_authorized: false,
    credential_access_authorized: false,
    signing_authorized: false,
    publish_authorized: false,
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const reportIndex = process.argv.indexOf('--package-report');
  let result;
  if (reportIndex >= 0) {
    const path = process.argv[reportIndex + 1];
    if (!path) throw new Error('PACKAGE_REPORT_PATH_REQUIRED');
    result = validateNpmPackReport(JSON.parse(await readFile(resolve(path), 'utf8')));
  } else {
    const positionalRoot = process.argv[2] && !process.argv[2].startsWith('--') ? resolve(process.argv[2]) : frameworkRoot;
    result = await validateM8Ci(positionalRoot);
  }
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
