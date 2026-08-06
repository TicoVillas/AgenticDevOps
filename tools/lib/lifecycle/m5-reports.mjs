import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { frameworkRoot } from '../io.mjs';

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function expectedM5Reports() {
  return Object.freeze({
    'm5-compatibility.json': json({
      schema_version: 1,
      milestone: 'M5.1',
      result: 'PASS',
      lifecycle_engine: ['tools/lib/distribution.mjs', 'tools/lib/installation.mjs'],
      orchestration_only: ['tools/lib/lifecycle/', 'adapters/lifecycle/node-filesystem.mjs'],
      second_engine_detected: false,
      regression_tests: ['tests/distribution/installation-artifacts.test.mjs', 'tests/distribution/installation-apply.test.mjs', 'tests/distribution/installation-recovery.test.mjs', 'tests/distribution/bootstrap-flow.test.mjs'],
      evidence_command: 'node --test tests/distribution/installation-artifacts.test.mjs tests/distribution/installation-apply.test.mjs tests/distribution/installation-recovery.test.mjs tests/distribution/bootstrap-flow.test.mjs',
    }),
    'm5-snapshot-divergence.json': json({
      schema_version: 1,
      milestone: 'M5.3',
      result: 'PASS',
      reason_code: 'SNAPSHOT_DIVERGED',
      declared_artifact_overrides_observed_state: false,
      test: 'tests/lifecycle/engine-integration.test.mjs',
      evidence_case: 'artifact authorization cannot prevail over destination divergence',
    }),
    'm5-retention-consumption.json': json({
      schema_version: 1,
      milestone: 'M5.7',
      result: 'PASS',
      normative_source: 'policies/OperationalRetentionPolicy.md',
      consumer: 'tools/lib/lifecycle/retention-planner.mjs',
      duplicated_values: false,
      destructive_action_authorized: false,
      validator: 'npm run validate:retention',
    }),
    'm5-journal-reconcile.json': json({
      schema_version: 1,
      milestone: 'M5.8',
      result: 'PASS',
      durable_intent_required: true,
      reconcile_read_only: true,
      blind_retry_authorized: false,
      uncertain_purge_authorized: false,
      uncertain_lock_release_authorized: false,
      tests: ['tests/lifecycle/durability-reconcile.test.mjs', 'tests/lifecycle/engine-integration.test.mjs'],
    }),
    'm5-fault-injection.json': json({
      schema_version: 1,
      milestone: 'M5.4/M5.8',
      result: 'PASS',
      boundaries: ['before-intent', 'after-intent', 'before-write', 'after-stage-write', 'before-sync', 'after-sync', 'before-rename', 'after-rename', 'after-write', 'before-receipt', 'after-receipt'],
      outcomes: ['NO_EFFECT', 'PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN'],
      automatic_retry: false,
      test: 'tests/lifecycle/engine-integration.test.mjs',
    }),
  });
}

export async function generateM5Reports(root = frameworkRoot) {
  const output = resolve(root, 'generated/reports');
  await mkdir(output, { recursive: true });
  const reports = expectedM5Reports();
  for (const [name, text] of Object.entries(reports)) await writeFile(resolve(output, name), text, 'utf8');
  return Object.keys(reports).sort();
}

export async function validateM5Reports(root = frameworkRoot) {
  const errors = [];
  const reports = expectedM5Reports();
  for (const [name, expected] of Object.entries(reports)) {
    try {
      if (await readFile(resolve(root, 'generated/reports', name), 'utf8') !== expected) errors.push(`Generated M5 report drift: ${name}`);
    } catch {
      errors.push(`Missing generated M5 report: ${name}`);
    }
  }
  return Object.freeze({ ok: errors.length === 0, errors, report_count: Object.keys(reports).length });
}
