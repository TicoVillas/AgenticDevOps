import { resolve } from 'node:path';
import YAML from 'yaml';
import { canonicalSha256 } from '../canonical-json.mjs';

const MIGRATION_ID = 'project-profile-v1-to-v2';

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function clone(value) {
  return structuredClone(value);
}

export function validateProjectMigrationDescriptor(descriptor) {
  const keys = Object.keys(descriptor ?? {}).sort();
  const expected = ['catalog_version', 'document_path', 'fixtures', 'from_version', 'id', 'implementation', 'owned_fields', 'preconditions', 'reversible', 'rollback_implementation', 'schema_version', 'to_version'].sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) fail('PROJECT_MIGRATION_DESCRIPTOR_SHAPE_INVALID');
  if (descriptor.schema_version !== 1 || descriptor.catalog_version !== 1 || descriptor.id !== MIGRATION_ID || descriptor.from_version !== 1 || descriptor.to_version !== 2) fail('PROJECT_MIGRATION_DESCRIPTOR_VERSION_INVALID');
  if (descriptor.document_path !== '.agentic/application-profile.yaml' || descriptor.reversible !== true) fail('PROJECT_MIGRATION_DESCRIPTOR_BOUNDARY_INVALID');
  if (JSON.stringify(descriptor.owned_fields) !== JSON.stringify(['controls.contextual'])) fail('PROJECT_MIGRATION_OWNERSHIP_INVALID');
  if (!Array.isArray(descriptor.preconditions) || !Array.isArray(descriptor.fixtures) || descriptor.fixtures.length !== 3) fail('PROJECT_MIGRATION_FIXTURES_INVALID');
  if (descriptor.implementation !== 'tools/lib/project-update/migrations.mjs#forwardProjectProfileV1ToV2' || descriptor.rollback_implementation !== 'tools/lib/project-update/migrations.mjs#backProjectProfileV2ToV1') fail('PROJECT_MIGRATION_IMPLEMENTATION_INVALID');
  return true;
}

export function forwardProjectProfileV1ToV2(document) {
  if (!document || typeof document !== 'object' || Array.isArray(document) || document.version !== 1 || !document.controls || typeof document.controls !== 'object' || Array.isArray(document.controls)) fail('PROJECT_MIGRATION_PRECONDITION_FAILED');
  const output = clone(document);
  const added = !Object.hasOwn(output.controls, 'contextual');
  if (added) output.controls.contextual = [];
  return Object.freeze({
    document: output,
    rollback_context: { migration_id: MIGRATION_ID, input_sha256: canonicalSha256(document), added_fields: added ? ['controls.contextual'] : [] },
  });
}

export function backProjectProfileV2ToV1(document, rollbackContext) {
  if (!document || typeof document !== 'object' || Array.isArray(document) || rollbackContext?.migration_id !== MIGRATION_ID || !Array.isArray(rollbackContext.added_fields)) fail('PROJECT_MIGRATION_ROLLBACK_CONTEXT_INVALID');
  const output = clone(document);
  for (const field of rollbackContext.added_fields) {
    if (field !== 'controls.contextual' || !Array.isArray(output.controls?.contextual) || output.controls.contextual.length !== 0) fail('PROJECT_MIGRATION_ROLLBACK_DIVERGED');
    delete output.controls.contextual;
  }
  if (canonicalSha256(output) !== rollbackContext.input_sha256) fail('PROJECT_MIGRATION_ROLLBACK_HASH_DIVERGED');
  return output;
}

export async function loadProjectMigrationCatalog({ fs, contractsRoot }) {
  const catalogPath = resolve(contractsRoot, 'migrations/project-update/catalog.yaml');
  const catalog = YAML.parse(await fs.readFile(catalogPath, 'utf8'));
  if (!catalog || catalog.schema_version !== 1 || catalog.catalog_version !== 1 || JSON.stringify(Object.keys(catalog).sort()) !== JSON.stringify(['catalog_version', 'migrations', 'schema_version'])) fail('PROJECT_MIGRATION_CATALOG_INVALID');
  if (!Array.isArray(catalog.migrations) || catalog.migrations.length !== 1 || catalog.migrations[0] !== 'project-profile-v1-to-v2.yaml') fail('PROJECT_MIGRATION_CATALOG_INVALID');
  const descriptor = YAML.parse(await fs.readFile(resolve(contractsRoot, 'migrations/project-update', catalog.migrations[0]), 'utf8'));
  validateProjectMigrationDescriptor(descriptor);
  return Object.freeze({ catalog, descriptors: [descriptor] });
}
