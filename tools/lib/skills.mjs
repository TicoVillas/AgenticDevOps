import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { parseSkillFrontmatter } from './context-loader.mjs';
import { frameworkRoot, containedPath, readText, readYaml } from './io.mjs';

export const expectedSkillSlugs = Object.freeze([
  'workflow-bootstrap', 'low-level-discovery', 'quick-spec', 'spec', 'bug-fix',
  'contract-review', 'execute-contract', 'validate-delivery', 'correct-from-validation', 'delivery-closeout',
]);

const requiredSections = ['When to use', 'Inputs', 'Procedure', 'Limits', 'Outputs', 'Interruption', 'Next phase'];

export function renderGeneratedSkill(slug, canonicalText) {
  return `<!-- GENERATED FROM skills/${slug}/SKILL.md; DO NOT EDIT -->\n\n${canonicalText}`;
}

export function validateSkillText(slug, text) {
  const errors = [];
  const warnings = [];
  let metadata;
  try { metadata = parseSkillFrontmatter(text); }
  catch (error) { errors.push(`${slug}: ${error.message}`); return { errors, warnings, metadata: null }; }
  if (metadata.name !== slug) errors.push(`${slug}: frontmatter name mismatch`);
  if (!Object.hasOwn(metadata, 'description')) errors.push(`${slug}: description is required`);
  else if (typeof metadata.description !== 'string') errors.push(`${slug}: description must be a string`);
  else if (metadata.description.trim().length === 0) errors.push(`${slug}: description must not be empty`);
  else if (metadata.description.length > 1024) errors.push(`${slug}: description must be at most 1024 characters`);
  if (metadata.version !== '3.0.0') errors.push(`${slug}: version must be 3.0.0`);
  if (!metadata.role || !metadata.phase) errors.push(`${slug}: role and phase are required`);
  if (!metadata.references || !Object.keys(metadata.references).length) errors.push(`${slug}: at least one conditional reference is required`);
  for (const section of requiredSections) if (!new RegExp(`^## ${section}$`, 'm').test(text)) errors.push(`${slug}: missing section ${section}`);
  const lines = text.split('\n').length;
  if (lines > 500) warnings.push(`${slug}: ${lines} lines exceeds approximately 500`);
  return { errors, warnings, metadata, lines };
}

export function verifyGeneratedSkill(slug, canonicalText, generatedText) {
  return generatedText === renderGeneratedSkill(slug, canonicalText);
}

export async function generateSkills(root = frameworkRoot) {
  const outputDirectory = resolve(root, 'generated/skills');
  await mkdir(outputDirectory, { recursive: true });
  const generated = [];
  for (const slug of expectedSkillSlugs) {
    const canonical = await readText(resolve(root, 'skills', slug, 'SKILL.md'));
    const destination = resolve(outputDirectory, `${slug}.md`);
    await writeFile(destination, renderGeneratedSkill(slug, canonical), 'utf8');
    generated.push(relative(root, destination).split(sep).join('/'));
  }
  return generated;
}

export async function validateSkills(root = frameworkRoot) {
  const errors = [];
  const warnings = [];
  const details = [];
  const skillRoot = resolve(root, 'skills');
  const actual = (await readdir(skillRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  for (const slug of actual) if (!expectedSkillSlugs.includes(slug)) errors.push(`Unexpected manual Skill directory ${slug}`);
  for (const slug of expectedSkillSlugs) {
    const skillPath = resolve(skillRoot, slug, 'SKILL.md');
    let canonical;
    try { canonical = await readText(skillPath); }
    catch { errors.push(`Missing canonical Skill ${slug}`); continue; }
    const checked = validateSkillText(slug, canonical);
    errors.push(...checked.errors);
    warnings.push(...checked.warnings);
    if (checked.metadata) {
      for (const [key, reference] of Object.entries(checked.metadata.references ?? {})) {
        try { await access(containedPath(dirname(skillPath), reference)); }
        catch { errors.push(`${slug}: broken conditional reference ${key} -> ${reference}`); }
      }
    }
    for (const match of canonical.matchAll(/\]\(([^)]+)\)/g)) {
      const link = match[1];
      if (/^(?:https?:|#)/.test(link)) continue;
      try { await access(resolve(dirname(skillPath), link)); }
      catch { errors.push(`${slug}: broken link ${link}`); }
    }
    const generatedPath = resolve(root, 'generated/skills', `${slug}.md`);
    try {
      const generated = await readFile(generatedPath, 'utf8');
      if (!verifyGeneratedSkill(slug, canonical, generated)) errors.push(`${slug}: generated format drift`);
    } catch {
      errors.push(`${slug}: generated format missing`);
    }
    details.push({ slug, lines: checked.lines ?? 0, references: Object.keys(checked.metadata?.references ?? {}).length });
  }
  const workflow = await readYaml(resolve(root, 'core/workflow.yaml'));
  const workflowSkills = workflow.phases.map((phase) => phase.skill).filter(Boolean);
  for (const slug of expectedSkillSlugs) if (!workflowSkills.includes(slug)) errors.push(`${slug}: not referenced by workflow`);
  return { ok: errors.length === 0, errors, warnings, count: details.length, details };
}
