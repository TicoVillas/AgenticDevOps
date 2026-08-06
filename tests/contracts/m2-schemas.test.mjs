import test from 'node:test';
import assert from 'node:assert/strict';
import { validateArtifact } from '../../tools/lib/artifacts.mjs';
import { validateBySchemaId, validateSchemaRegistry } from '../../tools/lib/schema.mjs';

const H = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
const C = 'a'.repeat(40);
const NOW = '2026-08-02T00:00:00.000Z';
const platform = { schema_version: 1, platform_id: 'linux-x86-64', os: 'linux', architecture: 'x86_64', runtime: { node_major: 24, shell: 'bash' }, capabilities: { permissions: 'POSIX_MODE', atomic_rename: 'SUPPORTED', case_folding: 'SENSITIVE', acl: 'NOT_APPLICABLE' }, validation_status: 'SYNTHETICALLY_VALIDATED' };

const documents = {
  'release-manifest': { schema_version: 1, release_id: 'release-310', version: '3.1.0', tag: 'v3.1.0', commit_sha: C, repository: 'TicoVillas/AgenticDevOps', assets: [{ name: 'package.tgz', sha256: H, size: 1, media_type: 'application/gzip', class: 'RUNTIME' }], asset_inventory_sha256: H, checksums: { name: 'SHA256SUMS', sha256: H2, algorithm: 'SHA-256', serialization: 'LOWERCASE_HEX_TWO_SPACES_NAME_LF' }, signing: { algorithm: 'Ed25519', key_id: 'release-test-only-01', fingerprint_sha256: H, manifest_signature: { name: 'release-manifest-v3.1.0.json.sig', encoding: 'base64' }, checksums_signature: { name: 'SHA256SUMS.sig', encoding: 'base64' } }, sbom: { schema_version: 1, name: 'sbom.spdx.json', format: 'SPDX_JSON', media_type: 'application/spdx+json', sha256: H }, lock_sha256: H, runtime: { node_major: 24, package_manager: 'npm' }, platform_support: ['linux-x86-64'], platform_capability: platform, build_identity: 'build:release-310', validation_status: 'DRAFT' },
  'release-metadata': { schema_version: 1, release_manifest_sha256: H, commit_sha: C, lock_sha256: H, build: { workflow_id: 'release', run_id: 'run-001', clean_runner: true, built_at: NOW }, reproducibility: { status: 'NOT_RUN', logical_identity: null }, attestation: { status: 'NOT_PROVIDED', blocking: false } },
  'operation-plan': { schema_version: 1, operation_id: 'operation-001', operation_class: 'INSTALL', destination_root_id: 'KIRO_GLOBAL_ROOT', snapshot_sha256: H, source_sha256: H2, decision: 'CHECKPOINT_REQUIRED', authorization_binding: { operation_id: 'operation-001', scope_sha256: H }, actions: [{ sequence: 1, path: 'core/a.md', action: 'CREATE', before_sha256: null, after_sha256: H }], stop_conditions: ['SNAPSHOT_DIVERGED'] },
  'operation-lock': { schema_version: 1, lock_id: 'lock-0001', operation_id: 'operation-001', operation_class: 'INSTALL', destination_root_id: 'KIRO_GLOBAL_ROOT', holder: { process_id: 1, session_id: 'session-001' }, acquired_at: NOW, state: 'ACTIVE', break_authorized: false },
  'operation-tombstone': { schema_version: 1, operation_id: 'operation-001', operation_class: 'UNINSTALL', plan_sha256: H, journal_sha256: H2, created_at: NOW, outcome: 'COMPLETED', retention_class: 'INDEFINITE', removed_paths: ['core/a.md'], reconciliation_status: 'RECONCILED' },
  'uninstall-manifest': { schema_version: 1, installation_receipt_sha256: H, destination_root_id: 'KIRO_GLOBAL_ROOT', managed_paths: [{ path: 'core/a.md', installed_sha256: H, ownership: 'FRAMEWORK_MANAGED' }], preserve_unmanaged: true, restore_originals: true },
  'archive-provenance-manifest': { schema_version: 1, manifest_id: 'archive-001', created_at: NOW, trust_label: 'VERIFIED_SOURCE', source_sets: [{ id: 'source-001', origin: 'local', captured_at: NOW, git_bundle: false, source_kind: 'DIRECTORY', trust_label: 'VERIFIED_SOURCE' }], files: [{ source_set_id: 'source-001', path: 'a.txt', sha256: H, size: 1 }], archives: [{ name: 'snapshot.tgz', algorithm: 'sha256', sha256: H2, size: 2, source_set_id: 'source-001', kind: 'SNAPSHOT', format: 'TAR_GZIP', trust_label: 'VERIFIED_SOURCE', logical_root: 'source-001', reproducible: true, normalization: { mtime_epoch: 0, owner: 0, group: 0, mode: '0644', gzip_name_and_time: false } }] },
  'platform-capability': platform,
  'evidence-index': { schema_version: 1, evidence_id: 'evidence-001', commit_sha: C, created_at: NOW, entries: [{ id: 'test-001', kind: 'TEST', result: 'PASS', sha256: H }], limitations: [], sanitized: true },
  'project-update-manifest': { schema_version: 1, manifest_id: 'project-update', project_root: '/tmp/project', snapshot_sha256: H, source_release_sha256: H2, allowed_prefixes: ['.agentic/'], migrations: [{ id: 'migration-001', version: 1, preconditions: ['profile exists'], reversible: true }] },
  'project-update-plan': { schema_version: 1, operation_id: 'project-001', manifest_sha256: H, project_snapshot_sha256: H2, decision: 'PROPOSAL', checkpoint_required: true, authorization_binding: { operation_id: 'project-001', plan_sha256: H, snapshot_sha256: H2 }, actions: [{ sequence: 1, path: '.agentic/config.yaml', action: 'UPDATE', before_sha256: H, after_sha256: H2 }] },
  'project-update-journal': { schema_version: 1, operation_id: 'project-001', plan_sha256: H, project_snapshot_sha256: H2, status: 'PLANNED', entries: [{ sequence: 1, path: '.agentic/config.yaml', action: 'UPDATE', state: 'PLANNED', intent_recorded_at: NOW, intent_fsynced: true, before_sha256: H, after_sha256: null }] },
  'project-update-receipt': { schema_version: 1, receipt_id: 'project-receipt-001', operation_id: 'project-001', manifest_sha256: H, plan_sha256: H, journal_sha256: H2, project_snapshot_before_sha256: H, project_snapshot_after_sha256: H2, status: 'COMPLETED', actions: [{ sequence: 1, path: '.agentic/config.yaml', result: 'VERIFIED' }] },
  'project-update-backup-manifest': { schema_version: 1, operation_id: 'project-001', project_root_sha256: H, plan_sha256: H2, entries: [{ path: '.agentic/config.yaml', backup_path: 'files/config.yaml', sha256: H, size: 1, verified: true }], verified: true },
};

