import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, posix, relative, resolve, sep } from 'node:path';
import { frameworkRoot } from './io.mjs';
import { classifyDryRun } from './dry-run.mjs';
import { validateBySchemaId } from './schema.mjs';

export const DISTRIBUTION_MANIFEST = 'adapters/kiro/distribution-manifest.yaml';
export const KIRO_STEERING_TEMPLATE = 'adapters/kiro/templates/agentic-workflow.md';
export const KIRO_STEERING_OUTPUT = 'adapters/kiro/generated/agentic-workflow.md';

export const LEGACY_RETIREMENTS = Object.freeze([
  ['steering/workflow-core.md', '436e15f4d6dcdea25d9f60280567970e45ab0dd304ebf8bd21ebe3ea33e25af1'],
  ['steering/contracts/ArtifactContract.md', '9f8d3c9536a9c4eba09f24dcc1fc036c8cb336e31f4a73c7c784760a489678cc'],
  ['steering/contracts/ContextPolicy.md', 'ba883239f416776f0179e212b23f315f2f00addc434078c9a8eb38f6729c097f'],
  ['steering/contracts/EvidenceAndFeedbackContract.md', '72f8338c58d97d98995cc5a5c7924607dc03a472e6b15a5217497dcbcdfae377'],
  ['steering/contracts/ExecutionEnvironmentPolicy.md', 'c05e20cad7ff3f28e88b5cbb95c8dcca4cb2ea6c355699642e4fd02425154739'],
  ['steering/contracts/GitSafetyPolicy.md', 'dabfafbe300695ab6036b87f1f3099f300ab33222e9f18175dc8624c9089829d'],
  ['steering/contracts/HighRiskOverlay.md', 'e5063c9d533e7ee3d8e994a36b076d5b5130fa58fda93ec7138324bd6a639ba4'],
  ['steering/contracts/ModelSelectionPolicy.md', 'b027955c14dd8c7a471558fe5c3fef79202ec5999d2f930b750630c55e4fadec'],
  ['steering/contracts/SecureDevelopmentPolicy.md', '7a6ca819b078faffeee1e43ebf35a3e833b0526fea7fc499136bca7059f692b4'],
]);

const STEERING_INPUTS = Object.freeze({
  CORE_ROUTER_REFERENCE: '../core/WorkflowRouter.md',
  SKILLS_ROOT_REFERENCE: '../skills/',
});
const INSTALLABLE_CLASSES = new Set(['GLOBAL_KIRO_MANAGED', 'GENERATED_PACKAGE_CONTENT']);
const EXPECTED_GROUPS = Object.freeze({ core: 5, policies: 10, contracts: 25, skills: 20, adapter: 3, entrypoint: 1 });

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slash = (path) => path.split(sep).join('/');

function duplicateValues(values) {
  const seen = new Map();
  for (const value of values) seen.set(value, (seen.get(value) ?? 0) + 1);
  return [...seen].filter(([, count]) => count > 1).map(([value]) => value);
}

function validateRelativePath(path, label, errors) {
  if (typeof path !== 'string' || path.length === 0 || isAbsolute(path) || path.includes('\\') || path.includes('\0') || posix.normalize(path) !== path || path === '..' || path.startsWith('../')) {
    errors.push(`${label} must be a normalized contained relative path: ${path}`);
  }
}

function topologicalOrder(items, errors) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const indegree = new Map(items.map((item) => [item.id, item.depends_on.length]));
  const dependents = new Map(items.map((item) => [item.id, []]));
  for (const item of items) {
    for (const dependency of item.depends_on) {
      if (!byId.has(dependency)) errors.push(`Unknown dependency ${dependency} from ${item.id}`);
      else dependents.get(dependency).push(item.id);
    }
  }
  if (errors.length > 0) return [];
  const ready = items.filter((item) => indegree.get(item.id) === 0).map((item) => item.id).sort();
  const ordered = [];
  while (ready.length > 0) {
    const id = ready.shift();
    ordered.push(id);
    for (const dependent of dependents.get(id).sort()) {
      indegree.set(dependent, indegree.get(dependent) - 1);
      if (indegree.get(dependent) === 0) ready.push(dependent);
    }
    ready.sort();
  }
  if (ordered.length !== items.length) errors.push('Managed dependency graph contains a cycle');
  return ordered;
}

