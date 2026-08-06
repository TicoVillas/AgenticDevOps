import { resolve } from 'node:path';
import { frameworkRoot, readYaml } from './io.mjs';
import { validateBySchemaId, validateSchemaRegistry } from './schema.mjs';

export const artifactSchemaIds = Object.freeze({
  artifact: 'urn:agentic-devops:artifact:3.0',
  requirements: 'urn:agentic-devops:requirements:3.0',
  design: 'urn:agentic-devops:design:3.0',
  tasks: 'urn:agentic-devops:tasks:3.0',
  'execution-brief': 'urn:agentic-devops:execution-brief:3.0',
  review: 'urn:agentic-devops:review:3.0',
  evidence: 'urn:agentic-devops:evidence:3.0',
  finding: 'urn:agentic-devops:finding:3.0',
  'evidence-envelope': 'urn:agentic-devops:evidence-envelope:3.0',
  'application-profile': 'urn:agentic-devops:application-profile:3.0',
  'application-profile-override': 'urn:agentic-devops:application-profile-override:3.0',
  'dry-run-manifest': 'urn:agentic-devops:dry-run-manifest:3.0',
  'transition-manifest': 'urn:agentic-devops:transition-manifest:3.0',
  'execution-selection': 'urn:agentic-devops:execution-selection:3.0',
  'release-manifest': 'urn:agentic-devops:release-manifest:3.0',
  'release-metadata': 'urn:agentic-devops:release-metadata:3.0',
  'operation-plan': 'urn:agentic-devops:operation-plan:3.0',
  'operation-lock': 'urn:agentic-devops:operation-lock:3.0',
  'operation-tombstone': 'urn:agentic-devops:operation-tombstone:3.0',
  'uninstall-manifest': 'urn:agentic-devops:uninstall-manifest:3.0',
  'archive-provenance-manifest': 'urn:agentic-devops:archive-provenance-manifest:3.0',
  'platform-capability': 'urn:agentic-devops:platform-capability:3.0',
  'evidence-index': 'urn:agentic-devops:evidence-index:3.0',
  'project-update-manifest': 'urn:agentic-devops:project-update-manifest:3.0',
  'project-update-plan': 'urn:agentic-devops:project-update-plan:3.0',
  'project-update-journal': 'urn:agentic-devops:project-update-journal:3.0',
  'project-update-receipt': 'urn:agentic-devops:project-update-receipt:3.0',
  'project-update-backup-manifest': 'urn:agentic-devops:project-update-backup-manifest:3.0',
});

export async function validateArtifact(type, document, root = frameworkRoot) {
  const schemaId = artifactSchemaIds[type];
  if (!schemaId) return { ok: false, errors: [`Unknown artifact type ${type}`] };
  return validateBySchemaId(document, schemaId, root);
}

export async function validateArtifactFile(type, path, root = frameworkRoot) {
  return validateArtifact(type, await readYaml(resolve(path)), root);
}

export async function validateArtifacts(root = frameworkRoot) {
  return validateSchemaRegistry(root);
}
