import { resolve } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { frameworkRoot, readYaml, walk } from './io.mjs';

export function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  return ajv;
}

export function formatAjvErrors(errors = []) {
  return (errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message}`);
}

export function validateDocument(document, schema) {
  const validate = createAjv().compile(schema);
  const ok = validate(document);
  return { ok: Boolean(ok), errors: formatAjvErrors(validate.errors) };
}

export async function loadSchemaRegistry(root = frameworkRoot) {
  const directory = resolve(root, 'contracts/schemas');
  const paths = (await walk(directory)).filter((path) => path.endsWith('.schema.yaml'));
  const schemas = await Promise.all(paths.map(readYaml));
  const ajv = createAjv();
  for (const schema of schemas) ajv.addSchema(schema);
  return { ajv, paths, schemas };
}

export async function validateSchemaRegistry(root = frameworkRoot) {
  const errors = [];
  let registry;
  try {
    registry = await loadSchemaRegistry(root);
    for (const schema of registry.schemas) {
      if (!schema.$id) errors.push('Schema without $id');
      else if (!registry.ajv.getSchema(schema.$id)) errors.push(`Schema did not compile: ${schema.$id}`);
    }
  } catch (error) {
    errors.push(error.message);
  }
  return { ok: errors.length === 0, errors, count: registry?.schemas.length ?? 0 };
}

export async function validateBySchemaId(document, schemaId, root = frameworkRoot) {
  const { ajv } = await loadSchemaRegistry(root);
  const validate = ajv.getSchema(schemaId);
  if (!validate) return { ok: false, errors: [`Unknown schema ${schemaId}`] };
  const ok = validate(document);
  return { ok: Boolean(ok), errors: formatAjvErrors(validate.errors) };
}
