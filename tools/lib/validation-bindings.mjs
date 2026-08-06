import { readFile, realpath } from 'node:fs/promises';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { frameworkRoot } from './io.mjs';
import { DISTRIBUTION_MANIFEST } from './distribution.mjs';
import { validateBySchemaId } from './schema.mjs';
import { sha256, verifyFrameworkLock } from './source-lock.mjs';

export const VALIDATION_BINDING_CONTRACT = 'contracts/validation-bindings.yaml';
export const VALIDATION_BINDING_SCHEMA_ID = 'urn:agentic-devops:validation-binding-contract:3.1';
const M9_MIGRATION_MANIFEST = '.kiro/specs/framework-governance-and-portability/m9-migration-manifest.json';
export const VALIDATION_BINDING_CONTEXTS = Object.freeze([
  'HISTORICAL_MILESTONE_BINDING',
  'CANONICAL_CHECKOUT_BINDING',
]);

const expectedDependencies = Object.freeze({ ajv: '8.20.0', 'ajv-formats': '3.0.1', yaml: '2.9.0' });

function repositoryName(repository) {
  if (typeof repository === 'string') return repository;
  const url = repository?.url;
  if (typeof url !== 'string') return null;
  const match = url.match(/^(?:git\+)?https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/);
  return match?.[1] ?? null;
}

function artifactPath(logicalPath) {
  if (logicalPath === 'DISTRIBUTION_MANIFEST') return DISTRIBUTION_MANIFEST;
  if (logicalPath === 'M9_MIGRATION_MANIFEST') return M9_MIGRATION_MANIFEST;
  return logicalPath;
}

export async function loadValidationBindingContract(root = frameworkRoot) {
  const errors = [];
  let contract = null;
  try {
    contract = YAML.parse(await readFile(resolve(root, VALIDATION_BINDING_CONTRACT), 'utf8'));
    const validation = await validateBySchemaId(contract, VALIDATION_BINDING_SCHEMA_ID, root);
    errors.push(...validation.errors.map((error) => `binding-contract: ${error}`));
  } catch (error) {
    errors.push(`binding-contract: ${error.message}`);
  }
  return { ok: errors.length === 0, errors, contract };
}

export function resolveBindingContext(contract, requestedContext) {
  const errors = [];
  const active = contract?.active_context;
  if (!VALIDATION_BINDING_CONTEXTS.includes(active)) errors.push('BINDING_CONTEXT_REQUIRED');
  if (requestedContext !== undefined) {
    if (!VALIDATION_BINDING_CONTEXTS.includes(requestedContext)) errors.push('BINDING_CONTEXT_UNKNOWN');
    else if (active !== requestedContext) errors.push('BINDING_CONTEXT_AMBIGUOUS');
  }
  const context = requestedContext ?? active;
  if (!VALIDATION_BINDING_CONTEXTS.includes(context)) return { ok: false, errors, context: null };
  return { ok: errors.length === 0, errors, context };
}

export async function observeValidationBinding(root = frameworkRoot) {
  const absoluteRoot = resolve(root);
  const packagePath = resolve(absoluteRoot, 'package.json');
  const packageLockPath = resolve(absoluteRoot, 'package-lock.json');
  const manifestPath = resolve(absoluteRoot, DISTRIBUTION_MANIFEST);
  const frameworkLockPath = resolve(absoluteRoot, 'framework.lock');
  const [packageBytes, packageLockBytes, manifestBytes, frameworkLockBytes, observedRealpath] = await Promise.all([
    readFile(packagePath),
    readFile(packageLockPath),
    readFile(manifestPath),
    readFile(frameworkLockPath),
    realpath(absoluteRoot),
  ]);
  const packageDocument = JSON.parse(packageBytes.toString('utf8'));
  const packageLockDocument = JSON.parse(packageLockBytes.toString('utf8'));
  const frameworkLockDocument = JSON.parse(frameworkLockBytes.toString('utf8'));
  const frameworkLockVerification = await verifyFrameworkLock(absoluteRoot);
  return {
    root: {
      logical_source_root: '.',
      realpath_stable: observedRealpath === absoluteRoot,
      package_at_root: true,
    },
    package: {
      name: packageDocument.name,
      version: packageDocument.version,
      repository: repositoryName(packageDocument.repository),
      lock_name: packageLockDocument.name,
      lock_version: packageLockDocument.version,
      lock_root_name: packageLockDocument.packages?.['']?.name,
      lock_root_version: packageLockDocument.packages?.['']?.version,
      lock_root_dependencies: packageLockDocument.packages?.['']?.dependencies,
    },
    artifacts: {
      package_json: { sha256: sha256(packageBytes) },
      package_lock: { sha256: sha256(packageLockBytes) },
      distribution_manifest: { sha256: sha256(manifestBytes) },
      framework_lock: { sha256: sha256(frameworkLockBytes) },
    },
    framework_lock: {
      ok: frameworkLockVerification.ok,
      errors: frameworkLockVerification.errors,
      entries: frameworkLockDocument.files ?? {},
      format: frameworkLockDocument.format,
      algorithm: frameworkLockDocument.algorithm,
    },
  };
}

