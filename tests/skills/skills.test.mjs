import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadProgressiveContext, parseSkillFrontmatter } from '../../tools/lib/context-loader.mjs';
import { frameworkRoot, readText } from '../../tools/lib/io.mjs';
import { expectedSkillSlugs, renderGeneratedSkill, validateSkillText, validateSkills, verifyGeneratedSkill } from '../../tools/lib/skills.mjs';

const requiredSections = ['When to use', 'Inputs', 'Procedure', 'Limits', 'Outputs', 'Interruption', 'Next phase'];

function validSkillText(description = 'Describes a sample capability when the sample workflow is required.') {
  return `---\nname: sample\ndescription: ${JSON.stringify(description)}\nversion: 3.0.0\nrole: ENGINEERING\nphase: sample\nreferences:\n  x: references/x.md\n---\n${requiredSections.map((section) => `## ${section}`).join('\n')}\n`;
}

function replaceDescription(text, replacement) {
  return text.replace(/^description:.*$/m, replacement);
}

function parseGeneratedFrontmatter(text) {
  const frontmatterOffset = text.indexOf('---\n');
  assert.notEqual(frontmatterOffset, -1);
  return parseSkillFrontmatter(text.slice(frontmatterOffset));
}

test('ten canonical Skills and generated formats are valid', async () => {
  const result = await validateSkills();
  assert.equal(result.ok, true, [...result.errors, ...result.warnings].join('\n'));
  assert.equal(result.count, 10);
  assert.equal(result.details.every(({ lines }) => lines < 500), true);
});

test('canonical and generated Skills expose loader-compatible name and description metadata', async () => {
  for (const slug of expectedSkillSlugs) {
    const canonical = await readText(resolve(frameworkRoot, 'skills', slug, 'SKILL.md'));
    const canonicalMetadata = parseSkillFrontmatter(canonical);
    assert.equal(canonicalMetadata.name, slug, `${slug}: name must match its directory`);
    assert.equal(typeof canonicalMetadata.description, 'string', `${slug}: description must be a string`);
    assert.notEqual(canonicalMetadata.description.trim(), '', `${slug}: description must not be empty`);
    assert.ok(canonicalMetadata.description.length <= 1024, `${slug}: description must be at most 1024 characters`);

    const generated = await readText(resolve(frameworkRoot, 'generated', 'skills', `${slug}.md`));
    const generatedMetadata = parseGeneratedFrontmatter(generated);
    assert.equal(generatedMetadata.name, canonicalMetadata.name, `${slug}: generated name drift`);
    assert.equal(generatedMetadata.description, canonicalMetadata.description, `${slug}: generated description drift`);
  }
});

test('description accepts a non-empty string up to 1024 characters', () => {
  for (const description of ['Valid when a sample capability is required.', 'x'.repeat(1024)]) {
    const result = validateSkillText('sample', validSkillText(description));
    assert.deepEqual(result.errors.filter((error) => error.includes('description')), []);
  }
});

test('description rejects missing, null, non-string, empty, whitespace-only, and oversized values', () => {
  const valid = validSkillText();
  const invalid = new Map([
    ['missing', valid.replace(/^description:.*\n/m, '')],
    ['null', replaceDescription(valid, 'description: null')],
    ['non-string', replaceDescription(valid, 'description: 42')],
    ['empty', replaceDescription(valid, 'description: ""')],
    ['whitespace-only', replaceDescription(valid, 'description: "   "')],
    ['oversized', replaceDescription(valid, `description: "${'x'.repeat(1025)}"`)],
  ]);
  for (const [name, text] of invalid) {
    const result = validateSkillText('sample', text);
    assert.ok(result.errors.some((error) => error.includes('description')), `${name} should fail description validation`);
  }
});

test('generated format is deterministic and manual drift fails', () => {
  const canonical = '---\nname: x\ndescription: Use x when x is required.\n---\n# X\n';
  const generated = renderGeneratedSkill('x', canonical);
  assert.equal(verifyGeneratedSkill('x', canonical, generated), true);
  assert.equal(verifyGeneratedSkill('x', canonical, `${generated}edited`), false);
});

test('line budget warns above approximately 500 lines', () => {
  const text = `${validSkillText()}${'line\n'.repeat(501)}`;
  assert.equal(validateSkillText('sample', text).warnings.length, 1);
});

test('ACC-016 applies progressive loading to every conditional reference pattern', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'skill-context-'));
  const metadataPath = join(temp, 'metadata.yaml');
  await writeFile(metadataPath, 'phase: test\nauthorization: read\n');
  try {
    for (const slug of expectedSkillSlugs) {
      const skillPath = resolve(frameworkRoot, 'skills', slug, 'SKILL.md');
      const frontmatter = parseSkillFrontmatter(await readText(skillPath));
      const key = Object.keys(frontmatter.references)[0];
      const loaded = await loadProgressiveContext({ metadataPath, skillPath, requestedReferenceKeys: [key] });
      assert.deepEqual(loaded.events.map(({ stage }) => stage), ['metadata', 'skill', 'reference'], slug);
      assert.deepEqual(Object.keys(loaded.references), [key], slug);
      const omitted = await loadProgressiveContext({ metadataPath, skillPath, requestedReferenceKeys: [] });
      assert.deepEqual(omitted.references, {}, slug);
    }
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
