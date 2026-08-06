import { access, readFile } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { frameworkRoot, readText, readYaml, walk } from './io.mjs';
import { scanToolCoupling } from './policies.mjs';

export const expectedAdapters = Object.freeze(['chatgpt', 'codex', 'claude', 'kiro']);
export const responseProfileNames = Object.freeze(['DELTA', 'DECISION', 'HANDOFF', 'REVIEW', 'RESEARCH', 'FULL_ARTIFACT']);
export const handoffSelectionSections = Object.freeze(['SELECTION_RECOMMENDATION', 'SELECTION_RATIONALE', 'FALLBACK_GUIDANCE']);
const selectionContract = '../../contracts/schemas/execution-selection.schema.yaml';
const allowedEfforts = new Set(['LOW', 'MEDIUM', 'HIGH', 'XHIGH', 'MAX']);
const forbiddenSemanticKeys = new Set(['phases', 'roles', 'statuses', 'transitions', 'automatic_transitions']);

export function countWords(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean).length;
}

function contentUnits(text) {
  return String(text ?? '')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((unit) => unit.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())
    .filter((unit) => unit.length >= 24 && unit.split(/\s+/).length >= 4);
}

export function detectDuplicateInformation(parts) {
  const seen = new Map();
  const duplicates = [];
  for (const [part, text] of Object.entries(parts ?? {})) {
    for (const unit of contentUnits(text)) {
      const previous = seen.get(unit);
      if (previous && previous !== part) duplicates.push({ unit, parts: [previous, part] });
      else seen.set(unit, part);
    }
  }
  return duplicates;
}

export function detectDuplicateMetadata(parts) {
  const seen = new Map();
  const duplicates = [];
  for (const [part, text] of Object.entries(parts ?? {})) {
    for (const match of String(text ?? '').matchAll(/^([A-Za-z][A-Za-z0-9 _-]{1,30}):\s*.+$/gm)) {
      const key = match[1].trim().toLowerCase().replace(/[ _-]+/g, '_');
      const previous = seen.get(key);
      if (previous && previous !== part) duplicates.push({ key, parts: [previous, part] });
      else seen.set(key, part);
    }
  }
  return duplicates;
}

export function validateResponse(response, profileDocument) {
  const errors = [];
  const warnings = [];
  const profile = response?.profile;
  const sections = response?.sections;
  const definition = profileDocument?.profiles?.[profile];
  if (!definition) return { ok: false, errors: [`Unknown response profile ${profile ?? '<missing>'}`], warnings };
  if (!sections || typeof sections !== 'object' || Array.isArray(sections)) return { ok: false, errors: ['Response sections must be an object'], warnings };

  const names = Object.keys(sections);
  for (const required of definition.required_sections ?? []) {
    if (!names.includes(required) || !String(sections[required]).trim()) errors.push(`${profile}: missing section ${required}`);
  }
  if (definition.allowed_sections) {
    for (const name of names) if (!definition.allowed_sections.includes(name)) errors.push(`${profile}: section ${name} is not allowed`);
  }

  const words = countWords(Object.values(sections).join(' '));
  if (definition.max_words && words > definition.max_words) errors.push(`${profile}: ${words} words exceeds flexible maximum ${definition.max_words}`);
  if (profile === 'HANDOFF') {
    for (const section of handoffSelectionSections) {
      const message = `HANDOFF: missing section ${section}`;
      if ((!names.includes(section) || !String(sections[section]).trim()) && !errors.includes(message)) errors.push(message);
    }
    const preambleLines = String(sections.PREAMBLE ?? '').split('\n').filter((line) => line.trim()).length;
    const instructionLines = String(sections.INSTRUCTION ?? '').split('\n').filter((line) => line.trim()).length;
    if (preambleLines > definition.max_preamble_lines) errors.push(`HANDOFF: ${preambleLines} preamble lines exceeds ${definition.max_preamble_lines}`);
    if (instructionLines > definition.max_instruction_lines) errors.push(`HANDOFF: ${instructionLines} instruction lines exceeds flexible maximum ${definition.max_instruction_lines}`);
  }
  if (profile === 'FULL_ARTIFACT' && definition.explicit_request_required && response.explicit_request !== true) {
    errors.push('FULL_ARTIFACT requires explicit_request=true');
  }

  const informationDuplicates = detectDuplicateInformation(sections);
  const metadataDuplicates = detectDuplicateMetadata(sections);
  for (const duplicate of informationDuplicates) errors.push(`Duplicate information across ${duplicate.parts.join(' and ')}: ${duplicate.unit}`);
  for (const duplicate of metadataDuplicates) errors.push(`Duplicate metadata ${duplicate.key} across ${duplicate.parts.join(' and ')}`);
  return { ok: errors.length === 0, errors, warnings, profile, words, informationDuplicates, metadataDuplicates };
}

async function loadNormativeEntries(root) {
  const entries = [];
  for (const directory of ['core', 'policies', 'contracts', 'skills']) {
    for (const path of await walk(resolve(root, directory))) {
      if (!/\.(md|yaml)$/.test(path)) continue;
      entries.push({ path: relative(root, path).split(sep).join('/'), text: await readText(path) });
    }
  }
  return entries;
}

