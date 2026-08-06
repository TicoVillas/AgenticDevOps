import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBySchemaId, validateSchemaRegistry } from '../../tools/lib/schema.mjs';

const HASH = 'a'.repeat(64);
const NOW = '2026-08-02T00:00:00.000Z';

function managedItem(index) {
  return {
    id: `item-${index}`,
    source_id: 'source-item',
    destination: `managed/item-${index}.md`,
    owner: 'INSTALLING_USER',
    group: 'INSTALLING_PRIMARY_GROUP',
    mode: '0644',
    apply_phase: index === 64 ? 'SELF_UPDATE' : 'SUPPORT',
    depends_on: [],
    self_update: index === 64,
    loader_role: 'NONE',
  };
}

function distributionManifest() {
  return {
    schema_version: 1,
    framework_version: '3.0.0',
    adapter: 'kiro',
    manifest_id: 'kiro-global-v3',
    source_root: 'FRAMEWORK_ROOT',
    destination_root: 'KIRO_GLOBAL_ROOT',
    expected_managed_files: 64,
    source_catalog: [
      {
        id: 'distribution-manifest',
        path: 'adapters/kiro/distribution-manifest.yaml',
        version: '3.0.0',
        class: 'SOURCE_ONLY',
        adapter_scope: 'kiro',
        hash_mode: 'FRAMEWORK_LOCK_EXTERNAL',
      },
      {
        id: 'source-item',
        path: 'core/WorkflowRouter.md',
        version: '3.0.0',
        class: 'GLOBAL_KIRO_MANAGED',
        adapter_scope: 'universal',
        hash_mode: 'LOCKED_SHA256',
        sha256: HASH,
      },
    ],
    managed_items: Array.from({ length: 64 }, (_, index) => managedItem(index + 1)),
    legacy_retirements: Array.from({ length: 9 }, (_, index) => ({
      path: index === 0 ? 'steering/workflow-core.md' : `steering/contracts/Legacy${index}.md`,
      baseline_sha256: HASH,
      required_state: 'LEGACY_ACTIVE_CONFLICT',
      backup_required: true,
      remove_only_if_exact: true,
    })),
    operation: {
      self_update_item: 'skill-bootstrap',
      restart_status: 'RESTART_REQUIRED',
      directory_mode: '0755',
      stage_a: 'PRE_RESTART_APPLY',
      stage_b: 'POST_RESTART_VALIDATION',
    },
  };
}

const validate = (id, document) => validateBySchemaId(document, id);

test('distribution and operational schemas compile under Ajv strict mode', async () => {
  const result = await validateSchemaRegistry();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.ok(result.count >= 20);
});

test('distribution manifest schema accepts external integrity and exactly 64 managed items', async () => {
  const manifest = distributionManifest();
  assert.equal((await validate('urn:agentic-devops:distribution-manifest:3.0', manifest)).ok, true);

  manifest.expected_managed_files = 63;
  assert.equal((await validate('urn:agentic-devops:distribution-manifest:3.0', manifest)).ok, false);
});

test('manifest self-integrity cannot embed a recursive sha256', async () => {
  const manifest = distributionManifest();
  manifest.source_catalog[0].sha256 = HASH;
  const result = await validate('urn:agentic-devops:distribution-manifest:3.0', manifest);
  assert.equal(result.ok, false);
});

test('backup manifest requires verified restorable entries', async () => {
  const backup = {
    schema_version: 1,
    operation_id: 'operation-001',
    manifest_sha256: HASH,
    snapshot_sha256: HASH,
    created_at: NOW,
    destination_root_id: 'KIRO_GLOBAL_ROOT',
    entries: [{
      item_id: 'item-1',
      path: 'skills/spec/SKILL.md',
      pre_state: 'MANAGED_OUTDATED',
      backup_path: 'backup/skills/spec/SKILL.md',
      sha256: HASH,
      size: 42,
      file_type: 'REGULAR_FILE',
      mode: '0644',
      uid: 1000,
      gid: 1000,
      verified: true,
    }],
    verified: true,
  };
  assert.equal((await validate('urn:agentic-devops:distribution-backup-manifest:3.0', backup)).ok, true);
  backup.entries[0].verified = false;
  assert.equal((await validate('urn:agentic-devops:distribution-backup-manifest:3.0', backup)).ok, false);
});

test('journal records intent before completion and rejects unknown states', async () => {
  const journal = {
    schema_version: 1,
    operation_id: 'operation-001',
    manifest_sha256: HASH,
    snapshot_sha256: HASH,
    status: 'PLANNED',
    entries: [{
      sequence: 1,
      item_id: 'item-1',
      path: 'core/WorkflowRouter.md',
      action: 'CREATE',
      state: 'PLANNED',
      intent_recorded_at: NOW,
      before_sha256: null,
      after_sha256: null,
      error_code: null,
    }],
  };
  assert.equal((await validate('urn:agentic-devops:installation-journal:3.0', journal)).ok, true);
  journal.entries[0].state = 'EXECUTED';
  assert.equal((await validate('urn:agentic-devops:installation-journal:3.0', journal)).ok, false);
});

test('pre-restart receipt keeps self-update pending and never anticipates execution', async () => {
  const receipt = {
    schema_version: 1,
    operation_id: 'operation-001',
    manifest_sha256: HASH,
    lock_sha256: HASH,
    package_sha256: HASH,
    snapshot_sha256: HASH,
    status: 'PRE_RESTART_PENDING',
    pending_action: 'skill-bootstrap',
    actions: [],
    actions_not_executed: ['self-update', 'post-restart-validation'],
  };
  assert.equal((await validate('urn:agentic-devops:installation-receipt:3.0', receipt)).ok, true);
  receipt.pending_action = null;
  assert.equal((await validate('urn:agentic-devops:installation-receipt:3.0', receipt)).ok, false);
});
