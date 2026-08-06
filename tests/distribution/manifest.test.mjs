import test from 'node:test';
import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import YAML from 'yaml';
import { validateBySchemaId } from '../../tools/lib/schema.mjs';

const frameworkRoot = new URL('../../', import.meta.url);
const manifestPath = new URL('adapters/kiro/distribution-manifest.yaml', frameworkRoot);
const lockPath = new URL('framework.lock', frameworkRoot);

const SUPPORT = [
  ['core-workflow-router', 'core/WorkflowRouter.md'],
  ['core-roles', 'core/roles.yaml'],
  ['core-statuses', 'core/statuses.yaml'],
  ['core-workflow-core', 'core/workflow-core.md'],
  ['core-workflow', 'core/workflow.yaml'],
  ['policy-capability', 'policies/CapabilitySelectionPolicy.md'],
  ['policy-context', 'policies/ContextPolicy.md'],
  ['policy-environment', 'policies/ExecutionEnvironmentPolicy.md'],
  ['policy-git', 'policies/GitSafetyPolicy.md'],
  ['policy-high-risk', 'policies/HighRiskOverlay.md'],
  ['policy-security', 'policies/SecureDevelopmentPolicy.md'],
  ['policy-profile-matrix', 'policies/application-profile-matrix.yaml'],
  ['policy-dry-run', 'policies/dry-run-rules.yaml'],
  ['policy-ownership', 'policies/ownership.yaml'],
  ['policy-security-outcomes', 'policies/security-outcomes.yaml'],
  ['contract-artifact', 'contracts/ArtifactContract.md'],
  ['contract-evidence', 'contracts/EvidenceAndFeedbackContract.md'],
  ['schema-profile-override', 'contracts/schemas/application-profile.override.schema.yaml'],
  ['schema-profile', 'contracts/schemas/application-profile.schema.yaml'],
  ['schema-artifact', 'contracts/schemas/artifact.schema.yaml'],
  ['schema-core-roles', 'contracts/schemas/core/roles.schema.yaml'],
  ['schema-core-statuses', 'contracts/schemas/core/statuses.schema.yaml'],
  ['schema-core-workflow', 'contracts/schemas/core/workflow.schema.yaml'],
  ['schema-design', 'contracts/schemas/design.schema.yaml'],
  ['schema-dry-run', 'contracts/schemas/dry-run-manifest.schema.yaml'],
  ['schema-evidence-envelope', 'contracts/schemas/evidence-envelope.schema.yaml'],
  ['schema-evidence', 'contracts/schemas/evidence.schema.yaml'],
  ['schema-execution-brief', 'contracts/schemas/execution-brief.schema.yaml'],
  ['schema-finding', 'contracts/schemas/finding.schema.yaml'],
  ['schema-requirements', 'contracts/schemas/requirements.schema.yaml'],
  ['schema-review', 'contracts/schemas/review.schema.yaml'],
  ['schema-tasks', 'contracts/schemas/tasks.schema.yaml'],
  ['schema-transition', 'contracts/schemas/transition-manifest.schema.yaml'],
  ['template-profile-override', 'contracts/templates/application-profile.override.yaml'],
  ['template-profile', 'contracts/templates/application-profile.yaml'],
  ['template-artifact', 'contracts/templates/artifact.yaml'],
  ['template-dry-run', 'contracts/templates/dry-run-manifest.yaml'],
  ['template-evidence-envelope', 'contracts/templates/evidence-envelope.yaml'],
  ['template-finding', 'contracts/templates/finding.yaml'],
  ['template-transition', 'contracts/templates/transition-manifest.yaml'],
];