async function verifySourceFile(root, source, expectedHash, errors) {
  const absolute = resolve(root, source.path);
  try {
    const metadata = await lstat(absolute);
    if (metadata.isSymbolicLink()) { errors.push(`Source is a symlink: ${source.path}`); return; }
    if (!metadata.isFile()) { errors.push(`Source is not a regular file: ${source.path}`); return; }
    const canonicalRoot = await realpath(root);
    const canonical = await realpath(absolute);
    const rel = relative(canonicalRoot, canonical);
    if (rel === '..' || rel.startsWith(`..${sep}`)) { errors.push(`Source escapes root: ${source.path}`); return; }
    if (digest(await readFile(absolute)) !== expectedHash) errors.push(`Source hash mismatch: ${source.path}`);
  } catch (error) {
    errors.push(`Source unavailable ${source.path}: ${error.code ?? error.message}`);
  }
}

function packageIncludes(path, packageManifest) {
  if (path === 'package.json') return true;
  const first = `${path.split('/')[0]}/`;
  return (packageManifest.files ?? []).some((entry) => entry === first || entry === path);
}

export function renderKiroSteering(templateText, inputs = STEERING_INPUTS) {
  let rendered = String(templateText).replace(/\r\n?/g, '\n');
  for (const key of Object.keys(STEERING_INPUTS).sort()) {
    const value = inputs[key];
    if (typeof value !== 'string' || value.length === 0) throw new Error(`Missing steering input ${key}`);
    rendered = rendered.replaceAll(`{{${key}}}`, value);
  }
  const unresolved = [...rendered.matchAll(/\{\{([A-Z0-9_]+)\}\}/g)].map((match) => match[1]);
  if (unresolved.length > 0) throw new Error(`Unresolved steering inputs: ${unresolved.join(', ')}`);
  return `${rendered.trimEnd()}\n`;
}

export async function generateKiroSteering(root = frameworkRoot) {
  const templatePath = resolve(root, KIRO_STEERING_TEMPLATE);
  const outputPath = resolve(root, KIRO_STEERING_OUTPUT);
  const rendered = renderKiroSteering(await readFile(templatePath, 'utf8'));
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, rendered, 'utf8');
  return slash(relative(root, outputPath));
}

export async function loadDistributionInputs(root = frameworkRoot) {
  const YAML = (await import('yaml')).default;
  const [manifestText, lockText, packageText] = await Promise.all([
    readFile(resolve(root, DISTRIBUTION_MANIFEST), 'utf8'),
    readFile(resolve(root, 'framework.lock'), 'utf8'),
    readFile(resolve(root, 'package.json'), 'utf8'),
  ]);
  return { manifest: YAML.parse(manifestText), lock: JSON.parse(lockText), packageManifest: JSON.parse(packageText) };
}

