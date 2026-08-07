import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { frameworkRoot, walk } from './io.mjs';

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function buildFrameworkLock(root = frameworkRoot) {
  const paths = await walk(root, { exclude: ['node_modules', '.git'] });
  const files = {};
  for (const path of paths) {
    const rel = relative(root, path).split(sep).join('/');
    if (rel === 'framework.lock' || rel.endsWith('.tgz')) continue;
    files[rel] = sha256(await readFile(path));
  }
  return { format: 1, algorithm: 'sha256', files };
}

export async function writeFrameworkLock(root = frameworkRoot) {
  const lock = await buildFrameworkLock(root);
  await writeFile(resolve(root, 'framework.lock'), `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  return lock;
}

export async function verifyFrameworkLock(root = frameworkRoot) {
  const expected = JSON.parse(await readFile(resolve(root, 'framework.lock'), 'utf8'));
  const actual = await buildFrameworkLock(root);
  const errors = [];
  for (const [path, hash] of Object.entries(expected.files)) {
    if (!(path in actual.files)) errors.push(`Missing locked file ${path}`);
    else if (actual.files[path] !== hash) errors.push(`Hash mismatch ${path}`);
  }
  for (const path of Object.keys(actual.files)) if (!(path in expected.files)) errors.push(`Unlocked file ${path}`);
  return { ok: errors.length === 0, errors, expectedCount: Object.keys(expected.files).length, actualCount: Object.keys(actual.files).length };
}
