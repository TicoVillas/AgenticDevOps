import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { frameworkRoot, readText, readYaml, walk } from './io.mjs';

export const decisionFiles = Object.freeze([
  'DEC-001-session-topology.md',
  'DEC-002-autopilot-default.md',
  'DEC-003-role-mapping.md',
  'DEC-004-tool-neutral-core.md',
]);
const decisionHeadings = ['Context', 'Decision', 'Alternatives', 'Consequences', 'References'];
const lifecyclePath = 'adapters/kiro/compatibility-lifecycle.yaml';

export function renderDiscoveryRouterAlias(canonicalText) {
  return `<!-- GENERATED COMPATIBILITY ALIAS; DO NOT EDIT -->\n\n> WARNING: DiscoveryRouter.md is a deprecated v3.0 compatibility alias. Use core/WorkflowRouter.md. v3.1 requires consumer migration; v3.2 removal remains conditional on a zero-consumer scan.\n\n${canonicalText}`;
}

export function scanLegacyConsumers(entries, alias = 'DiscoveryRouter.md') {
  return entries
    .filter(({ path, text }) => !path.endsWith(alias) && String(text).includes(alias))
    .map(({ path, isNew = false }) => ({ path, isNew }));
}

export function evaluateCompatibilityLifecycle(lifecycle, version, consumers) {
  const errors = [];
  const warnings = [];
  const rule = lifecycle?.versions?.[version];
  if (!rule) return { ok: false, errors: [`Unknown compatibility lifecycle version ${version}`], warnings, consumers, removalEligible: false };
  if (version === '3.0') warnings.push('DiscoveryRouter.md is deprecated compatibility; consumers should use core/WorkflowRouter.md');
  if (rule.migration_required && consumers.length) warnings.push(`${consumers.length} legacy consumer(s) require migration`);
  if (rule.new_consumer_policy === 'REJECT') {
    for (const consumer of consumers.filter(({ isNew }) => isNew)) errors.push(`New legacy consumer rejected: ${consumer.path}`);
  }
  const removalEligible = rule.removal_allowed === true && (!rule.requires_zero_consumers || consumers.length === 0);
  if (version === '3.2' && consumers.length) errors.push('Alias removal blocked while legacy consumers remain');
  return { ok: errors.length === 0, errors, warnings, consumers, removalEligible, rule };
}

async function defaultConsumerEntries(root, aliasPath, lifecycleFile) {
  const entries = [];
  for (const directory of ['core', 'policies', 'contracts', 'skills', 'adapters']) {
    for (const path of await walk(resolve(root, directory))) {
      const rel = relative(root, path).split(sep).join('/');
      if (rel === aliasPath || rel === lifecycleFile || !/\.(md|yaml)$/.test(path)) continue;
      entries.push({ path: rel, text: await readText(path), isNew: false });
    }
  }
  return entries;
}

export async function generateCompatibility(root = frameworkRoot) {
  const lifecycle = await readYaml(resolve(root, lifecyclePath));
  const canonicalPath = resolve(root, 'adapters/kiro', lifecycle.router.canonical);
  const aliasPath = resolve(root, 'adapters/kiro', lifecycle.router.alias);
  const canonical = await readText(canonicalPath);
  await mkdir(dirname(aliasPath), { recursive: true });
  await writeFile(aliasPath, renderDiscoveryRouterAlias(canonical), 'utf8');
  return relative(root, aliasPath).split(sep).join('/');
}

export async function validateDecisionRecords(root = frameworkRoot) {
  const errors = [];
  for (const file of decisionFiles) {
    const path = resolve(root, 'decisions', file);
    let text;
    try { text = await readText(path); }
    catch { errors.push(`Missing decision record decisions/${file}`); continue; }
    if (!text.includes('**Status:** ACCEPTED')) errors.push(`${file}: status must be ACCEPTED`);
    if (!text.includes('**Version:** 3.0.0')) errors.push(`${file}: version must be 3.0.0`);
    for (const heading of decisionHeadings) if (!text.includes(`## ${heading}`)) errors.push(`${file}: missing section ${heading}`);
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      const reference = match[1];
      if (/^(?:https?:|#)/.test(reference)) continue;
      try { await access(resolve(dirname(path), reference)); }
      catch { errors.push(`${file}: broken reference ${reference}`); }
    }
  }
  return { ok: errors.length === 0, errors, count: decisionFiles.length };
}

export async function validateCompatibility({ root = frameworkRoot, version = '3.0', consumerEntries } = {}) {
  const errors = [];
  const lifecycle = await readYaml(resolve(root, lifecyclePath));
  if (lifecycle.canonical_project_root !== '.agentic') errors.push('.agentic must be the canonical project root');
  if (lifecycle.compatibility_project_root !== '.kiro') errors.push('.kiro must be the compatibility project root');
  if (JSON.stringify(Object.keys(lifecycle.versions ?? {})) !== JSON.stringify(['3.0', '3.1', '3.2'])) errors.push('Compatibility lifecycle must define v3.0, v3.1 and v3.2 in order');
  if (lifecycle.router?.generated !== true) errors.push('DiscoveryRouter alias must be generated');

  const canonicalPath = resolve(root, 'adapters/kiro', lifecycle.router.canonical);
  const aliasPath = resolve(root, 'adapters/kiro', lifecycle.router.alias);
  try {
    const [canonical, alias] = await Promise.all([readText(canonicalPath), readFile(aliasPath, 'utf8')]);
    if (alias !== renderDiscoveryRouterAlias(canonical)) errors.push('Generated DiscoveryRouter alias drift');
  } catch (error) {
    errors.push(`Compatibility router unavailable: ${error.message}`);
  }

  const aliasRel = relative(root, aliasPath).split(sep).join('/');
  const entries = consumerEntries ?? await defaultConsumerEntries(root, aliasRel, lifecyclePath);
  const consumers = scanLegacyConsumers(entries);
  const evaluated = evaluateCompatibilityLifecycle(lifecycle, version, consumers);
  errors.push(...evaluated.errors);
  return { ok: errors.length === 0, errors, warnings: evaluated.warnings, version, consumers, removalEligible: evaluated.removalEligible };
}
