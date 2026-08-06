import { relative, resolve, sep } from 'node:path';
import { assertSyntheticLifecycleRoots, containedLifecyclePath, isWithin } from '../lifecycle/paths.mjs';

function fail(code, detail = null) {
  const error = new Error(code);
  error.code = code;
  if (detail !== null) error.detail = detail;
  throw error;
}

async function assertDirectoryIdentity(fs, path, sandboxRoot) {
  const metadata = await fs.lstat(path);
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) fail('PROJECT_ROOT_TYPE_UNSAFE', path);
  if (await fs.realpath(path) !== path) fail('PROJECT_ROOT_REALPATH_DIVERGED', path);
  const rel = relative(sandboxRoot, path);
  let cursor = sandboxRoot;
  for (const part of rel.split(sep).filter(Boolean)) {
    cursor = resolve(cursor, part);
    const ancestor = await fs.lstat(cursor);
    if (ancestor.isSymbolicLink() || !ancestor.isDirectory()) fail('PROJECT_ROOT_ANCESTRY_UNSAFE', cursor);
  }
}

export async function assertSyntheticProjectRoots({ fs, projectRoot, stateRoot, stagingRoot, globalRoot, sourceRoot, sandboxRoot, prohibitedRoots = [] }) {
  if (!fs?.realpath || !fs?.lstat) fail('PROJECT_FILESYSTEM_CAPABILITIES_REQUIRED');
  const roots = assertSyntheticLifecycleRoots({
    sourceRoot,
    destinationRoot: projectRoot,
    stateRoot,
    cacheRoot: stagingRoot,
    tempRoot: globalRoot,
    sandboxRoot,
    prohibitedRoots,
  });
  await assertDirectoryIdentity(fs, roots.sandboxRoot, roots.sandboxRoot);
  for (const path of [roots.sourceRoot, roots.destinationRoot, roots.stateRoot, roots.cacheRoot, roots.tempRoot]) {
    if (!isWithin(roots.sandboxRoot, path)) fail('PROJECT_ROOT_OUTSIDE_SYNTHETIC_SANDBOX');
    await assertDirectoryIdentity(fs, path, roots.sandboxRoot);
  }
  return Object.freeze({
    sandboxRoot: roots.sandboxRoot,
    sourceRoot: roots.sourceRoot,
    projectRoot: roots.destinationRoot,
    stateRoot: roots.stateRoot,
    stagingRoot: roots.cacheRoot,
    globalRoot: roots.tempRoot,
  });
}

export function assertProjectLogicalPath(path) {
  if (typeof path !== 'string' || !path.startsWith('.agentic/')) fail('PROJECT_PATH_OUTSIDE_ALLOWLIST');
  if (path.includes('\\') || path.includes('\0')) fail('INVALID_PROJECT_PATH');
  const parts = path.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) fail('INVALID_PROJECT_PATH');
  return path;
}

export function containedProjectPath(projectRoot, logicalPath) {
  assertProjectLogicalPath(logicalPath);
  return containedLifecyclePath(projectRoot, logicalPath);
}

export function assertNoCaseFoldCollisions(paths) {
  const seen = new Map();
  for (const path of paths) {
    const folded = path.normalize('NFC').toLowerCase();
    const prior = seen.get(folded);
    if (prior && prior !== path) fail('PROJECT_CASE_FOLD_COLLISION', { left: prior, right: path });
    seen.set(folded, path);
  }
  return true;
}
