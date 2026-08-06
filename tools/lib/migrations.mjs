import { resolve } from 'node:path';
import { frameworkRoot, readYaml } from './io.mjs';
import { validateBySchemaId } from './schema.mjs';

const descriptorNames = Object.freeze(['artifact', 'transition', 'distribution', 'backup', 'journal', 'receipt', 'release-manifest']);
const supportedOps = new Set(['copy_context', 'copy_context_if_present', 'set_if_absent']);

function clone(value) {
  return structuredClone(value);
}

export async function loadMigrationDescriptor(name, root = frameworkRoot) {
  if (!descriptorNames.includes(name)) throw new Error(`UNKNOWN_MIGRATION:${name}`);
  const descriptor = await readYaml(resolve(root, 'contracts/migrations/v1', `${name}.yaml`));
  validateMigrationDescriptor(descriptor);
  return descriptor;
}

export function validateMigrationDescriptor(descriptor) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) throw new Error('INVALID_MIGRATION_DESCRIPTOR');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(descriptor.id ?? '')) throw new Error('INVALID_MIGRATION_ID');
  if (!/^urn:agentic-devops:[a-z0-9-]+:3\.0$/.test(descriptor.target_schema ?? '')) throw new Error('INVALID_MIGRATION_TARGET_SCHEMA');
  if (descriptor.from_version !== 1 || descriptor.to_version !== 1) throw new Error('UNSUPPORTED_MIGRATION_VERSION');
  if (!Array.isArray(descriptor.required_context) || !Array.isArray(descriptor.operations)) throw new Error('INVALID_MIGRATION_SHAPE');
  for (const operation of descriptor.operations) {
    if (!supportedOps.has(operation?.op) || typeof operation.field !== 'string' || operation.field.length === 0) throw new Error('UNSUPPORTED_MIGRATION_OPERATION');
    if (operation.op === 'set_if_absent' && !Object.hasOwn(operation, 'value')) throw new Error('MIGRATION_VALUE_REQUIRED');
  }
  return true;
}

export function applyMigration(document, descriptor, context = {}) {
  validateMigrationDescriptor(descriptor);
  if (!document || typeof document !== 'object' || Array.isArray(document)) throw new Error('MIGRATION_DOCUMENT_REQUIRED');
  if (document.schema_version !== descriptor.from_version && document.version !== descriptor.from_version) throw new Error('MIGRATION_VERSION_MISMATCH');
  for (const field of descriptor.required_context) {
    if (!Object.hasOwn(context, field)) throw new Error(`MIGRATION_CONTEXT_REQUIRED:${field}`);
    validateContextValue(field, context[field]);
  }
  const output = clone(document);
  for (const operation of descriptor.operations) {
    if (operation.op === 'set_if_absent') {
      if (!Object.hasOwn(output, operation.field)) output[operation.field] = clone(operation.value);
      continue;
    }
    if (operation.op === 'copy_context') {
      if (!Object.hasOwn(context, operation.field)) throw new Error(`MIGRATION_CONTEXT_REQUIRED:${operation.field}`);
      validateContextValue(operation.field, context[operation.field]);
      if (Object.hasOwn(output, operation.field) && JSON.stringify(output[operation.field]) !== JSON.stringify(context[operation.field])) throw new Error(`MIGRATION_CONTEXT_CONFLICT:${operation.field}`);
      if (!Object.hasOwn(output, operation.field)) output[operation.field] = clone(context[operation.field]);
      continue;
    }
    if (operation.op === 'copy_context_if_present' && Object.hasOwn(context, operation.field)) {
      validateContextValue(operation.field, context[operation.field]);
      if (Object.hasOwn(output, operation.field) && JSON.stringify(output[operation.field]) !== JSON.stringify(context[operation.field])) throw new Error(`MIGRATION_CONTEXT_CONFLICT:${operation.field}`);
      if (!Object.hasOwn(output, operation.field)) output[operation.field] = clone(context[operation.field]);
    }
  }
  return output;
}

function validateContextValue(field, value) {
  if (value == null) throw new Error(`MIGRATION_CONTEXT_INVALID:${field}`);
  if (field.endsWith('sha256') && !/^[a-f0-9]{64}$/.test(value)) throw new Error(`MIGRATION_CONTEXT_INVALID:${field}`);
  if (field === 'selection_ref' && (typeof value.reference !== 'string' || value.reference.length === 0 || !/^[a-f0-9]{64}$/.test(value.sha256 ?? ''))) throw new Error(`MIGRATION_CONTEXT_INVALID:${field}`);
  if (field === 'release_binding' && (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,127}$/.test(value.release_id ?? '') || !/^[a-f0-9]{40}$/.test(value.commit_sha ?? '') || !/^[a-f0-9]{64}$/.test(value.manifest_sha256 ?? ''))) throw new Error(`MIGRATION_CONTEXT_INVALID:${field}`);
  if (field === 'origin_operation' && (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/.test(value.operation_id ?? '') || !['INSTALL', 'UPDATE', 'ROLLBACK', 'UNINSTALL'].includes(value.operation_class))) throw new Error(`MIGRATION_CONTEXT_INVALID:${field}`);
  if (field === 'platform' && (!/^[a-z0-9]+-[a-z0-9-]+$/.test(value.platform_id ?? '') || !['PROJECTED', 'SYNTHETICALLY_VALIDATED', 'VALIDATED_ON_HOST'].includes(value.validation_status))) throw new Error(`MIGRATION_CONTEXT_INVALID:${field}`);
}

export async function migrateV1(name, document, context = {}, root = frameworkRoot) {
  const descriptor = await loadMigrationDescriptor(name, root);
  const output = applyMigration(document, descriptor, context);
  const result = await validateBySchemaId(output, descriptor.target_schema, root);
  if (!result.ok) throw new Error(`MIGRATION_TARGET_INVALID:${result.errors.join('; ')}`);
  return output;
}

export { descriptorNames as migrationDescriptorNames };
