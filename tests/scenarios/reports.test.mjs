import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  buildRequirementRows,
  computeHandoffMetrics,
  equivalenceRows,
  validateReports,
} from '../../tools/lib/reports.mjs';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';

test('traceability covers REQ-001 through REQ-054 and dedicated ACC mappings', () => {
  const rows = buildRequirementRows();
  assert.equal(rows.length, 54);
  assert.deepEqual(rows.map(({ id }) => id), Array.from({ length: 54 }, (_, index) => `REQ-${String(index + 1).padStart(3, '0')}`));
  assert.match(rows.find(({ id }) => id === 'REQ-008').acceptance, /ACC-015/);
  assert.match(rows.find(({ id }) => id === 'REQ-009').acceptance, /ACC-016/);
});

test('v2.4 equivalence matrix contains no unauthorized material difference', () => {
  assert.ok(equivalenceRows.length >= 10);
  assert.equal(equivalenceRows.some((row) => row[3] === 'UNAUTHORIZED_MATERIAL_DIFFERENCE'), false);
});

test('REQ-052 handoff metric reduces only guarded edges and preserves checkpoints', async () => {
  const workflow = await readYaml(resolve(frameworkRoot, 'core/workflow.yaml'));
  const metrics = computeHandoffMetrics(workflow);
  assert.equal(metrics.handoffs_removed_only_on_guarded_automatic_edges, workflow.automatic_transitions.length);
  assert.equal(metrics.v3_required_handoffs, workflow.human_transitions.length);
  assert.equal(metrics.inferred_authorizations, 0);
  assert.equal(metrics.topology_violations, 0);
  assert.equal(metrics.checkpoint_bypasses, 0);
});

test('generated reports remain deterministic and current', async () => {
  const result = await validateReports();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.reportCount, 3);
});