function validateAdapterBase(name, document, errors) {
  if (document.version !== 1) errors.push(`${name}: version must be 1`);
  if (document.adapter !== name) errors.push(`${name}: adapter id mismatch`);
  if (document.core_semantics !== 'PRESERVE') errors.push(`${name}: core_semantics must be PRESERVE`);
  if (document.workflow_source !== '../../core/workflow.yaml') errors.push(`${name}: workflow_source must reference canonical core`);
  if (document.selection_contract !== selectionContract) errors.push(`${name}: selection_contract must reference the canonical execution selection schema`);
  for (const key of Object.keys(document)) if (forbiddenSemanticKeys.has(key)) errors.push(`${name}: adapter cannot redefine ${key}`);
}

function validateModelMap(name, document, errors) {
  const mappings = document?.mappings;
  if (!Array.isArray(mappings) || mappings.length === 0) {
    errors.push(`${name}: model mappings are required`);
    return 0;
  }
  const capabilities = new Set();
  for (const [index, mapping] of mappings.entries()) {
    const prefix = `${name}: mapping ${index}`;
    if (!mapping.capability || capabilities.has(mapping.capability)) errors.push(`${prefix}: capability must be present and unique`);
    capabilities.add(mapping.capability);
    if (!Array.isArray(mapping.minimum_capabilities) || mapping.minimum_capabilities.length === 0) errors.push(`${prefix}: minimum_capabilities required`);
    if (!allowedEfforts.has(mapping.effort)) errors.push(`${prefix}: unsupported effort ${mapping.effort}`);
    if (!mapping.preferred_model || !mapping.fallback_model) errors.push(`${prefix}: preferred_model and fallback_model required`);
    if (mapping.preferred_model === mapping.fallback_model) errors.push(`${prefix}: fallback must differ from preferred model`);
    for (const [field, value] of [['preferred_model', mapping.preferred_model], ['fallback_model', mapping.fallback_model]]) {
      if (value && scanToolCoupling([{ path: `adapters/${name}/model-map.yaml`, text: value }]).length === 0) errors.push(`${prefix}: ${field} must resolve a concrete runtime model name`);
    }
  }
  return mappings.length;
}

export async function validateAdapters(root = frameworkRoot) {
  const errors = [];
  const warnings = [];
  const documents = {};
  let modelMappings = 0;
  for (const name of expectedAdapters) {
    try {
      const document = await readYaml(resolve(root, 'adapters', name, 'adapter.yaml'));
      documents[name] = document;
      validateAdapterBase(name, document, errors);
      await access(resolve(root, 'adapters', name, document.workflow_source));
      await access(resolve(root, 'adapters', name, document.selection_contract));
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }

  try {
    const profiles = await readYaml(resolve(root, 'adapters/chatgpt/response-profiles.yaml'));
    if (profiles.default_profile !== 'DELTA') errors.push('chatgpt: DELTA must be the default profile');
    const actual = Object.keys(profiles.profiles ?? {}).sort();
    const expected = [...responseProfileNames].sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) errors.push('chatgpt: response profile set mismatch');
    if (profiles.profiles?.DELTA?.target_words !== 300 || profiles.profiles?.DELTA?.max_words !== 360) errors.push('chatgpt: DELTA budget must target 300 words with 20% tolerance');
    if (profiles.profiles?.HANDOFF?.max_preamble_lines !== 4 || profiles.profiles?.HANDOFF?.target_instruction_lines !== 30 || profiles.profiles?.HANDOFF?.max_instruction_lines !== 36) errors.push('chatgpt: HANDOFF budgets are invalid');
    const handoffRequired = profiles.profiles?.HANDOFF?.required_sections ?? [];
    for (const section of handoffSelectionSections) if (!handoffRequired.includes(section)) errors.push(`chatgpt: HANDOFF must require ${section}`);
    const reviewSections = profiles.profiles?.REVIEW?.allowed_sections ?? [];
    if (JSON.stringify(reviewSections) !== JSON.stringify(['DECISION', 'FINDINGS', 'MISSING_EVIDENCE', 'NEXT_PHASE'])) errors.push('chatgpt: REVIEW sections are invalid');
    const instructions = await readText(resolve(root, 'adapters/chatgpt/ProjectInstructions.md'));
    for (const heading of ['Mission', 'Precedence', 'Roles and authority', 'Routing', 'Response economy', 'Profiles', 'Status']) {
      if (!instructions.includes(`## ${heading}`)) errors.push(`chatgpt: ProjectInstructions missing ${heading}`);
    }
  } catch (error) {
    errors.push(`chatgpt: ${error.message}`);
  }

  for (const name of ['codex', 'claude']) {
    try { modelMappings += validateModelMap(name, await readYaml(resolve(root, 'adapters', name, 'model-map.yaml')), errors); }
    catch (error) { errors.push(`${name}: ${error.message}`); }
  }

  const kiro = documents.kiro;
  if (kiro) {
    if (kiro.agent !== 'Default') errors.push('kiro: agent must always be Default');
    if (kiro.skills_portable !== true) errors.push('kiro: Skills must remain portable');
    if (kiro.canonical_project_root !== '.agentic') errors.push('kiro: .agentic must be canonical');
    if (kiro.compatibility?.root !== '.kiro' || kiro.compatibility?.normative !== false) errors.push('kiro: .kiro must be non-normative compatibility only');
  }

  errors.push(...scanToolCoupling(await loadNormativeEntries(root)));
  return { ok: errors.length === 0, errors, warnings, adapterCount: Object.keys(documents).length, modelMappings };
}

export async function validateHandoff(response, root = frameworkRoot) {
  const profiles = await readYaml(resolve(root, 'adapters/chatgpt/response-profiles.yaml'));
  return validateResponse(response, profiles);
}

export async function readResponseSnapshot(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
