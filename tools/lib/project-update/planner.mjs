import { createHash } from 'node:crypto';
import YAML from 'yaml';
import { canonicalSha256 } from '../canonical-json.mjs';
import { assertProjectOperationId } from './authorization.mjs';
import { assertNoCaseFoldCollisions, assertProjectLogicalPath } from './paths.mjs';
import { GIT_OPERATIONS_NOT_AUTHORIZED, projectSnapshotSha256 } from './snapshot.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function fail(code, detail = null) {
  const error = new Error(code);
  error.code = code;
  if (detail !== null) error.detail = detail;
  throw error;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

function yamlDocument(value) {
  return YAML.stringify(stable(value), { lineWidth: 0, sortMapEntries: true });
}

function pathsOf(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return prefix ? [prefix] : [];
  return Object.keys(value).sort().flatMap((key) => pathsOf(value[key], prefix ? `${prefix}.${key}` : key));
}

export function mergeUserOwnedDocument(current, desiredFields) {
  if (!current || typeof current !== 'object' || Array.isArray(current) || !desiredFields || typeof desiredFields !== 'object' || Array.isArray(desiredFields)) fail('PROFILE_MERGE_DOCUMENT_REQUIRED');
  const changed = [];
  function merge(left, right, prefix = '') {
    const output = structuredClone(left);
    for (const key of Object.keys(right).sort()) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (right[key] && typeof right[key] === 'object' && !Array.isArray(right[key]) && left[key] && typeof left[key] === 'object' && !Array.isArray(left[key])) output[key] = merge(left[key], right[key], path);
      else if (canonicalSha256(left[key] ?? null) !== canonicalSha256(right[key])) {
        output[key] = structuredClone(right[key]);
        changed.push(path);
      }
    }
    return output;
  }
  const merged = merge(current, desiredFields);
  const desiredPaths = new Set(pathsOf(desiredFields));
  const preservedUnknownPaths = pathsOf(current).filter((path) => !desiredPaths.has(path) && ![...desiredPaths].some((owned) => owned.startsWith(`${path}.`))).sort();
  return Object.freeze({ document: merged, changed_paths: changed.sort(), preserved_unknown_paths: preservedUnknownPaths });
}

function parseDesiredDocument(content) {
  let document;
  try { document = YAML.parse(content); } catch { fail('PROJECT_DESIRED_YAML_INVALID'); }
  if (!document || typeof document !== 'object' || Array.isArray(document)) fail('PROJECT_DESIRED_DOCUMENT_INVALID');
  return document;
}

export function planProjectUpdate({ manifest, snapshot, operationId }) {
  assertProjectOperationId(operationId);
  if (!manifest || !Array.isArray(manifest.files)) fail('PROJECT_MANIFEST_FILES_REQUIRED');
  if (manifest.project_root !== snapshot.project_root || manifest.snapshot_sha256 !== projectSnapshotSha256(snapshot)) fail('PROJECT_MANIFEST_SNAPSHOT_DIVERGED');
  const paths = manifest.files.map((file) => assertProjectLogicalPath(file.path));
  assertNoCaseFoldCollisions(paths);
  const byPath = new Map(snapshot.entries.filter((entry) => entry.type === 'FILE').map((entry) => [entry.path, entry]));
  const actions = [];
  for (const [index, file] of manifest.files.entries()) {
    if (!['FRAMEWORK_MANAGED', 'USER_OWNED'].includes(file.ownership) || typeof file.content_utf8 !== 'string') fail('PROJECT_MANIFEST_FILE_INVALID');
    const before = byPath.get(file.path) ?? null;
    const desiredBytes = Buffer.from(file.content_utf8, 'utf8');
    let afterContent = file.content_utf8;
    let action = before ? 'UPDATE' : 'CREATE';
    let mergeProposal;
    if (file.ownership === 'USER_OWNED' && file.path !== '.agentic/application-profile.yaml') fail('PROJECT_USER_OWNED_PATH_UNSUPPORTED');
    if (file.path === '.agentic/application-profile.yaml' && before) {
      const merged = mergeUserOwnedDocument(parseDesiredDocument(snapshot.profile.content_utf8), parseDesiredDocument(file.content_utf8));
      if (merged.changed_paths.length === 0) continue;
      afterContent = yamlDocument(merged.document);
      action = 'MERGE_PROPOSAL';
      mergeProposal = {
        strategy: 'FIELD_AWARE_PRESERVE_UNKNOWN',
        changed_paths: merged.changed_paths,
        preserved_unknown_paths: merged.preserved_unknown_paths,
      };
    }
    const afterSha256 = sha256(Buffer.from(afterContent, 'utf8'));
    if (before?.sha256 === afterSha256) continue;
    const planned = {
      sequence: index + 1,
      item_id: file.id,
      path: file.path,
      action,
      ownership: file.ownership,
      before_sha256: before?.sha256 ?? null,
      after_sha256: afterSha256,
      content_utf8: afterContent,
    };
    if (mergeProposal) planned.merge_proposal = mergeProposal;
    actions.push(planned);
  }
  actions.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  actions.forEach((action, index) => { action.sequence = index + 1; });
  return Object.freeze({
    schema_version: 1,
    operation_id: operationId,
    manifest_sha256: canonicalSha256(manifest),
    project_root_sha256: snapshot.project_root_sha256,
    project_snapshot_sha256: projectSnapshotSha256(snapshot),
    profile_before_sha256: snapshot.profile.sha256,
    decision: actions.length ? 'PROPOSAL' : 'NO_CHANGE',
    checkpoint_required: actions.length > 0,
    operations_not_authorized: GIT_OPERATIONS_NOT_AUTHORIZED,
    actions,
  });
}
