import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { frameworkRoot, readYaml } from '../../tools/lib/io.mjs';
import { validateBySchemaId } from '../../tools/lib/schema.mjs';
import {
  evaluateImmutabilityGate,
  evaluateKeyIncidentHardStop,
  scanSensitiveEntries,
  scanSensitiveTree,
} from '../../tools/lib/release-security.mjs';

const NOW = '2026-08-02T00:00:00Z';
const AUTH = 'a'.repeat(64);
const fixture = (name) => readYaml(resolve(frameworkRoot, 'tests/fixtures/release-crypto', name));

test('repository scanner passes TEST_ONLY fixtures without persisted private material', async () => {
  const metadata = await fixture('TEST_ONLY.json');
  assert.equal(metadata.classification, 'TEST_ONLY');
  assert.equal(metadata.synthetic, true);
  assert.equal(metadata.private_material_persisted, false);
  const result = await scanSensitiveTree(frameworkRoot, { exclude: ['node_modules'], permitLabeledSynthetic: false });
  assert.equal(result.ok, true, JSON.stringify(result.findings));
  assert.deepEqual(result.findings, []);
});

test('scanner detects private material and token forms while never returning content', () => {
  const privateMarker = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const githubToken = ['ghp_', 'A'.repeat(40)].join('');
  const result = scanSensitiveEntries([
    { path: 'safe.txt', bytes: Buffer.from('safe') },
    { path: 'leaked.key', bytes: Buffer.from(`${privateMarker}\nopaque`) },
    { path: 'token.txt', bytes: Buffer.from(githubToken) },
  ]);
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((entry) => entry.code === 'PRIVATE_KEY_MATERIAL'));
  assert.ok(result.findings.some((entry) => entry.code === 'SENSITIVE_KEY_FILENAME'));
  assert.ok(result.findings.some((entry) => entry.code === 'GITHUB_TOKEN'));
  assert.ok(result.findings.every((entry) => entry.content_included === false));
  assert.ok(result.findings.every((entry) => !Object.hasOwn(entry, 'match')));
});

test('scanner permits only explicitly labeled synthetic key material under the fixture prefix', () => {
  const privateMarker = ['-----BEGIN ', 'PRIVATE KEY-----'].join('');
  const content = `{"classification":"TEST_ONLY","synthetic":true}\n${privateMarker}\nopaque`;
  const allowed = scanSensitiveEntries([{ path: 'tests/fixtures/release-crypto/synthetic.key', bytes: Buffer.from(content) }], { permitLabeledSynthetic: true });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.allowed_test_material.length, 2);
  const outside = scanSensitiveEntries([{ path: 'release/synthetic.key', bytes: Buffer.from(content) }], { permitLabeledSynthetic: true });
  assert.equal(outside.ok, false);
});

test('native immutable gate is READY but never authorizes publication', async () => {
  const decision = evaluateImmutabilityGate({ releaseId: 'release-310', observedAt: NOW, providerCapability: 'AVAILABLE', nativeImmutable: true });
  assert.equal(decision.result, 'READY');
  assert.equal(decision.mode, 'NATIVE_IMMUTABLE');
  assert.equal(decision.publish_authorized, false);
  assert.equal(decision.checkpoint_required, true);
  const valid = await validateBySchemaId(decision, 'urn:agentic-devops:release-immutability-decision:3.0');
  assert.equal(valid.ok, true, valid.errors.join('; '));
});

test('compensating control requires exact release, explicit current authorization, and unexpired evidence', async () => {
  const control = await fixture('immutability-control.json');
  const ready = evaluateImmutabilityGate({ releaseId: 'release-310', observedAt: NOW, providerCapability: 'UNAVAILABLE', nativeImmutable: false, compensatingControl: control, expectedAuthorizationSha256: AUTH });
  assert.equal(ready.result, 'READY');
  assert.equal(ready.mode, 'COMPENSATING_CONTROL');
  assert.equal(ready.publish_authorized, false);
  assert.equal((await validateBySchemaId(ready, 'urn:agentic-devops:release-immutability-decision:3.0')).ok, true);
  const cases = [
    { expectedAuthorizationSha256: 'b'.repeat(64) },
    { releaseId: 'release-other' },
    { observedAt: '2026-10-01T00:00:00Z' },
    { compensatingControl: { ...control, approval_status: 'DRAFT' } },
  ];
  for (const override of cases) {
    const blocked = evaluateImmutabilityGate({ releaseId: 'release-310', observedAt: NOW, providerCapability: 'UNAVAILABLE', nativeImmutable: false, compensatingControl: control, expectedAuthorizationSha256: AUTH, ...override });
    assert.equal(blocked.result, 'BLOCKED');
    assert.equal(blocked.publish_authorized, false);
  }
});

test('unknown, unavailable-without-control, and mutable observation fail closed', () => {
  const unknown = evaluateImmutabilityGate({ releaseId: 'release-310', observedAt: NOW, providerCapability: 'UNKNOWN', nativeImmutable: false });
  const absent = evaluateImmutabilityGate({ releaseId: 'release-310', observedAt: NOW, providerCapability: 'UNAVAILABLE', nativeImmutable: false });
  const mutable = evaluateImmutabilityGate({ releaseId: 'release-310', observedAt: NOW, providerCapability: 'AVAILABLE', nativeImmutable: false });
  assert.deepEqual([unknown.result, absent.result, mutable.result], ['BLOCKED', 'BLOCKED', 'BLOCKED']);
  assert.deepEqual([unknown.reason_code, absent.reason_code, mutable.reason_code], ['IMMUTABILITY_UNAVAILABLE', 'COMPENSATING_CONTROL_REQUIRED', 'NATIVE_IMMUTABILITY_NOT_OBSERVED']);
});

test('compromised-key incident is an unconditional signing and publication hard stop', async () => {
  const incident = await fixture('key-incident.json');
  assert.equal((await validateBySchemaId(incident, 'urn:agentic-devops:release-key-incident:3.0')).ok, true);
  assert.deepEqual(evaluateKeyIncidentHardStop(incident), { result: 'BLOCKED', reason_code: 'COMPROMISED_KEY_HARD_STOP', signing_authorized: false, publish_authorized: false });
  assert.throws(() => evaluateKeyIncidentHardStop({ ...incident, publish_authorized: true }), /INVALID_KEY_INCIDENT/);
});