const validate = (name, document) => validateBySchemaId(document, `urn:agentic-devops:${name}:3.0`);

test('all M2 schemas compile and positive fixtures validate through the artifact registry', async () => {
  const registry = await validateSchemaRegistry();
  assert.equal(registry.ok, true, registry.errors.join('\n'));
  for (const [name, document] of Object.entries(documents)) assert.equal((await validateArtifact(name, document)).ok, true, name);
});

test('all new M2 schemas reject additional properties', async () => {
  for (const [name, document] of Object.entries(documents)) {
    const invalid = structuredClone(document);
    invalid.unexpected = true;
    assert.equal((await validate(name, invalid)).ok, false, name);
  }
});

test('required, enum, binding, and cross-schema reference failures are rejected', async () => {
  const required = structuredClone(documents['release-manifest']); delete required.release_id;
  assert.equal((await validate('release-manifest', required)).ok, false);
  const enumeration = structuredClone(documents['operation-lock']); enumeration.state = 'BROKEN';
  assert.equal((await validate('operation-lock', enumeration)).ok, false);
  const binding = structuredClone(documents['operation-plan']); binding.authorization_binding.scope_sha256 = 'bad';
  assert.equal((await validate('operation-plan', binding)).ok, false);
  const reference = structuredClone(documents['release-manifest']); reference.platform_capability.validation_status = 'VALIDATED_ON_HOST';
  assert.equal((await validate('release-manifest', reference)).ok, false);
});

test('legacy v3.0 installation documents remain valid with optional M2 extensions', async () => {
  const journal = { schema_version: 1, operation_id: 'operation-001', manifest_sha256: H, snapshot_sha256: H, status: 'PLANNED', entries: [{ sequence: 1, item_id: 'item-1', path: 'core/a.md', action: 'CREATE', state: 'PLANNED', intent_recorded_at: NOW }] };
  const receipt = { schema_version: 1, operation_id: 'operation-001', manifest_sha256: H, lock_sha256: H, package_sha256: H, snapshot_sha256: H, status: 'PRE_RESTART_PENDING', pending_action: 'skill-bootstrap', actions: [], actions_not_executed: ['self-update'] };
  assert.equal((await validateBySchemaId(journal, 'urn:agentic-devops:installation-journal:3.0')).ok, true);
  assert.equal((await validateBySchemaId(receipt, 'urn:agentic-devops:installation-receipt:3.0')).ok, true);
});

test('explicit M2 durability and finalization evidence cannot contradict lifecycle status', async () => {
  const journal = { schema_version: 1, operation_id: 'operation-001', manifest_sha256: H, snapshot_sha256: H, plan_sha256: H, durable_sequence: 1, status: 'VERIFIED', fsync_evidence: { intent_fsynced_through: 1, journal_fsynced: false }, entries: [{ sequence: 1, item_id: 'item-1', path: 'core/a.md', action: 'CREATE', state: 'VERIFIED', intent_recorded_at: NOW, intent_fsynced: false, after_sha256: H }] };
  assert.equal((await validateBySchemaId(journal, 'urn:agentic-devops:installation-journal:3.0')).ok, false);
  const receipt = { schema_version: 1, operation_id: 'operation-001', manifest_sha256: H, lock_sha256: H, package_sha256: H, snapshot_sha256: H, status: 'COMPLETED', pending_action: null, finalization_stage: 'PRE_RESTART', actions: [], actions_not_executed: [] };
  assert.equal((await validateBySchemaId(receipt, 'urn:agentic-devops:installation-receipt:3.0')).ok, false);
  receipt.status = 'PRE_RESTART_PENDING'; receipt.pending_action = 'skill-bootstrap'; receipt.finalization_stage = 'POST_RESTART_FINAL';
  assert.equal((await validateBySchemaId(receipt, 'urn:agentic-devops:installation-receipt:3.0')).ok, false);
});