function compareFixedArtifact(errors, name, descriptor, observation) {
  if (descriptor.hash_mode !== 'FIXED_SHA256') errors.push(`${name}: HASH_MODE_INVALID`);
  if (observation?.sha256 !== descriptor.sha256) errors.push(`${name}: SHA256_MISMATCH`);
}

export function validateBindingObservation(contract, contextName, observation, milestone, historicalEvidenceErrors = []) {
  const errors = [...historicalEvidenceErrors];
  const descriptor = contract?.contexts?.[contextName];
  if (!descriptor) return { ok: false, errors: [...errors, 'BINDING_CONTEXT_NOT_DECLARED'] };
  if (!descriptor.milestones?.includes(milestone)) errors.push(`${milestone}: MILESTONE_NOT_BOUND`);
  if (descriptor.context !== contextName || descriptor.context_version !== 1) errors.push('BINDING_CONTEXT_VERSION_MISMATCH');
  if (observation.root?.realpath_stable !== true || observation.root?.package_at_root !== true) errors.push('SOURCE_ROOT_MISMATCH');
  if (observation.root?.logical_source_root !== descriptor.root_binding.logical_source_root) errors.push('LOGICAL_SOURCE_ROOT_MISMATCH');
  if (observation.package?.name !== descriptor.root_binding.package_name) errors.push('PACKAGE_NAME_MISMATCH');
  if (observation.package?.version !== descriptor.root_binding.package_version) errors.push('PACKAGE_VERSION_MISMATCH');
  if (observation.package?.lock_name !== descriptor.root_binding.package_name || observation.package?.lock_root_name !== descriptor.root_binding.package_name) errors.push('PACKAGE_LOCK_NAME_MISMATCH');
  if (observation.package?.lock_version !== descriptor.root_binding.package_version || observation.package?.lock_root_version !== descriptor.root_binding.package_version) errors.push('PACKAGE_LOCK_VERSION_MISMATCH');
  if (JSON.stringify(observation.package?.lock_root_dependencies) !== JSON.stringify(expectedDependencies)) errors.push('PACKAGE_LOCK_DEPENDENCIES_MISMATCH');

  if (contextName === 'CANONICAL_CHECKOUT_BINDING') {
    if (observation.package?.repository !== descriptor.root_binding.repository) errors.push('REPOSITORY_MISMATCH');
    compareFixedArtifact(errors, 'package.json', descriptor.artifacts.package_json, observation.artifacts?.package_json);
    compareFixedArtifact(errors, 'package-lock.json', descriptor.artifacts.package_lock, observation.artifacts?.package_lock);
    if (descriptor.artifacts.distribution_manifest.hash_mode !== 'FRAMEWORK_LOCK_ENTRY') errors.push('distribution-manifest: HASH_MODE_INVALID');
    const manifestPath = artifactPath(descriptor.artifacts.distribution_manifest.path);
    if (observation.framework_lock?.entries?.[manifestPath] !== observation.artifacts?.distribution_manifest?.sha256) errors.push('distribution-manifest: FRAMEWORK_LOCK_BINDING_MISMATCH');
    for (const artifact of ['package_json', 'package_lock']) {
      const path = descriptor.artifacts[artifact].path;
      if (observation.framework_lock?.entries?.[path] !== observation.artifacts?.[artifact]?.sha256) errors.push(`${path}: FRAMEWORK_LOCK_BINDING_MISMATCH`);
    }
    if (descriptor.artifacts.framework_lock.hash_mode !== 'RECOMPUTED_CONTENT_SET' || descriptor.artifacts.framework_lock.algorithm !== 'sha256') errors.push('framework.lock: HASH_MODE_INVALID');
    if (observation.framework_lock?.format !== 1 || observation.framework_lock?.algorithm !== 'sha256') errors.push('framework.lock: FORMAT_MISMATCH');
    if (observation.framework_lock?.ok !== true) errors.push(...(observation.framework_lock?.errors ?? ['framework.lock: RECOMPUTATION_FAILED']).map((error) => `framework.lock: ${error}`));
  } else if (contextName === 'HISTORICAL_MILESTONE_BINDING') {
    for (const artifact of ['package_json', 'package_lock', 'distribution_manifest', 'framework_lock']) compareFixedArtifact(errors, descriptor.artifacts[artifact].path, descriptor.artifacts[artifact], observation.artifacts?.[artifact]);
  } else {
    errors.push('BINDING_CONTEXT_UNKNOWN');
  }
  return { ok: errors.length === 0, errors };
}

