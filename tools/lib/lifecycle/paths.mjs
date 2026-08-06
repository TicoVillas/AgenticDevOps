import { isAbsolute, relative, resolve, sep } from 'node:path';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

export function isWithin(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

export function assertNormalizedAbsolute(path, code = 'INVALID_ROOT') {
  if (typeof path !== 'string' || !isAbsolute(path) || resolve(path) !== path) fail(code);
  return path;
}

export function assertSyntheticLifecycleRoots({ sourceRoot, destinationRoot, stateRoot, cacheRoot, tempRoot, sandboxRoot, prohibitedRoots = [] }) {
  const roots = {
    sourceRoot: assertNormalizedAbsolute(sourceRoot, 'SOURCE_ROOT_REQUIRED'),
    destinationRoot: assertNormalizedAbsolute(destinationRoot, 'DESTINATION_ROOT_REQUIRED'),
    stateRoot: assertNormalizedAbsolute(stateRoot, 'STATE_ROOT_REQUIRED'),
    cacheRoot: assertNormalizedAbsolute(cacheRoot, 'CACHE_ROOT_REQUIRED'),
    tempRoot: assertNormalizedAbsolute(tempRoot, 'TEMP_ROOT_REQUIRED'),
    sandboxRoot: assertNormalizedAbsolute(sandboxRoot, 'SYNTHETIC_SANDBOX_ROOT_REQUIRED'),
  };
  for (const [name, value] of Object.entries(roots)) {
    if (name !== 'sandboxRoot' && !isWithin(roots.sandboxRoot, value)) fail('ROOT_OUTSIDE_SYNTHETIC_SANDBOX');
  }
  const material = [roots.sourceRoot, roots.destinationRoot, roots.stateRoot, roots.cacheRoot, roots.tempRoot];
  for (let left = 0; left < material.length; left += 1) for (let right = left + 1; right < material.length; right += 1) {
    if (isWithin(material[left], material[right]) || isWithin(material[right], material[left])) fail('LIFECYCLE_ROOTS_MUST_BE_DISJOINT');
  }
  for (const prohibited of prohibitedRoots.map((path) => assertNormalizedAbsolute(path, 'INVALID_PROHIBITED_ROOT'))) {
    for (const value of material) if (isWithin(prohibited, value) || isWithin(value, prohibited)) fail('REAL_GLOBAL_ROOT_PROHIBITED');
  }
  return Object.freeze(roots);
}

export function containedLifecyclePath(root, relativePath) {
  if (typeof relativePath !== 'string' || relativePath.length === 0 || isAbsolute(relativePath) || relativePath.includes('\\') || relativePath.includes('\0')) fail('INVALID_RELATIVE_PATH');
  const parts = relativePath.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) fail('INVALID_RELATIVE_PATH');
  const target = resolve(root, ...parts);
  if (!isWithin(root, target)) fail('PATH_OUTSIDE_AUTHORIZED_ROOT');
  return target;
}