const SKILLS = [
  ['skill-bug-fix-ref', 'skills/bug-fix/references/causality.md', 'SKILL_REFERENCE'],
  ['skill-bug-fix', 'skills/bug-fix/SKILL.md', 'SKILL'],
  ['skill-contract-review-ref', 'skills/contract-review/references/ledger.md', 'SKILL_REFERENCE'],
  ['skill-contract-review', 'skills/contract-review/SKILL.md', 'SKILL'],
  ['skill-correction-ref', 'skills/correct-from-validation/references/correction.md', 'SKILL_REFERENCE'],
  ['skill-correction', 'skills/correct-from-validation/SKILL.md', 'SKILL'],
  ['skill-closeout-ref', 'skills/delivery-closeout/references/remote.md', 'SKILL_REFERENCE'],
  ['skill-closeout', 'skills/delivery-closeout/SKILL.md', 'SKILL'],
  ['skill-execute-ref', 'skills/execute-contract/references/checkpoints.md', 'SKILL_REFERENCE'],
  ['skill-execute', 'skills/execute-contract/SKILL.md', 'SKILL'],
  ['skill-discovery-ref', 'skills/low-level-discovery/references/investigation.md', 'SKILL_REFERENCE'],
  ['skill-discovery', 'skills/low-level-discovery/SKILL.md', 'SKILL'],
  ['skill-quick-spec-ref', 'skills/quick-spec/references/proportionality.md', 'SKILL_REFERENCE'],
  ['skill-quick-spec', 'skills/quick-spec/SKILL.md', 'SKILL'],
  ['skill-spec-ref', 'skills/spec/references/architecture.md', 'SKILL_REFERENCE'],
  ['skill-spec', 'skills/spec/SKILL.md', 'SKILL'],
  ['skill-validation-ref', 'skills/validate-delivery/references/evidence.md', 'SKILL_REFERENCE'],
  ['skill-validation', 'skills/validate-delivery/SKILL.md', 'SKILL'],
  ['skill-bootstrap-ref', 'skills/workflow-bootstrap/references/migration.md', 'SKILL_REFERENCE'],
  ['skill-bootstrap', 'skills/workflow-bootstrap/SKILL.md', 'SELF_UPDATE'],
];

const ADAPTERS = [
  ['adapter-kiro', 'adapters/kiro/adapter.yaml', 'adapters/kiro/adapter.yaml', 'ADAPTER'],
  ['adapter-kiro-lifecycle', 'adapters/kiro/compatibility-lifecycle.yaml', 'adapters/kiro/compatibility-lifecycle.yaml', 'ADAPTER'],
  ['adapter-kiro-router-alias', 'adapters/kiro/generated/DiscoveryRouter.md', 'adapters/kiro/generated/DiscoveryRouter.md', 'ADAPTER'],
  ['adapter-kiro-steering', 'adapters/kiro/generated/agentic-workflow.md', 'steering/agentic-workflow.md', 'ENTRYPOINT'],
];

const EXPECTED_MAP = [
  ...SUPPORT.map(([id, path]) => [id, path, path, 'SUPPORT']),
  ...SKILLS.map(([id, path, phase]) => [id, path, path, phase]),
  ...ADAPTERS,
];

const LEGACY_PATHS = [
  'steering/workflow-core.md',
  'steering/contracts/ArtifactContract.md',
  'steering/contracts/ContextPolicy.md',
  'steering/contracts/EvidenceAndFeedbackContract.md',
  'steering/contracts/ExecutionEnvironmentPolicy.md',
  'steering/contracts/GitSafetyPolicy.md',
  'steering/contracts/HighRiskOverlay.md',
  'steering/contracts/ModelSelectionPolicy.md',
  'steering/contracts/SecureDevelopmentPolicy.md',
];

async function loadInputs() {
  const [manifestText, lockText] = await Promise.all([
    readFile(manifestPath, 'utf8'),
    readFile(lockPath, 'utf8'),
  ]);
  return { manifest: YAML.parse(manifestText), lock: JSON.parse(lockText) };
}

function topologicalOrder(items) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const indegree = new Map(items.map((item) => [item.id, item.depends_on.length]));
  const dependents = new Map(items.map((item) => [item.id, []]));
  for (const item of items) {
    for (const dependency of item.depends_on) {
      assert.ok(byId.has(dependency), `unknown dependency ${dependency} from ${item.id}`);
      dependents.get(dependency).push(item.id);
    }
  }
  const ready = [...items.filter((item) => indegree.get(item.id) === 0).map((item) => item.id)].sort();
  const ordered = [];
  while (ready.length > 0) {
    const id = ready.shift();
    ordered.push(id);
    for (const dependent of dependents.get(id).sort()) {
      indegree.set(dependent, indegree.get(dependent) - 1);
      if (indegree.get(dependent) === 0) ready.push(dependent);
    }
    ready.sort();
  }
  assert.equal(ordered.length, items.length, 'managed dependency graph must be acyclic');
  return ordered;
}

test('Kiro distribution manifest is structurally valid', async () => {
  const { manifest } = await loadInputs();
  const result = await validateBySchemaId(manifest, 'urn:agentic-devops:distribution-manifest:3.0');
  assert.equal(result.ok, true, result.errors.join('\n'));
});

