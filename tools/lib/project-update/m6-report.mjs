import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { frameworkRoot } from '../io.mjs';

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function expectedM6ProjectUpdateReport() {
  return json({
    schema_version: 1,
    milestone: 'M6.1-M6.7',
    result: 'PASS',
    validation_level: 'SYNTHETICALLY_VALIDATED',
    tested_scope: 'synthetic only',
    real_project_access_authorized: false,
    git_write_authorized: false,
    reconcile_read_only: true,
    receipt_namespaces_separate: true,
    planner_proposal_only: true,
    profile_policy: 'USER_OWNED_FIELD_AWARE_MERGE',
    checkpoint_and_authorization_required: true,
    migration_catalog: 'contracts/migrations/project-update/catalog.yaml',
    runtime_reuses_m5_primitives: ['lifecycle/paths', 'lifecycle/authorization', 'lifecycle/state-store', 'lifecycle/atomic-writer', 'lifecycle/reconcile'],
    tests: [
      'tests/project-update/paths-snapshot-planner.test.mjs',
      'tests/project-update/authorization-apply.test.mjs',
      'tests/project-update/migration-rollback-isolation.test.mjs',
    ],
    operations_not_authorized: ['GIT_INIT', 'GIT_STAGE', 'GIT_COMMIT', 'GIT_CHECKOUT', 'GIT_RESET', 'GIT_CLEAN', 'GIT_PUSH', 'GIT_BRANCH', 'GIT_TAG'],
  });
}

export async function generateM6ProjectUpdateReport(root = frameworkRoot) {
  const output = resolve(root, 'generated/reports');
  await mkdir(output, { recursive: true });
  const name = 'm6-project-update.json';
  await writeFile(resolve(output, name), expectedM6ProjectUpdateReport(), 'utf8');
  return name;
}

export async function validateM6ProjectUpdateReport(root = frameworkRoot) {
  const path = resolve(root, 'generated/reports/m6-project-update.json');
  try {
    const actual = await readFile(path, 'utf8');
    return Object.freeze({ ok: actual === expectedM6ProjectUpdateReport(), errors: actual === expectedM6ProjectUpdateReport() ? [] : ['Generated M6 report drift: m6-project-update.json'] });
  } catch (error) {
    return Object.freeze({ ok: false, errors: [`Missing generated M6 report: ${error.code}`] });
  }
}
