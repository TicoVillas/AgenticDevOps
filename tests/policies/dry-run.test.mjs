import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { classifyDryRun, normalizeDryRunInput, validateDryRun } from '../../tools/lib/dry-run.mjs';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';

const safe = () => readYaml(resolve(frameworkRoot, 'contracts/templates/dry-run-manifest.yaml'));

test('ACC-007 safe local deterministic dry-run is auto-apply eligible', async () => {
  const manifest = await safe();
  const result = await validateDryRun(manifest);
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.decision, 'AUTO_APPLY_ELIGIBLE');
});

test('normalization is deterministic', async () => {
  const manifest = await safe();
  manifest.blast_radius = 'broad';
  manifest.operation_class = 'remote-write';
  const first = normalizeDryRunInput(manifest);
  const second = normalizeDryRunInput(manifest);
  assert.deepEqual(first, second);
  assert.equal(first.operation_class, 'REMOTE_WRITE');
});

test('missing authority, path containment or snapshot integrity blocks', async () => {
  for (const field of ['authorization_current', 'scope_contained', 'snapshot_matches']) {
    const manifest = await safe(); manifest[field] = false;
    const result = classifyDryRun(manifest);
    assert.equal(result.decision, 'BLOCKED', field);
  }
});

test('unknown partial effect, missing evidence, rollback or observability blocks', async () => {
  const cases = [
    (m) => { m.partial_effect_state = 'UNKNOWN'; },
    (m) => { m.evidence_complete = false; },
    (m) => { m.observability_available = false; },
    (m) => { m.rollback.available = false; },
    (m) => { m.preconditions[0].passed = false; },
  ];
  for (const mutate of cases) {
    const manifest = await safe(); mutate(manifest);
    assert.equal(classifyDryRun(manifest).decision, 'BLOCKED');
  }
});

test('shared/production, remote, sensitive and high-risk cases require checkpoint', async () => {
  const cases = [
    (m) => { m.environment = 'PRODUCTION'; },
    (m) => { m.operation_class = 'REMOTE_WRITE'; },
    (m) => { m.external_effect = true; },
    (m) => { m.secrets_present = true; },
    (m) => { m.data_classes = ['regulated']; },
    (m) => { m.risk = 'CRITICAL'; },
    (m) => { m.blast_radius = 'BROAD'; },
    (m) => { m.ambiguity = 'HIGH'; },
    (m) => { m.reversibility = 'NONE'; },
    (m) => { m.determinism = 'NON_DETERMINISTIC'; },
    (m) => { m.idempotency = 'NON_IDEMPOTENT'; },
    (m) => { m.equivalence = 'PARTIAL'; },
  ];
  for (const mutate of cases) {
    const manifest = await safe(); mutate(manifest);
    assert.equal(classifyDryRun(manifest).decision, 'CHECKPOINT_REQUIRED');
  }
});

test('critical scenarios produce zero false auto-eligible decisions', async () => {
  const scenarios = [];
  for (const field of ['environment', 'operation_class', 'risk', 'blast_radius']) {
    const manifest = await safe();
    manifest[field] = { environment: 'PRODUCTION', operation_class: 'INFRASTRUCTURE', risk: 'CRITICAL', blast_radius: 'BROAD' }[field];
    scenarios.push(manifest);
  }
  assert.equal(scenarios.filter((scenario) => classifyDryRun(scenario).decision === 'AUTO_APPLY_ELIGIBLE').length, 0);
});

test('declared auto-apply cannot override computed checkpoint or block', async () => {
  const manifest = await safe(); manifest.environment = 'SHARED';
  const result = await validateDryRun(manifest);
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /differs from computed/);
});
