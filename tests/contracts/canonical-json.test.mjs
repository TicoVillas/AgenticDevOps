import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalJson, canonicalJsonBytes, canonicalSha256 } from '../../tools/lib/canonical-json.mjs';

test('canonical JSON sorts object keys recursively and preserves array order', () => {
  const left = { z: [{ b: 2, a: 1 }, 3], a: { y: true, x: null } };
  const right = { a: { x: null, y: true }, z: [{ a: 1, b: 2 }, 3] };
  assert.equal(canonicalJson(left), '{"a":{"x":null,"y":true},"z":[{"a":1,"b":2},3]}');
  assert.equal(canonicalJson(left), canonicalJson(right));
  assert.equal(canonicalSha256(left), canonicalSha256(right));
});

test('canonical JSON emits deterministic UTF-8 Unicode bytes', () => {
  assert.equal(canonicalJson({ β: '雪', a: 'é' }), '{"a":"é","β":"雪"}');
  assert.deepEqual(canonicalJsonBytes({ text: 'ação' }), Buffer.from('{"text":"ação"}', 'utf8'));
  assert.equal(canonicalSha256({ text: 'ação' }), canonicalSha256({ text: 'ação' }));
});

test('canonical JSON rejects undefined, non-finite, unsupported values, sparse arrays, and cycles', () => {
  assert.throws(() => canonicalJson({ value: undefined }), /UNDEFINED_VALUE/);
  assert.throws(() => canonicalJson({ value: Number.NaN }), /NON_FINITE_NUMBER/);
  assert.throws(() => canonicalJson({ value: Infinity }), /NON_FINITE_NUMBER/);
  assert.throws(() => canonicalJson({ value: 1n }), /UNSUPPORTED_VALUE/);
  assert.throws(() => canonicalJson(new Date()), /UNSUPPORTED_OBJECT/);
  assert.throws(() => canonicalJson(Array(1)), /UNDEFINED_VALUE/);
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => canonicalJson(cycle), /CYCLIC_VALUE/);
});
