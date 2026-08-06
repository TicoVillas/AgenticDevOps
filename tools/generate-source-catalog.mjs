import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import YAML from 'yaml';
import { frameworkRoot, walk } from './lib/io.mjs';
import { DISTRIBUTION_MANIFEST } from './lib/distribution.mjs';

const VERSION = '3.0.0';
const slash = (value) => value.split(sep).join('/');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

function slug(value) {
  return value
    .replace(/\.schema\.yaml$/, '')
    .replace(/\.(?:test\.mjs|mjs|json|ya?ml|md)$/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function newSourceId(path) {
  if (path === 'policies/OperationalRetentionPolicy.md') return 'policy-operational-retention';
  if (path === 'generated/reports/framework-governance-and-portability-traceability.md') return 'generated-report-governance-traceability';
  if (path.startsWith('contracts/migrations/')) return `migration-${slug(path.slice('contracts/migrations/'.length))}`;
  if (path.startsWith('contracts/schemas/')) return `schema-${slug(path.slice('contracts/schemas/'.length))}`;
  if (path.startsWith('contracts/templates/')) return `template-${slug(path.slice('contracts/templates/'.length))}`;
  if (path.startsWith('tests/fixtures/')) return `test-fixture-${slug(path.slice('tests/fixtures/'.length))}`;
  if (path.startsWith('tests/')) return `test-${slug(path.slice('tests/'.length))}`;
  if (path.startsWith('tools/lib/')) return `tool-lib-${slug(path.slice('tools/lib/'.length))}`;
  if (path.startsWith('tools/')) return `tool-${slug(path.slice('tools/'.length))}`;
  if (path.startsWith('policies/')) return `policy-${slug(path.slice('policies/'.length))}`;
  return `source-${slug(path)}`;
}

function classification(path) {
  if (path === 'generated/reports/framework-governance-and-portability-traceability.md') {
    return {
      class: 'GENERATED_PACKAGE_CONTENT',
      adapter_scope: 'none',
      generated_from: ['tool-generate-spec-traceability', 'tool-lib-spec-traceability'],
    };
  }
  if (path.startsWith('tests/')) return { class: 'BUILD_TEST_ONLY', adapter_scope: 'none' };
  if (path.startsWith('contracts/') || path.startsWith('policies/')) return { class: 'SOURCE_ONLY', adapter_scope: 'universal' };
  return { class: 'SOURCE_ONLY', adapter_scope: 'none' };
}

export async function generateSourceCatalog(root = frameworkRoot) {
  const manifestPath = resolve(root, DISTRIBUTION_MANIFEST);
  const text = await readFile(manifestPath, 'utf8');
  const document = YAML.parseDocument(text);
  const manifest = document.toJS();
  const existing = new Map((manifest.source_catalog ?? []).map((source) => [source.path, source]));
  const files = (await walk(root, { exclude: ['node_modules'] }))
    .map((path) => slash(relative(root, path)))
    .filter((path) => path !== 'framework.lock' && !path.endsWith('.tgz'))
    .sort();
  const usedIds = new Set();
  const sourceCatalog = [];
  for (const path of files) {
    const prior = existing.get(path);
    let id = prior?.id ?? newSourceId(path);
    let suffix = 2;
    while (usedIds.has(id)) id = `${prior?.id ?? newSourceId(path)}-${suffix++}`;
    usedIds.add(id);
    const source = prior
      ? { ...prior }
      : { id, path, version: VERSION, ...classification(path), hash_mode: 'LOCKED_SHA256' };
    source.id = id;
    source.path = path;
    source.version = VERSION;
    if (path === DISTRIBUTION_MANIFEST) {
      source.hash_mode = 'FRAMEWORK_LOCK_EXTERNAL';
      delete source.sha256;
    } else {
      source.hash_mode = 'LOCKED_SHA256';
      source.sha256 = digest(await readFile(resolve(root, path)));
    }
    sourceCatalog.push(source);
  }
  document.set('source_catalog', sourceCatalog);
  await writeFile(manifestPath, document.toString({ lineWidth: 0 }), 'utf8');
  return { files: sourceCatalog.length, managed: manifest.managed_items?.length ?? 0 };
}

const result = await generateSourceCatalog();
console.log(JSON.stringify({ status: 'GENERATED', ...result }));
