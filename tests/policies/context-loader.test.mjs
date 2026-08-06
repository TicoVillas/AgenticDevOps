import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadProgressiveContext } from '../../tools/lib/context-loader.mjs';

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'context-loader-'));
  await mkdir(join(root, 'references'));
  await writeFile(join(root, 'metadata.yaml'), 'phase: spec\nauthorization: plan\n');
  await writeFile(join(root, 'SKILL.md'), '---\nname: sample\nreferences:\n  risk: references/risk.md\n  unused: references/unused.md\n---\n# Sample\n');
  await writeFile(join(root, 'references/risk.md'), 'requested risk context\n');
  await writeFile(join(root, 'references/unused.md'), 'must not load\n');
  return root;
}

test('ACC-016 loads metadata, Skill, then only requested references', async () => {
  const root = await fixture();
  const reads = [];
  try {
    const result = await loadProgressiveContext({
      metadataPath: join(root, 'metadata.yaml'),
      skillPath: join(root, 'SKILL.md'),
      requestedReferenceKeys: ['risk'],
      reader: async (path) => { reads.push(path); return (await import('node:fs/promises')).readFile(path, 'utf8'); },
    });
    assert.deepEqual(result.events.map(({ stage }) => stage), ['metadata', 'skill', 'reference']);
    assert.deepEqual(Object.keys(result.references), ['risk']);
    assert.equal(reads.some((path) => path.endsWith('unused.md')), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('ACC-016 rejects a reference not declared by the applicable Skill', async () => {
  const root = await fixture();
  try {
    await assert.rejects(() => loadProgressiveContext({
      metadataPath: join(root, 'metadata.yaml'),
      skillPath: join(root, 'SKILL.md'),
      requestedReferenceKeys: ['undeclared'],
    }), /not declared/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
