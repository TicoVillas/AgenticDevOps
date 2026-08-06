import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { frameworkRoot, readYaml } from './lib/io.mjs';
import { scanSensitiveTree } from './lib/release-security.mjs';
import { validateBySchemaId, validateSchemaRegistry } from './lib/schema.mjs';

const expectedContracts = Object.freeze([
  'release-manifest',
  'release-metadata',
  'release-asset-inventory',
  'release-signature',
  'release-sbom-reference',
  'release-trust-store',
  'release-key-event',
  'release-compensating-control',
  'release-immutability-decision',
  'release-key-incident',
]);

const requiredPolicyStatements = Object.freeze([
  'does not authorize signing',
  'Core code must not read a private-key file',
  'Artifact attestation is optional and non-blocking',
  'immediately sets `hard_stop: true`',
  'explicitly approved compensating control',
  'does not grant draft or publish authority',
]);

async function readText(path) {
  return readFile(path, 'utf8');
}

export async function validateM4Release(root = frameworkRoot) {
  const errors = [];
  const registry = await validateSchemaRegistry(root);
  errors.push(...registry.errors.map((error) => `schema-registry: ${error}`));

  for (const name of expectedContracts) {
    const schemaPath = resolve(root, 'contracts/schemas', `${name}.schema.yaml`);
    const templatePath = resolve(root, 'contracts/templates', `${name}.yaml`);
    try {
      const schema = await readYaml(schemaPath);
      if (schema.$id !== `urn:agentic-devops:${name}:3.0`) errors.push(`${name}: unexpected schema ID`);
      if (schema.$schema !== 'http://json-schema.org/draft-07/schema#') errors.push(`${name}: draft-07 required`);
      if (schema.additionalProperties !== false) errors.push(`${name}: additionalProperties false required`);
      const template = await readYaml(templatePath);
      const result = await validateBySchemaId(template, schema.$id, root);
      if (!result.ok) errors.push(`${name}: template invalid: ${result.errors.join('; ')}`);
    } catch (error) {
      errors.push(`${name}: ${error.message}`);
    }
  }

  try {
    const metadata = await readYaml(resolve(root, 'contracts/templates/release-metadata.yaml'));
    if (metadata.attestation?.blocking !== false) errors.push('release-metadata: attestation must be non-blocking');
    const decision = await readYaml(resolve(root, 'contracts/templates/release-immutability-decision.yaml'));
    if (decision.result !== 'BLOCKED' || decision.publish_authorized !== false || decision.checkpoint_required !== true) errors.push('release-immutability-decision: default must fail closed without publication authority');
    const incident = await readYaml(resolve(root, 'contracts/templates/release-key-incident.yaml'));
    if (incident.hard_stop !== true || incident.publish_authorized !== false) errors.push('release-key-incident: hard stop required');
  } catch (error) {
    errors.push(`template-invariants: ${error.message}`);
  }

  try {
    const policy = await readText(resolve(root, 'policies/ReleaseSigningIncidentPolicy.md'));
    for (const statement of requiredPolicyStatements) if (!policy.includes(statement)) errors.push(`policy statement missing: ${statement}`);
  } catch (error) {
    errors.push(`release policy: ${error.message}`);
  }

  try {
    const migration = await readYaml(resolve(root, 'contracts/migrations/v1/release-manifest.yaml'));
    const fields = ['asset_inventory_sha256', 'checksums', 'signing', 'sbom'];
    if (migration.target_schema !== 'urn:agentic-devops:release-manifest:3.0' || fields.some((field) => !migration.required_context?.includes(field))) errors.push('release-manifest migration bindings incomplete');
  } catch (error) {
    errors.push(`release-manifest migration: ${error.message}`);
  }

  try {
    const fixture = JSON.parse(await readText(resolve(root, 'tests/fixtures/release-crypto/TEST_ONLY.json')));
    if (fixture.classification !== 'TEST_ONLY' || fixture.synthetic !== true || fixture.private_material_persisted !== false || fixture.usable_for_release !== false || fixture.grants_signing_authority !== false || fixture.grants_publish_authority !== false) errors.push('release-crypto fixture boundary invalid');
  } catch (error) {
    errors.push(`release-crypto fixture: ${error.message}`);
  }

  for (const path of ['tools/lib/release.mjs', 'tools/lib/release-trust.mjs']) {
    try {
      const source = await readText(resolve(root, path));
      const forbidden = ["'node:fs", '"node:fs', "'node:child_process", '"node:child_process', 'process.env', 'fetch(', 'privateKeyFile', 'private_key_file'];
      for (const token of forbidden) if (source.includes(token)) errors.push(`${path}: forbidden signing boundary token ${token}`);
    } catch (error) {
      errors.push(`${path}: ${error.message}`);
    }
  }

  let scan = { ok: false, scanned: 0, findings: [] };
  try {
    scan = await scanSensitiveTree(root, { exclude: ['node_modules'], permitLabeledSynthetic: false });
    if (!scan.ok) for (const entry of scan.findings) errors.push(`sensitive:${entry.path}:${entry.code}`);
  } catch (error) {
    errors.push(`sensitive scan: ${error.message}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    schema_count: expectedContracts.length,
    template_count: expectedContracts.length,
    scanned_files: scan.scanned,
    sensitive_findings: scan.findings?.length ?? 0,
    private_material_persisted: false,
    attestation_blocking: false,
    publish_authorized: false,
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const root = process.argv[2] ? resolve(process.argv[2]) : frameworkRoot;
  const result = await validateM4Release(root);
  console.log(JSON.stringify(result));
  if (!result.ok) process.exitCode = 1;
}