export async function validateDistributionManifest({
  root = frameworkRoot,
  manifest,
  lock,
  packageManifest,
  schemaRoot = frameworkRoot,
  checkFilesystem = true,
  checkGenerated = true,
} = {}) {
  const errors = [];
  const warnings = [];
  if (!manifest || !lock || !packageManifest) {
    try {
      const loaded = await loadDistributionInputs(root);
      manifest ??= loaded.manifest;
      lock ??= loaded.lock;
      packageManifest ??= loaded.packageManifest;
    } catch (error) {
      return { ok: false, errors: [`Distribution inputs unavailable: ${error.message}`], warnings };
    }
  }

  const structural = await validateBySchemaId(manifest, 'urn:agentic-devops:distribution-manifest:3.0', schemaRoot);
  errors.push(...structural.errors.map((error) => `schema ${error}`));
  if (!structural.ok) return { ok: false, errors, warnings };

  const sources = manifest.source_catalog;
  const items = manifest.managed_items;
  if (manifest.adapter !== 'kiro' || manifest.manifest_id !== 'kiro-global-v3' || manifest.destination_root !== 'KIRO_GLOBAL_ROOT') {
    errors.push('Kiro distribution identity mismatch');
  }
  const allowedAdapterScopes = new Set(['kiro', 'universal', 'none']);
  for (const source of sources) if (!allowedAdapterScopes.has(source.adapter_scope)) errors.push(`Unknown adapter scope ${source.adapter_scope} in ${source.id}`);
  const externalIntegritySources = sources.filter((source) => source.hash_mode === 'FRAMEWORK_LOCK_EXTERNAL');
  if (externalIntegritySources.length !== 1 || externalIntegritySources[0]?.path !== DISTRIBUTION_MANIFEST) {
    errors.push('Distribution manifest must be the only FRAMEWORK_LOCK_EXTERNAL source');
  }
  for (const duplicate of duplicateValues(sources.map((source) => source.id))) errors.push(`Duplicate source ID ${duplicate}`);
  for (const duplicate of duplicateValues(sources.map((source) => source.path))) errors.push(`Duplicate source path ${duplicate}`);
  for (const duplicate of duplicateValues(sources.map((source) => source.path.toLocaleLowerCase('en-US')))) errors.push(`Case-fold source collision ${duplicate}`);
  for (const duplicate of duplicateValues(items.map((item) => item.id))) errors.push(`Duplicate managed ID ${duplicate}`);
  for (const duplicate of duplicateValues(items.map((item) => item.destination))) errors.push(`Duplicate destination ${duplicate}`);
  for (const duplicate of duplicateValues(items.map((item) => item.destination.toLocaleLowerCase('en-US')))) errors.push(`Case-fold destination collision ${duplicate}`);
  for (const source of sources) validateRelativePath(source.path, `source ${source.id}`, errors);
  for (const item of items) validateRelativePath(item.destination, `destination ${item.id}`, errors);

  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const sourceByPath = new Map(sources.map((source) => [source.path, source]));
  const lockFiles = lock?.files ?? {};
  if (lock?.format !== 1 || lock?.algorithm !== 'sha256') errors.push('framework.lock format/algorithm mismatch');
  for (const [path, sha256] of Object.entries(lockFiles)) {
    const source = sourceByPath.get(path);
    if (!source) errors.push(`Locked source is not cataloged: ${path}`);
    else if (source.hash_mode === 'LOCKED_SHA256' && source.sha256 !== sha256) errors.push(`Catalog/lock hash mismatch: ${path}`);
  }
  for (const source of sources) {
    const expected = lockFiles[source.path];
    if (!expected) errors.push(`Catalog source is not locked: ${source.path}`);
    else if (checkFilesystem) await verifySourceFile(root, source, expected, errors);
    for (const parent of source.generated_from ?? []) if (!sourceById.has(parent)) errors.push(`Unknown generated_from ${parent} in ${source.id}`);
  }

  const managedReferenceCounts = new Map();
  for (const item of items) {
    managedReferenceCounts.set(item.source_id, (managedReferenceCounts.get(item.source_id) ?? 0) + 1);
    const source = sourceById.get(item.source_id);
    if (!source) errors.push(`Managed item ${item.id} references unknown source ${item.source_id}`);
    else {
      if (!INSTALLABLE_CLASSES.has(source.class)) errors.push(`Managed item ${item.id} uses non-installable class ${source.class}`);
      if (/^adapters\/(?:chatgpt|claude|codex)\//.test(source.path)) errors.push(`Non-Kiro adapter has global destination: ${source.path}`);
      if (!packageIncludes(source.path, packageManifest)) errors.push(`Managed source is absent from package payload rules: ${source.path}`);
    }
  }
  for (const source of sources.filter((candidate) => candidate.class === 'GLOBAL_KIRO_MANAGED')) {
    const references = managedReferenceCounts.get(source.id) ?? 0;
    if (references !== 1) errors.push(`GLOBAL_KIRO_MANAGED source must map to exactly one managed item: ${source.id} (${source.path}); received ${references}`);
  }

  const groups = {
    core: items.filter((item) => item.destination.startsWith('core/')).length,
    policies: items.filter((item) => item.destination.startsWith('policies/')).length,
    contracts: items.filter((item) => item.destination.startsWith('contracts/')).length,
    skills: items.filter((item) => item.destination.startsWith('skills/')).length,
    adapter: items.filter((item) => item.destination.startsWith('adapters/kiro/')).length,
    entrypoint: items.filter((item) => item.destination === 'steering/agentic-workflow.md').length,
  };
  for (const [group, count] of Object.entries(EXPECTED_GROUPS)) if (groups[group] !== count) errors.push(`Managed ${group} count must be ${count}, received ${groups[group]}`);

  const selfUpdates = items.filter((item) => item.self_update);
  if (selfUpdates.length !== 1 || selfUpdates[0]?.id !== 'skill-bootstrap' || sourceById.get(selfUpdates[0]?.source_id)?.path !== 'skills/workflow-bootstrap/SKILL.md' || selfUpdates[0]?.apply_phase !== 'SELF_UPDATE') {
    errors.push('workflow-bootstrap/SKILL.md must be the only self-update');
  }
  const ordered = topologicalOrder(items, errors);
  if (ordered.length > 0 && ordered.at(-1) !== 'skill-bootstrap') errors.push('Self-update must be topologically last');
  const entrypoints = items.filter((item) => item.loader_role === 'STEERING_ENTRYPOINT');
  if (entrypoints.length !== 1 || entrypoints[0].destination !== 'steering/agentic-workflow.md') errors.push('Exactly one steering entrypoint is required');

  const actualRetirements = manifest.legacy_retirements.map((item) => [item.path, item.baseline_sha256]);
  if (JSON.stringify(actualRetirements) !== JSON.stringify(LEGACY_RETIREMENTS)) errors.push('Legacy retirements differ from the exact v2.3 baseline allowlist');
  if (manifest.operation.directory_mode !== '0755') errors.push('Managed directories must use mode 0755');

  if (checkGenerated) {
    try {
      const [template, generated] = await Promise.all([
        readFile(resolve(root, KIRO_STEERING_TEMPLATE), 'utf8'),
        readFile(resolve(root, KIRO_STEERING_OUTPUT), 'utf8'),
      ]);
      if (generated !== renderKiroSteering(template)) errors.push('Generated agentic-workflow steering drift');
      if (!/^---\ninclusion: always\n---\n/.test(generated)) errors.push('Generated steering is not always included');
    } catch (error) {
      errors.push(`Generated steering unavailable: ${error.message}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    sourceCount: sources.length,
    lockedCount: Object.keys(lockFiles).length,
    managedCount: items.length,
    retirementCount: manifest.legacy_retirements.length,
    groups,
  };
}


function lexicalContained(root, relativePath) {
  if (typeof relativePath !== 'string' || isAbsolute(relativePath) || relativePath.includes('\\') || posix.normalize(relativePath) !== relativePath || relativePath === '..' || relativePath.startsWith('../')) return null;
  const absolute = resolve(root, relativePath);
  const rel = relative(resolve(root), absolute);
  if (rel === '..' || rel.startsWith(`..${sep}`)) return null;
  return absolute;
}

async function observeContainedFile(root, relativePath, { platform = process.platform } = {}) {
  const absolute = lexicalContained(root, relativePath);
  if (!absolute) return { path: relativePath, presence: 'UNKNOWN', file_type: 'OUTSIDE_ROOT', blocked_state: 'OUTSIDE_ROOT' };
  const segments = relativePath.split('/');
  let current = resolve(root);
  for (let index = 0; index < segments.length; index += 1) {
    current = resolve(current, segments[index]);
    let metadata;
    try { metadata = await lstat(current); }
    catch (error) {
      if (error.code === 'ENOENT') return { path: relativePath, presence: 'ABSENT', file_type: null, sha256: null, mode: null, uid: null, gid: null, metadata_applicable: platform !== 'win32' };
      throw error;
    }
    if (metadata.isSymbolicLink()) return { path: relativePath, presence: 'PRESENT', file_type: 'SYMLINK', blocked_state: 'SYMLINK_UNEXPECTED', sha256: null, mode: null, uid: null, gid: null, metadata_applicable: platform !== 'win32' };
    if (index < segments.length - 1 && !metadata.isDirectory()) return { path: relativePath, presence: 'PRESENT', file_type: 'TYPE_CONFLICT', blocked_state: 'TYPE_CONFLICT', sha256: null, mode: null, uid: null, gid: null, metadata_applicable: platform !== 'win32' };
    if (index === segments.length - 1) {
      if (!metadata.isFile()) return { path: relativePath, presence: 'PRESENT', file_type: metadata.isDirectory() ? 'DIRECTORY' : 'OTHER', blocked_state: 'TYPE_CONFLICT', sha256: null, mode: null, uid: null, gid: null, metadata_applicable: platform !== 'win32' };
      return {
        path: relativePath,
        presence: 'PRESENT',
        file_type: 'REGULAR_FILE',
        sha256: digest(await readFile(current)),
        size: metadata.size,
        mode: platform === 'win32' ? null : (metadata.mode & 0o777).toString(8).padStart(4, '0'),
        uid: platform === 'win32' ? null : metadata.uid,
        gid: platform === 'win32' ? null : metadata.gid,
        metadata_applicable: platform !== 'win32',
      };
    }
  }
  return { path: relativePath, presence: 'ABSENT', file_type: null };
}

function receiptEntryFor(priorReceipt, item) {
  return (priorReceipt?.actions ?? []).find((action) => action.item_id === item.id || action.path === item.destination) ?? null;
}

export function classifyDistributionState({ item, source, destination, priorReceipt, knownManagedHashes = [] }) {
  if (destination.blocked_state) return destination.blocked_state;
  if (source.blocked_state || source.presence !== 'PRESENT' || source.sha256 !== source.expected_sha256) return source.blocked_state ?? 'SOURCE_HASH_MISMATCH';
  const prior = receiptEntryFor(priorReceipt, item);
  if ((priorReceipt?.unknown_paths ?? []).includes(item.destination) || prior?.state === 'UNKNOWN') return 'UNKNOWN_PARTIAL';
  if (destination.presence === 'ABSENT') return 'ABSENT';
  if (destination.file_type !== 'REGULAR_FILE') return 'TYPE_CONFLICT';
  if (destination.sha256 === source.expected_sha256) {
    if (destination.metadata_applicable && destination.mode !== item.mode) return 'METADATA_DIVERGENT';
    return 'IDENTICAL';
  }
  const known = new Set(knownManagedHashes);
  if (prior?.after_sha256 && destination.sha256 === prior.after_sha256) return 'MANAGED_OUTDATED';
  if (known.has(destination.sha256)) return 'MANAGED_OUTDATED';
  if (prior?.after_sha256 || prior?.managed === true) return 'MANAGED_DIVERGENT';
  return 'UNMANAGED_PRESENT';
}

export async function buildDistributionSnapshot({
  sourceRoot,
  destinationRoot,
  manifest,
  priorReceipt = null,
  knownManagedHashes = {},
  platform = process.platform,
} = {}) {
  if (!sourceRoot || !destinationRoot || !manifest) throw new Error('sourceRoot, destinationRoot and manifest are required');
  const sourceById = new Map(manifest.source_catalog.map((source) => [source.id, source]));
  const items = [];
  for (const item of manifest.managed_items) {
    const catalogSource = sourceById.get(item.source_id);
    if (!catalogSource) {
      items.push({ id: item.id, destination: item.destination, state: 'SOURCE_HASH_MISMATCH', error: `Unknown source ${item.source_id}` });
      continue;
    }
    const source = await observeContainedFile(sourceRoot, catalogSource.path, { platform });
    source.expected_sha256 = catalogSource.sha256;
    const destination = await observeContainedFile(destinationRoot, item.destination, { platform });
    const state = classifyDistributionState({
      item,
      source,
      destination,
      priorReceipt,
      knownManagedHashes: knownManagedHashes[item.id] ?? knownManagedHashes[item.destination] ?? [],
    });
    items.push({
      id: item.id,
      source_id: item.source_id,
      source_path: catalogSource.path,
      destination: item.destination,
      expected_sha256: catalogSource.sha256,
      source_observation: source,
      destination_observation: destination,
      state,
    });
  }

  const retirements = [];
  for (const retirement of manifest.legacy_retirements) {
    const observation = await observeContainedFile(destinationRoot, retirement.path, { platform });
    let state;
    if (observation.blocked_state) state = observation.blocked_state;
    else if (observation.presence === 'ABSENT') state = 'ABSENT';
    else if (observation.sha256 === retirement.baseline_sha256) state = 'LEGACY_ACTIVE_CONFLICT';
    else state = 'LEGACY_MODIFIED';
    retirements.push({ path: retirement.path, baseline_sha256: retirement.baseline_sha256, observation, state });
  }

  const payload = {
    schema_version: 1,
    platform,
    items: items.sort((left, right) => left.id.localeCompare(right.id)),
    retirements: retirements.sort((left, right) => left.path.localeCompare(right.path)),
  };
  return { ...payload, snapshot_sha256: digest(Buffer.from(JSON.stringify(payload))) };
}


const BLOCKING_STATES = new Set([
  'MANAGED_DIVERGENT',
  'LEGACY_MODIFIED',
  'UNMANAGED_PRESENT',
  'SYMLINK_UNEXPECTED',
  'TYPE_CONFLICT',
  'OUTSIDE_ROOT',
  'SOURCE_HASH_MISMATCH',
  'UNKNOWN_PARTIAL',
]);

function actionForState(state) {
  if (state === 'IDENTICAL') return 'NO_CHANGE';
  if (state === 'ABSENT') return 'CREATE';
  if (state === 'MANAGED_OUTDATED') return 'BACKUP_UPDATE';
  if (state === 'METADATA_DIVERGENT') return 'METADATA_CHECKPOINT';
  return 'BLOCKED';
}

export function planDistribution({
  manifest,
  snapshot,
  authorization = {},
  manifest_sha256,
  lock_sha256,
  package_sha256,
} = {}) {
  if (!manifest || !snapshot) throw new Error('manifest and snapshot are required');
  const errors = [];
  const orderedIds = topologicalOrder(manifest.managed_items, errors);
  if (errors.length > 0) return { decision: 'BLOCKED', errors, actions: [], mutable_actions: [] };
  const itemById = new Map(manifest.managed_items.map((item) => [item.id, item]));
  const snapshotById = new Map(snapshot.items.map((item) => [item.id, item]));
  const normalIds = orderedIds.filter((id) => itemById.get(id).self_update !== true);
  const selfUpdateIds = orderedIds.filter((id) => itemById.get(id).self_update === true);
  const actions = [];
  for (const id of normalIds) {
    const item = itemById.get(id);
    const observed = snapshotById.get(id);
    const state = observed?.state ?? 'UNKNOWN_PARTIAL';
    actions.push({
      sequence: actions.length + 1,
      item_id: id,
      path: item.destination,
      phase: item.apply_phase,
      state,
      action: actionForState(state),
      source_sha256: observed?.expected_sha256 ?? null,
      before_sha256: observed?.destination_observation?.sha256 ?? null,
      predicted_effect: state === 'ABSENT' ? 'FILE_CREATED' : state === 'MANAGED_OUTDATED' ? 'FILE_REPLACED' : state === 'METADATA_DIVERGENT' ? 'METADATA_REVIEWED' : state === 'IDENTICAL' ? 'NONE' : 'NONE_BLOCKED',
    });
  }

  for (const retirement of snapshot.retirements ?? []) {
    const action = retirement.state === 'ABSENT' ? 'NO_CHANGE' : retirement.state === 'LEGACY_ACTIVE_CONFLICT' ? 'BACKUP_RETIRE' : 'BLOCKED';
    actions.push({
      sequence: actions.length + 1,
      item_id: `retire:${retirement.path}`,
      path: retirement.path,
      phase: 'LEGACY_RETIREMENT',
      state: retirement.state,
      action,
      source_sha256: null,
      before_sha256: retirement.observation?.sha256 ?? null,
      predicted_effect: action === 'BACKUP_RETIRE' ? 'LEGACY_FILE_REMOVED' : action === 'NO_CHANGE' ? 'NONE' : 'NONE_BLOCKED',
    });
  }

  for (const id of selfUpdateIds) {
    const item = itemById.get(id);
    const observed = snapshotById.get(id);
    const state = observed?.state ?? 'UNKNOWN_PARTIAL';
    actions.push({
      sequence: actions.length + 1,
      item_id: id,
      path: item.destination,
      phase: 'SELF_UPDATE',
      state,
      action: actionForState(state),
      source_sha256: observed?.expected_sha256 ?? null,
      before_sha256: observed?.destination_observation?.sha256 ?? null,
      predicted_effect: state === 'ABSENT' ? 'SELF_UPDATE_CREATED_AND_STOP' : state === 'MANAGED_OUTDATED' ? 'SELF_UPDATE_REPLACED_AND_STOP' : state === 'IDENTICAL' ? 'NONE' : 'NONE_BLOCKED',
    });
  }

  const blockedActions = actions.filter((action) => action.action === 'BLOCKED' || BLOCKING_STATES.has(action.state));
  const mutableActions = actions.filter((action) => !['NO_CHANGE', 'BLOCKED', 'METADATA_CHECKPOINT'].includes(action.action));
  const backupSet = actions.filter((action) => ['BACKUP_UPDATE', 'BACKUP_RETIRE'].includes(action.action)).map((action) => action.path);
  const metadataCheckpoints = actions.filter((action) => action.action === 'METADATA_CHECKPOINT').map((action) => action.path);
  const rollbackPreview = mutableActions.map((action) => ({
    path: action.path,
    strategy: action.action === 'CREATE' ? 'REMOVE_IF_APPLIED_HASH_MATCHES' : 'RESTORE_VERIFIED_BACKUP',
  }));
  const dryRun = classifyDryRun({
    authorization_current: authorization.current === true,
    scope_contained: blockedActions.every((action) => action.state !== 'OUTSIDE_ROOT'),
    snapshot_matches: authorization.snapshot_sha256 == null || authorization.snapshot_sha256 === snapshot.snapshot_sha256,
    evidence_complete: Boolean(manifest_sha256 && lock_sha256 && package_sha256 && snapshot.snapshot_sha256),
    observability_available: true,
    preconditions: [],
    partial_effect_state: blockedActions.some((action) => action.state === 'UNKNOWN_PARTIAL') ? 'UNKNOWN' : 'NONE',
    mutation: mutableActions.length > 0 ? 'REVERSIBLE' : 'NONE',
    rollback: { available: true, plan: 'verified-backup-and-after-hash-guard' },
    environment: 'SHARED',
    operation_class: 'PERMISSION_SECURITY',
    external_effect: true,
    secrets_present: false,
    data_classes: [],
    risk: 'HIGH',
    reversibility: 'HIGH',
    ambiguity: 'LOW',
    blast_radius: 'CONTAINED',
    determinism: 'DETERMINISTIC',
    idempotency: 'IDEMPOTENT',
    equivalence: 'VALIDATED',
  });
  const decision = blockedActions.length > 0 ? 'BLOCKED' : 'CHECKPOINT_REQUIRED';
  return {
    schema_version: 1,
    decision,
    dry_run_decision: dryRun.decision,
    bindings: {
      manifest_sha256: manifest_sha256 ?? null,
      lock_sha256: lock_sha256 ?? null,
      package_sha256: package_sha256 ?? null,
      snapshot_sha256: snapshot.snapshot_sha256,
      authorization_snapshot_sha256: authorization.snapshot_sha256 ?? null,
    },
    actions,
    mutable_actions: mutableActions,
    blocked_actions: blockedActions,
    backup_set: backupSet,
    metadata_checkpoints: metadataCheckpoints,
    rollback_preview: rollbackPreview,
    predicted_effects: actions.map(({ path, predicted_effect }) => ({ path, effect: predicted_effect })),
    stop_criteria: [
      'SNAPSHOT_DIVERGED',
      'AUTHORIZATION_EXPIRED',
      'SOURCE_HASH_MISMATCH',
      'UNEXPECTED_PATH_OR_TYPE',
      'UNKNOWN_PARTIAL_EFFECT',
      'SELF_UPDATE_COMPLETED',
    ],
    operations_not_authorized: ['GLOBAL_APPLY', 'REAL_LEGACY_RETIREMENT', 'REAL_SELF_UPDATE', 'RESTART', 'POST_RESTART_VALIDATION', 'ROLLBACK', 'GIT', 'REMOTE'],
    errors,
  };
}