async function validateHistoricalEvidence(root, contract) {
  const errors = [];
  const descriptor = contract.contexts.HISTORICAL_MILESTONE_BINDING;
  try {
    const evidence = JSON.parse(await readFile(resolve(root, artifactPath(descriptor.historical_evidence.path)), 'utf8'));
    if (evidence.schema_version !== descriptor.historical_evidence.schema_version || evidence.record_type !== descriptor.historical_evidence.record_type) errors.push('historical-evidence: IDENTITY_MISMATCH');
    if (evidence.source?.inventory_sha256 !== descriptor.historical_evidence.source_inventory_sha256) errors.push('historical-evidence: SOURCE_INVENTORY_MISMATCH');
    if (evidence.source?.framework !== `${evidence.source?.workspace}/framework` || evidence.source?.framework_realpath !== evidence.source?.framework) errors.push('historical-evidence: SOURCE_ROOT_MISMATCH');
    const bindings = evidence.entry_bindings ?? {};
    const expected = descriptor.artifacts;
    if (bindings.package_json_sha256 !== expected.package_json.sha256) errors.push('historical-evidence: PACKAGE_JSON_MISMATCH');
    if (bindings.package_lock_sha256 !== expected.package_lock.sha256) errors.push('historical-evidence: PACKAGE_LOCK_MISMATCH');
    if (bindings.distribution_manifest_sha256 !== expected.distribution_manifest.sha256) errors.push('historical-evidence: DISTRIBUTION_MANIFEST_MISMATCH');
    if (bindings.framework_lock_sha256 !== expected.framework_lock.sha256) errors.push('historical-evidence: FRAMEWORK_LOCK_MISMATCH');
  } catch (error) {
    errors.push(`historical-evidence: ${error.message}`);
  }
  return errors;
}

export async function validateValidationBinding(root = frameworkRoot, { milestone, requestedContext } = {}) {
  const loaded = await loadValidationBindingContract(root);
  if (!loaded.ok) return { ok: false, errors: loaded.errors, binding_context: null, binding_contract_version: null, observed: null };
  const selection = resolveBindingContext(loaded.contract, requestedContext);
  if (!selection.ok) return { ok: false, errors: selection.errors, binding_context: selection.context, binding_contract_version: loaded.contract.schema_version, observed: null };
  let observation;
  try {
    observation = await observeValidationBinding(root);
  } catch (error) {
    return { ok: false, errors: [`binding-observation: ${error.message}`], binding_context: selection.context, binding_contract_version: loaded.contract.schema_version, observed: null };
  }
  const historicalEvidenceErrors = await validateHistoricalEvidence(root, loaded.contract);
  const result = validateBindingObservation(loaded.contract, selection.context, observation, milestone, historicalEvidenceErrors);
  return {
    ...result,
    binding_context: selection.context,
    binding_contract_version: loaded.contract.schema_version,
    observed: {
      package_json_sha256: observation.artifacts.package_json.sha256,
      package_lock_sha256: observation.artifacts.package_lock.sha256,
      distribution_manifest_sha256: observation.artifacts.distribution_manifest.sha256,
      framework_lock_sha256: observation.artifacts.framework_lock.sha256,
    },
  };
}
