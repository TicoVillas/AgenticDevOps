import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  generateKiroSteering,
  KIRO_STEERING_OUTPUT,
  KIRO_STEERING_TEMPLATE,
  renderKiroSteering,
} from '../../tools/lib/distribution.mjs';
import { frameworkRoot } from '../../tools/lib/io.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');

async function withSyntheticFramework(callback) {
  const root = await mkdtemp(resolve(tmpdir(), 'agentic-workflow-steering-'));
  try {
    const template = await readFile(resolve(frameworkRoot, KIRO_STEERING_TEMPLATE), 'utf8');
    const templatePath = resolve(root, KIRO_STEERING_TEMPLATE);
    await mkdir(dirname(templatePath), { recursive: true });
    await writeFile(templatePath, template, 'utf8');
    for (const path of ['core/WorkflowRouter.md', 'skills/spec/SKILL.md']) {
      const target = resolve(root, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, '# staged fixture\n', 'utf8');
    }
    return await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('steering render is deterministic, thin and always included', async () => {
  const template = await readFile(resolve(frameworkRoot, KIRO_STEERING_TEMPLATE), 'utf8');
  const first = renderKiroSteering(template);
  const second = renderKiroSteering(template);
  assert.equal(first, second);
  assert.equal(digest(first), digest(second));
  assert.match(first, /^---\ninclusion: always\n---\n/);
  assert.match(first, /DO NOT EDIT/);
  assert.match(first, /\.\.\/core\/WorkflowRouter\.md/);
  assert.match(first, /\.\.\/skills\//);
  assert.equal(first.endsWith('\n'), true);
  assert.equal(first.endsWith('\n\n'), false);
  assert.equal(first.length < 500, true);
  assert.doesNotMatch(first, /\/home\/|[A-Z]:\\|20\d{2}-\d{2}-\d{2}T/);
});

test('generated steering equals the canonical render', async () => {
  const [template, generated] = await Promise.all([
    readFile(resolve(frameworkRoot, KIRO_STEERING_TEMPLATE), 'utf8'),
    readFile(resolve(frameworkRoot, KIRO_STEERING_OUTPUT), 'utf8'),
  ]);
  assert.equal(generated, renderKiroSteering(template));
});

test('synthetic staged generation is byte-identical and references contained targets', async () => {
  await withSyntheticFramework(async (root) => {
    await generateKiroSteering(root);
    const first = await readFile(resolve(root, KIRO_STEERING_OUTPUT), 'utf8');
    await generateKiroSteering(root);
    const second = await readFile(resolve(root, KIRO_STEERING_OUTPUT), 'utf8');
    assert.equal(first, second);
    for (const reference of ['../core/WorkflowRouter.md', '../skills/']) {
      assert.equal(reference.startsWith('../'), true);
      assert.equal(resolve(dirname(resolve(root, 'steering/agentic-workflow.md')), reference).startsWith(root), true);
    }
  });
});

test('entrypoint does not duplicate normative workflow, policy, contract or Skill bodies', async () => {
  const generated = await readFile(resolve(frameworkRoot, KIRO_STEERING_OUTPUT), 'utf8');
  for (const forbidden of [
    '## Responsabilidades por fase',
    '## Contract Review inicial',
    '## Validação inicial',
    '## Git Safety',
    '## Secure Development',
    '## Artifact Contract',
    '<workflow-core>',
    '<user-rule',
  ]) assert.equal(generated.includes(forbidden), false, forbidden);
  assert.equal((generated.match(/^# /gm) ?? []).length, 1);
});

test('renderer rejects missing and unresolved inputs', async () => {
  const template = await readFile(resolve(frameworkRoot, KIRO_STEERING_TEMPLATE), 'utf8');
  assert.throws(() => renderKiroSteering(template, { CORE_ROUTER_REFERENCE: '', SKILLS_ROOT_REFERENCE: '../skills/' }), /Missing steering input/);
  assert.throws(() => renderKiroSteering(`${template}\n{{UNKNOWN_INPUT}}\n`), /Unresolved steering inputs/);
});
