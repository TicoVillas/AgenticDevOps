import { frameworkRoot, walk, readYaml } from './io.mjs';
import { validateSchemaRegistry } from './schema.mjs';
import { migrationDescriptorNames, loadMigrationDescriptor } from './migrations.mjs';

const expectedSchemas = Object.freeze([
  'release-manifest', 'release-metadata', 'operation-plan', 'operation-lock', 'operation-tombstone', 'uninstall-manifest',
  'archive-provenance-manifest', 'platform-capability', 'evidence-index', 'project-update-manifest', 'project-update-plan',
  'project-update-journal', 'project-update-receipt', 'project-update-backup-manifest',
]);

export async function validateM2Contracts(root = frameworkRoot) {
  const errors = [];
  const registry = await validateSchemaRegistry(root);
  errors.push(...registry.errors);
  const schemas = (await walk(`${root}/contracts/schemas`)).filter((path) => path.endsWith('.schema.yaml'));
  const byId = new Map();
  for (const path of schemas) {
    const schema = await readYaml(path);
    if (schema.$id) byId.set(schema.$id, schema);
  }
  for (const name of expectedSchemas) {
    const id = `urn:agentic-devops:${name}:3.0`;
    const schema = byId.get(id);
    if (!schema) errors.push(`Missing M2 schema ${id}`);
    else {
      if (schema.$schema !== 'http://json-schema.org/draft-07/schema#') errors.push(`${id} must use draft-07`);
      if (schema.additionalProperties !== false) errors.push(`${id} must set additionalProperties false`);
    }
  }
  for (const name of migrationDescriptorNames) {
    try { await loadMigrationDescriptor(name, root); } catch (error) { errors.push(`${name}: ${error.message}`); }
  }
  return { ok: errors.length === 0, errors, schemaCount: expectedSchemas.length, migrationCount: migrationDescriptorNames.length };
}
