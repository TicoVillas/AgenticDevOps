import test from 'node:test';
import assert from 'node:assert/strict';
import { scanSelectionBoundaries, validateSelectionBoundaries } from '../../tools/lib/policies.mjs';

test('M1 boundary scan permits concrete names only in adapters and handoff snapshots', () => {
  const concrete = 'Use GPT-5.6 Sol.';
  assert.equal(scanSelectionBoundaries([{ path: 'core/invalid.yaml', text: concrete }]).length, 1);
  assert.deepEqual(scanSelectionBoundaries([{ path: 'adapters/example/model-map.yaml', text: concrete }]), []);
  assert.deepEqual(scanSelectionBoundaries([{ path: 'tests/adapters/snapshots/handoff.json', text: concrete }]), []);
  assert.equal(scanSelectionBoundaries([{ path: 'tests/adapters/snapshots/review.json', text: concrete }]).length, 1);
});

test('M1 repository selection boundaries are clean', async () => {
  const result = await validateSelectionBoundaries();
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.ok(result.scanned > 0);
});
