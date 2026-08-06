import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import YAML from 'yaml';

export const frameworkRoot = resolve(new URL('../..', import.meta.url).pathname);

export function containedPath(root, candidate) {
  const base = resolve(root);
  const target = resolve(base, candidate);
  const rel = relative(base, target);
  if (rel === '..' || rel.startsWith(`..${sep}`) || rel.includes(`${sep}..${sep}`)) {
    throw new Error(`Path escapes root: ${candidate}`);
  }
  return target;
}

export async function readYaml(path) {
  return YAML.parse(await readFile(path, 'utf8'));
}

export async function readText(path) {
  return readFile(path, 'utf8');
}

export async function walk(root, { exclude = [] } = {}) {
  const output = [];
  async function visit(directory) {
    for (const name of (await readdir(directory)).sort()) {
      const path = resolve(directory, name);
      const rel = relative(root, path).split(sep).join('/');
      if (exclude.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) continue;
      const metadata = await stat(path);
      if (metadata.isDirectory()) await visit(path);
      else if (metadata.isFile()) output.push(path);
    }
  }
  await visit(resolve(root));
  return output;
}
