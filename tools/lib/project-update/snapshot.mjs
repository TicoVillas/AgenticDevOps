import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import YAML from 'yaml';
import { canonicalSha256 } from '../canonical-json.mjs';
import { assertNoCaseFoldCollisions, containedProjectPath } from './paths.mjs';

export const GIT_OPERATIONS_NOT_AUTHORIZED = Object.freeze([
  'GIT_INIT', 'GIT_STAGE', 'GIT_COMMIT', 'GIT_CHECKOUT', 'GIT_RESET',
  'GIT_CLEAN', 'GIT_PUSH', 'GIT_BRANCH', 'GIT_TAG',
]);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function fail(code, detail = null) {
  const error = new Error(code);
  error.code = code;
  if (detail !== null) error.detail = detail;
  throw error;
}

function normalizeGitObservation(observation) {
  if (!observation || observation.read_only !== true) fail('READ_ONLY_GIT_OBSERVER_REQUIRED');
  if (typeof observation.initialized !== 'boolean') fail('INVALID_GIT_OBSERVATION');
  for (const field of ['branch', 'head']) if (observation[field] !== null && typeof observation[field] !== 'string') fail('INVALID_GIT_OBSERVATION');
  if (!Array.isArray(observation.status) || observation.status.some((entry) => typeof entry !== 'string')) fail('INVALID_GIT_OBSERVATION');
  return Object.freeze({
    read_only: true,
    initialized: observation.initialized,
    branch: observation.branch,
    head: observation.head,
    status: [...observation.status].sort(),
  });
}

async function readAgenticEntries(fs, projectRoot) {
  const entries = [];
  const agenticRoot = resolve(projectRoot, '.agentic');
  try {
    const metadata = await fs.lstat(agenticRoot);
    if (metadata.isSymbolicLink() || !metadata.isDirectory()) fail('PROJECT_AGENTIC_ROOT_UNSAFE');
  } catch (error) {
    if (error.code === 'ENOENT') return entries;
    throw error;
  }
  async function visit(directory, prefix) {
    const names = (await fs.readdir(directory, { withFileTypes: true })).sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
    for (const dirent of names) {
      if (dirent.name.includes('\\') || dirent.name.includes('\0')) fail('INVALID_PROJECT_PATH');
      const logicalPath = `${prefix}/${dirent.name}`;
      const absolute = containedProjectPath(projectRoot, logicalPath);
      const metadata = await fs.lstat(absolute);
      if (metadata.isSymbolicLink()) fail('PROJECT_SYMLINK_UNEXPECTED', logicalPath);
      if (metadata.isDirectory()) {
        entries.push({ path: logicalPath, type: 'DIRECTORY', size: 0, sha256: null });
        await visit(absolute, logicalPath);
      } else if (metadata.isFile()) {
        const bytes = await fs.readFile(absolute);
        entries.push({ path: logicalPath, type: 'FILE', size: bytes.length, sha256: sha256(bytes) });
      } else fail('PROJECT_TYPE_CONFLICT', logicalPath);
    }
  }
  await visit(agenticRoot, '.agentic');
  assertNoCaseFoldCollisions(entries.map((entry) => entry.path));
  return entries;
}

async function observeProfile(fs, projectRoot, entries) {
  const path = '.agentic/application-profile.yaml';
  const entry = entries.find((candidate) => candidate.path === path);
  if (!entry) return Object.freeze({ path, presence: 'ABSENT', sha256: null, content_utf8: null });
  if (entry.type !== 'FILE') fail('PROJECT_PROFILE_TYPE_CONFLICT');
  const content = (await fs.readFile(containedProjectPath(projectRoot, path))).toString('utf8');
  let document;
  try { document = YAML.parse(content); } catch { fail('PROJECT_PROFILE_YAML_INVALID'); }
  if (!document || typeof document !== 'object' || Array.isArray(document)) fail('PROJECT_PROFILE_DOCUMENT_INVALID');
  return Object.freeze({ path, presence: 'PRESENT', sha256: entry.sha256, content_utf8: content });
}

export async function buildProjectSnapshot({ fs, projectRoot, gitObserver }) {
  if (typeof gitObserver !== 'function') fail('READ_ONLY_GIT_OBSERVER_REQUIRED');
  const rootMetadata = await fs.lstat(projectRoot);
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory() || await fs.realpath(projectRoot) !== projectRoot) fail('PROJECT_ROOT_UNSAFE');
  const entries = await readAgenticEntries(fs, projectRoot);
  const profile = await observeProfile(fs, projectRoot, entries);
  const git = normalizeGitObservation(await gitObserver({ projectRoot }));
  return Object.freeze({
    schema_version: 1,
    project_root: projectRoot,
    project_root_sha256: canonicalSha256({ project_root: projectRoot }),
    entries,
    profile,
    git,
    operations_not_authorized: GIT_OPERATIONS_NOT_AUTHORIZED,
  });
}

export function projectSnapshotSha256(snapshot) {
  return canonicalSha256(snapshot);
}
