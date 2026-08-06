import test from 'node:test';
import assert from 'node:assert/strict';
import { checkRuntime } from '../../tools/lib/runtime.mjs';

test('Node 24 and npm pass preflight', () => {
  assert.equal(checkRuntime({ nodeVersion: '24.18.0', npmVersion: '11.16.0' }).status, 'READY');
});

test('missing npm fails closed', () => {
  const result = checkRuntime({ nodeVersion: '24.18.0', npmVersion: null });
  assert.equal(result.ok, false);
  assert.equal(result.status, 'NEEDS_STATE_VALIDATION');
});

test('incompatible Node major fails closed without installation', () => {
  const result = checkRuntime({ nodeVersion: '22.0.0', npmVersion: '11.0.0' });
  assert.equal(result.ok, false);
  assert.match(result.errors[0], /major 24/);
});
