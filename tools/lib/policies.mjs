import { access } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { frameworkRoot, readText, readYaml, walk } from './io.mjs';

const requiredPolicies = [
  'CapabilitySelectionPolicy.md',
  'ContextPolicy.md',
  'ExecutionEnvironmentPolicy.md',
  'GitSafetyPolicy.md',
  'SecureDevelopmentPolicy.md',
  'HighRiskOverlay.md',
  'OperationalRetentionPolicy.md',
];

const concreteNamePatterns = [
  /\bChatGPT\b/i,
  /\bCodex\b/i,
  /\bClaude\b/i,
  /\bKiro\b/i,
  /\bGPT-\d/i,
  /\b(?:Opus|Sonnet|Haiku)\s+\d/i,
  /\b(?:Gemini|DeepSeek|MiniMax|Qwen)\b/i,
  /\b(?:OpenAI|Anthropic|Google)\b/i,
];

export function scanToolCoupling(entries) {
  const errors = [];
  for (const { path, text } of entries) {
    for (const pattern of concreteNamePatterns) {
      if (pattern.test(text)) errors.push(`${path}: concrete tool or model name matched ${pattern}`);
    }
  }
  return errors;
}

function selectionBoundaryAllows(path) {
  const normalized = String(path).replaceAll('\\', '/');
  return normalized.startsWith('adapters/')
    || /^tests\/adapters\/snapshots\/handoff[^/]*\.json$/.test(normalized);
}

export function scanSelectionBoundaries(entries) {
  return scanToolCoupling((entries ?? []).filter(({ path }) => !selectionBoundaryAllows(path)));
}

export function detectDuplicateParagraphs(entries, { minimumLength = 120 } = {}) {
  const occurrences = new Map();
  for (const { path, text } of entries) {
    for (const paragraph of text.split(/\n\s*\n/)) {
      const normalized = paragraph.replace(/^#+\s+/gm, '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (normalized.length < minimumLength) continue;
      const paths = occurrences.get(normalized) ?? new Set();
      paths.add(path);
      occurrences.set(normalized, paths);
    }
  }
  return [...occurrences.entries()]
    .filter(([, paths]) => paths.size > 1)
    .map(([text, paths]) => ({ paths: [...paths].sort(), sample: text.slice(0, 100) }));
}

async function entriesUnder(root, directories) {
  const entries = [];
  for (const directory of directories) {
    const absolute = resolve(root, directory);
    try {
      await access(absolute);
    } catch {
      continue;
    }
    for (const path of await walk(absolute)) {
      if (!/\.(md|yaml|json)$/.test(path)) continue;
      entries.push({ path: relative(root, path).split(sep).join('/'), text: await readText(path) });
    }
  }
  return entries;
}

export async function validateSelectionBoundaries(root = frameworkRoot) {
  const entries = await entriesUnder(root, ['core', 'policies', 'contracts', 'skills', 'adapters', 'tests/adapters/snapshots']);
  const errors = scanSelectionBoundaries(entries);
  return { ok: errors.length === 0, errors, warnings: [], scanned: entries.length };
}

export async function validatePolicies(root = frameworkRoot) {
  const errors = [];
  const warnings = [];
  for (const file of requiredPolicies) {
    try { await access(resolve(root, 'policies', file)); }
    catch { errors.push(`Missing policy policies/${file}`); }
  }

  const ownership = await readYaml(resolve(root, 'policies/ownership.yaml'));
  const owners = Object.values(ownership.domains ?? {});
  if (new Set(Object.keys(ownership.domains ?? {})).size !== Object.keys(ownership.domains ?? {}).length) errors.push('Duplicate ownership domain');
  for (const ownerPath of owners) {
    try { await access(resolve(root, ownerPath)); }
    catch { errors.push(`Ownership path does not exist: ${ownerPath}`); }
  }

  const coupledEntries = await entriesUnder(root, ['core', 'policies', 'contracts', 'skills']);
  errors.push(...scanToolCoupling(coupledEntries));
  const allNormative = await entriesUnder(root, ['core', 'policies', 'contracts', 'skills']);
  for (const duplicate of detectDuplicateParagraphs(allNormative)) warnings.push(`Duplicate normative paragraph: ${duplicate.paths.join(', ')}`);

  return {
    ok: errors.length === 0 && warnings.length === 0,
    errors,
    warnings,
    ownership: ownership.domains,
    policyCount: requiredPolicies.length,
  };
}