test('source catalog covers every currently locked source with exact hashes', async () => {
  const { manifest, lock } = await loadInputs();
  const byPath = new Map(manifest.source_catalog.map((source) => [source.path, source]));
  assert.equal(byPath.size, manifest.source_catalog.length, 'source paths must be unique');
  assert.equal(new Set(manifest.source_catalog.map((source) => source.id)).size, manifest.source_catalog.length, 'source IDs must be unique');

  for (const [path, sha256] of Object.entries(lock.files)) {
    const source = byPath.get(path);
    assert.ok(source, `locked source is not cataloged: ${path}`);
    if (path === 'adapters/kiro/distribution-manifest.yaml') {
      assert.equal(source.hash_mode, 'FRAMEWORK_LOCK_EXTERNAL');
      assert.equal(Object.hasOwn(source, 'sha256'), false);
      continue;
    }
    assert.equal(source.hash_mode, 'LOCKED_SHA256', `unexpected hash mode for ${path}`);
    assert.equal(source.sha256, sha256, `catalog/lock hash mismatch for ${path}`);
  }

  const self = byPath.get('adapters/kiro/distribution-manifest.yaml');
  assert.equal(self.hash_mode, 'FRAMEWORK_LOCK_EXTERNAL');
  assert.equal(Object.hasOwn(self, 'sha256'), false);

  for (const path of [
    'contracts/schemas/distribution-manifest.schema.yaml',
    'contracts/schemas/distribution-backup-manifest.schema.yaml',
    'contracts/schemas/installation-journal.schema.yaml',
    'contracts/schemas/installation-receipt.schema.yaml',
  ]) assert.equal(byPath.get(path)?.class, 'SOURCE_ONLY');
  assert.equal(byPath.get('tests/distribution/contracts.test.mjs')?.class, 'BUILD_TEST_ONLY');
});

test('managed map matches the binding 5+10+25+20+3+1 inventory', async () => {
  const { manifest } = await loadInputs();
  const sources = new Map(manifest.source_catalog.map((source) => [source.id, source]));
  const actual = manifest.managed_items.map((item) => {
    const source = sources.get(item.source_id);
    assert.ok(source, `managed item references missing source: ${item.id}`);
    assert.ok(['GLOBAL_KIRO_MANAGED', 'GENERATED_PACKAGE_CONTENT'].includes(source.class), `${item.id} uses non-installable class ${source.class}`);
    return [item.id, source.path, item.destination, item.apply_phase];
  });

  assert.equal(actual.length, 64);
  assert.deepEqual(actual, EXPECTED_MAP);
  assert.equal(SUPPORT.slice(0, 5).length, 5);
  assert.equal(SUPPORT.slice(5, 15).length, 10);
  assert.equal(SUPPORT.slice(15).length, 25);
  assert.equal(SKILLS.length, 20);
  assert.equal(ADAPTERS.slice(0, 3).length, 3);
  assert.equal(ADAPTERS.slice(3).length, 1);
  assert.equal(new Set(manifest.managed_items.map((item) => item.id)).size, 64);
  assert.equal(new Set(manifest.managed_items.map((item) => item.destination)).size, 64);
  assert.ok(manifest.managed_items.every((item) => item.owner === 'INSTALLING_USER' && item.group === 'INSTALLING_PRIMARY_GROUP' && item.mode === '0644'));
  assert.equal(manifest.operation.directory_mode, '0755');
});

test('non-Kiro adapters and control-plane sources have no global destination', async () => {
  const { manifest } = await loadInputs();
  const managedSources = new Set(manifest.managed_items.map((item) => item.source_id));
  for (const source of manifest.source_catalog) {
    if (source.path.startsWith('adapters/chatgpt/') || source.path.startsWith('adapters/claude/') || source.path.startsWith('adapters/codex/')) {
      assert.equal(managedSources.has(source.id), false, source.path);
    }
    if (['SOURCE_ONLY', 'PROJECT_TEMPLATE', 'BUILD_TEST_ONLY'].includes(source.class)) {
      assert.equal(managedSources.has(source.id), false, source.path);
    }
  }
});

test('manifest declares the exact nine baseline-only retirements', async () => {
  const { manifest } = await loadInputs();
  assert.deepEqual(manifest.legacy_retirements.map((item) => item.path), LEGACY_PATHS);
  assert.ok(manifest.legacy_retirements.every((item) => /^[a-f0-9]{64}$/.test(item.baseline_sha256)));
  assert.ok(manifest.legacy_retirements.every((item) => item.required_state === 'LEGACY_ACTIVE_CONFLICT' && item.backup_required && item.remove_only_if_exact));
});

