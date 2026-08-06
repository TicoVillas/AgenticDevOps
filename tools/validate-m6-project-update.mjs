import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import YAML from 'yaml';
import { frameworkRoot, readYaml } from './lib/io.mjs';
import { backProjectProfileV2ToV1, forwardProjectProfileV1ToV2, loadProjectMigrationCatalog } from './lib/project-update/migrations.mjs';
import { validateM6ProjectUpdateReport } from './lib/project-update/m6-report.mjs';
import { formatAjvErrors, loadSchemaRegistry } from './lib/schema.mjs';
import { validateValidationBinding } from './lib/validation-bindings.mjs';

const MILESTONE = 'M6';
const contractNames = Object.freeze([
  'project-update-manifest', 'project-update-plan', 'project-update-journal', 'project-update-receipt', 'project-update-backup-manifest',
  'project-update-snapshot', 'project-update-checkpoint', 'project-update-authorization', 'project-update-migration',
]);
const runtimeFiles = Object.freeze([
  'tools/lib/project-update/paths.mjs', 'tools/lib/project-update/snapshot.mjs', 'tools/lib/project-update/planner.mjs',
  'tools/lib/project-update/authorization.mjs', 'tools/lib/project-update/engine.mjs', 'tools/lib/project-update/reconcile.mjs',
  'tools/lib/project-update/migrations.mjs',
]);
const testFiles = Object.freeze([
  'tests/project-update/harness.mjs', 'tests/project-update/paths-snapshot-planner.test.mjs',
  'tests/project-update/authorization-apply.test.mjs', 'tests/project-update/migration-rollback-isolation.test.mjs',
]);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function validateM6ProjectUpdate(root = frameworkRoot) {
  const errors = [];
  let ajv;
  try { ({ ajv } = await loadSchemaRegistry(root)); } catch (error) { errors.push(`schema-registry: ${error.message}`); }
  for (const name of contractNames) {
    try {
      const schema = await readYaml(resolve(root, 'contracts/schemas', `${name}.schema.yaml`));
      if (schema.$id !== `urn:agentic-devops:${name}:3.0`) errors.push(`${name}: unexpected schema ID`);
      if (schema.additionalProperties !== false) errors.push(`${name}: additionalProperties false required`);
      if (!ajv?.getSchema(schema.$id)) errors.push(`${name}: schema not compiled`);
    } catch (error) { errors.push(`${name}: ${error.message}`); }
  }
  for (const name of ['project-update-checkpoint', 'project-update-authorization']) {
    try {
      const document = await readYaml(resolve(root, 'contracts/templates', `${name}.yaml`));
      const validate = ajv?.getSchema(`urn:agentic-devops:${name}:3.0`);
      if (!validate || !validate(document)) errors.push(`${name}: template invalid: ${formatAjvErrors(validate?.errors).join('; ')}`);
    } catch (error) { errors.push(`${name}: template: ${error.message}`); }
  }

  const sources = new Map();
  for (const path of [...runtimeFiles, ...testFiles]) {
    try { sources.set(path, await readFile(resolve(root, path), 'utf8')); } catch (error) { errors.push(`${path}: ${error.message}`); }
  }
  for (const [path, source] of sources) {
    if (path.startsWith('tests/')) continue;
    for (const token of ['node:child_process', 'homedir(', 'process.env.HOME', 'execFile(', 'spawn(', 'fetch(']) if (source.includes(token)) errors.push(`${path}: forbidden boundary token ${token}`);
  }
  const engine = sources.get('tools/lib/project-update/engine.mjs') ?? '';
  for (const primitive of ['atomic-writer.mjs', 'state-store.mjs']) if (!engine.includes(primitive)) errors.push(`project engine must reuse M5 ${primitive}`);
  const paths = sources.get('tools/lib/project-update/paths.mjs') ?? '';
  if (!paths.includes("../lifecycle/paths.mjs")) errors.push('project paths must reuse M5 lifecycle paths');
  const authorization = sources.get('tools/lib/project-update/authorization.mjs') ?? '';
  if (!authorization.includes("../lifecycle/authorization.mjs")) errors.push('project authorization must reuse M5 authorization concepts');
  const reconcile = sources.get('tools/lib/project-update/reconcile.mjs') ?? '';
  if (!reconcile.includes("../lifecycle/reconcile.mjs")) errors.push('project reconcile must reuse M5 read-only reconcile');

  try {
    const loaded = await loadProjectMigrationCatalog({ fs: { readFile }, contractsRoot: resolve(root, 'contracts') });
    const descriptor = loaded.descriptors[0];
    const validate = ajv?.getSchema('urn:agentic-devops:project-update-migration:3.0');
    if (!validate || !validate(descriptor)) errors.push(`project migration descriptor invalid: ${formatAjvErrors(validate?.errors).join('; ')}`);
    const fixtureRoot = resolve(root, 'contracts/migrations/project-update/fixtures');
    const input = YAML.parse(await readFile(resolve(fixtureRoot, 'forward-input.yaml'), 'utf8'));
    const expected = YAML.parse(await readFile(resolve(fixtureRoot, 'forward-expected.yaml'), 'utf8'));
    const context = YAML.parse(await readFile(resolve(fixtureRoot, 'rollback-context.yaml'), 'utf8'));
    const forward = forwardProjectProfileV1ToV2(input);
    if (JSON.stringify(forward.document) !== JSON.stringify(expected) || JSON.stringify(forward.rollback_context) !== JSON.stringify(context)) errors.push('project migration fixture drift');
    if (JSON.stringify(backProjectProfileV2ToV1(forward.document, forward.rollback_context)) !== JSON.stringify(input)) errors.push('project migration rollback drift');
  } catch (error) { errors.push(`project migration: ${error.message}`); }

  const binding = await validateValidationBinding(root, { milestone: MILESTONE });
  errors.push(...binding.errors.map((error) => `validation-binding: ${error}`));
  const report = await validateM6ProjectUpdateReport(root);
  errors.push(...report.errors);
  return Object.freeze({
    ok: errors.length === 0,
    errors,
    contract_count: contractNames.length,
    runtime_file_count: runtimeFiles.length,
    test_file_count: testFiles.length,
    package_lock_sha256: binding.observed?.package_lock_sha256 ?? null,
    binding_context: binding.binding_context,
    binding_contract_version: binding.binding_contract_version,
    real_project_access_authorized: false,
    git_write_authorized: false,
    reconcile_read_only: true,
    receipt_namespaces_separate: true,
    tested_scope: 'synthetic only',
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const root = process.argv[2] ? resolve(process.argv[2]) : frameworkRoot;
  const result = await validateM6ProjectUpdate(root);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