test('workflow-bootstrap is the only self-update and is topologically last', async () => {
  const { manifest } = await loadInputs();
  const selfUpdates = manifest.managed_items.filter((item) => item.self_update);
  assert.deepEqual(selfUpdates.map((item) => [item.id, item.source_id, item.apply_phase]), [
    ['skill-bootstrap', 'skill-bootstrap', 'SELF_UPDATE'],
  ]);
  assert.equal(manifest.operation.self_update_item, 'skill-bootstrap');
  const ordered = topologicalOrder(manifest.managed_items);
  assert.equal(ordered.at(-1), 'skill-bootstrap');
  assert.equal(manifest.managed_items.filter((item) => item.loader_role === 'STEERING_ENTRYPOINT').length, 1);
});


test('CR-GBL-002: staged layout contains all 25 contracts and resolves progressive-loading references', async () => {
  const { manifest } = await loadInputs();
  const stagedRoot = await mkdtemp(resolve(tmpdir(), 'distribution-staged-layout-'));
  try {
    const sourceById = new Map(manifest.source_catalog.map((source) => [source.id, source]));
    for (const item of manifest.managed_items) {
      const source = sourceById.get(item.source_id);
      assert.ok(source, `missing source for ${item.id}`);
      const destination = resolve(stagedRoot, item.destination);
      const rel = relative(stagedRoot, destination);
      assert.ok(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), `destination escapes staged root: ${item.destination}`);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, await readFile(new URL(source.path, frameworkRoot)));
    }

    const contractSources = manifest.source_catalog.filter((source) => source.class === 'GLOBAL_KIRO_MANAGED' && source.path.startsWith('contracts/'));
    assert.equal(contractSources.length, 25, 'the approved global contract inventory must remain exactly 25');
    for (const source of contractSources) {
      const items = manifest.managed_items.filter((item) => item.source_id === source.id);
      assert.equal(items.length, 1, `global contract source must have exactly one destination: ${source.path}`);
      assert.equal(items[0].destination, source.path, `global contract destination drift: ${source.path}`);
      assert.equal((await lstat(resolve(stagedRoot, items[0].destination))).isFile(), true, `staged contract missing: ${source.path}`);
    }

    const progressiveDocuments = manifest.managed_items.filter((item) => item.destination === 'steering/agentic-workflow.md' || /^skills\/.*\.md$/.test(item.destination));
    let resolvedReferences = 0;
    for (const item of progressiveDocuments) {
      const documentPath = resolve(stagedRoot, item.destination);
      const text = await readFile(documentPath, 'utf8');
      const references = [
        ...[...text.matchAll(/\]\(([^)]+)\)/g)].map((match) => match[1]),
        ...[...text.matchAll(/^\s{2}[a-z][a-z0-9_-]*:\s+([^\s#]+\.(?:md|ya?ml))\s*$/gim)].map((match) => match[1]),
      ];
      for (const rawReference of references) {
        const reference = rawReference.split('#', 1)[0];
        if (!reference || reference.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(reference)) continue;
        assert.equal(isAbsolute(reference), false, `absolute progressive-loading reference in ${item.destination}: ${reference}`);
        const target = resolve(dirname(documentPath), reference);
        const rel = relative(stagedRoot, target);
        assert.ok(rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), `reference escapes staged root: ${item.destination} -> ${reference}`);
        await lstat(target);
        resolvedReferences += 1;
      }
    }
    assert.ok(resolvedReferences >= 20, `expected progressive-loading references to resolve, received ${resolvedReferences}`);
  } finally {
    await rm(stagedRoot, { recursive: true, force: true });
  }
});

test('distribution filesystem tests use tmp roots and contain no literal real-global destination', async () => {
  const testRoot = new URL('./', import.meta.url);
  const testFiles = (await readdir(testRoot)).filter((name) => name.endsWith('.test.mjs'));
  const forbidden = [
    ['/home', 'villas', '.kiro'].join('/'),
    ['$HOME', '.kiro'].join('/'),
    ['~', '.kiro'].join('/'),
  ];
  for (const name of testFiles) {
    const source = await readFile(new URL(name, testRoot), 'utf8');
    for (const literal of forbidden) assert.equal(source.includes(literal), false, `${name} contains forbidden real-global literal`);
    if (/\b(?:mkdtemp|writeFile|mkdir|symlink|chmod|unlink)\s*\(/.test(source)) {
      assert.match(source, /tmpdir\(\)/, `${name} performs filesystem mutation without a tmpdir-based sandbox`);
    }
  }
});