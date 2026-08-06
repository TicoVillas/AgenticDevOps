import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReleaseStage, sanitizeEvidenceIndex, scanMutableReleaseSources } from '../../tools/lib/ci/policy.mjs';
import { evaluateImmutabilityGate } from '../../tools/lib/release-security.mjs';
import { evaluateWorkflowImmutabilityGate } from '../../tools/evaluate-m8-release-gate.mjs';

const commitSha = 'a'.repeat(40);
const hash = 'b'.repeat(64);
const ready = evaluateImmutabilityGate({
  releaseId: 'release-310',
  observedAt: '2026-08-05T00:00:00Z',
  providerCapability: 'AVAILABLE',
  nativeImmutable: true,
});
const checkpoint = {
  status: 'APPROVED', independent: true, commit_sha: commitSha,
  build_session: 'build-session', review_session: 'review-session',
  evidence_sha256: hash, authorization_sha256: 'c'.repeat(64),
};

test('draft and review never grant publication authority', () => {
  for (const stage of ['DRAFT', 'REVIEW']) {
    const result = evaluateReleaseStage({ stage, commitSha, immutabilityDecision: ready, checkpoint });
    assert.equal(result.authorization_granted, false);
    assert.equal(result.publish_authorized, false);
  }
});

test('publish requires both immutable READY and independent checkpoint', () => {
  assert.equal(ready.publish_authorized, false);
  assert.equal(ready.checkpoint_required, true);
  assert.equal(evaluateReleaseStage({ stage: 'PUBLISH', commitSha, immutabilityDecision: ready, checkpoint }).publish_authorized, true);
  assert.equal(evaluateReleaseStage({ stage: 'PUBLISH', commitSha, immutabilityDecision: { ...ready, result: 'BLOCKED' }, checkpoint }).reason_code, 'IMMUTABILITY_GATE_NOT_READY');
  assert.equal(evaluateReleaseStage({ stage: 'PUBLISH', commitSha, immutabilityDecision: ready, checkpoint: { ...checkpoint, review_session: 'build-session' } }).reason_code, 'INDEPENDENT_CHECKPOINT_REQUIRED');
});

test('mutable release sources fail closed', () => {
  assert.equal(scanMutableReleaseSources(['releases/download/v3.1.0/assets']).ok, true);
  for (const source of ['refs/heads/main', 'https://raw.githubusercontent.com/o/r/main/file', 'repository/main/assets']) {
    assert.equal(scanMutableReleaseSources([source]).ok, false);
  }
});

test('workflow immutability evaluator reuses the M4 gate and never grants authority', () => {
  const native = evaluateWorkflowImmutabilityGate({
    releaseId: 'release-310', observedAt: '2026-08-05T00:00:00Z',
    providerCapability: 'AVAILABLE', nativeImmutable: true,
  });
  assert.equal(native.result, 'READY');
  assert.equal(native.publish_authorized, false);
  assert.equal(native.authorization_granted, false);
  const blocked = evaluateWorkflowImmutabilityGate({
    releaseId: 'release-310', observedAt: '2026-08-05T00:00:00Z',
    providerCapability: 'UNAVAILABLE', nativeImmutable: false,
  });
  assert.equal(blocked.result, 'BLOCKED');
});

test('evidence index is sanitized and cannot grant authority', () => {
  const evidence = sanitizeEvidenceIndex({
    workflow: 'release', commit_sha: commitSha, generated_at: '2026-08-05T00:00:00Z',
    jobs: [{ id: 'external-reverify', result: 'PASS', evidence_sha256: hash }],
    artifacts: [{ name: 'SHA256SUMS', sha256: 'c'.repeat(64), size: 72 }],
    limitations: ['LOCAL_WORKFLOW_NOT_ACTIVATED'], authorization_granted: true,
  });
  assert.equal(evidence.authorization_granted, false);
  assert.equal(evidence.sanitized, true);
  const sensitiveField = ['access', 'token'].join('_');
  const sensitiveValue = ['not-allowed', 'sensitive-value'].join('-');
  assert.throws(() => sanitizeEvidenceIndex({ ...evidence, [sensitiveField]: sensitiveValue }), /SENSITIVE_FIELD_IN_EVIDENCE/);
  assert.throws(() => sanitizeEvidenceIndex({ ...evidence, limitations: ['/home/user/private'] }), /SENSITIVE_PATH_IN_EVIDENCE|INVALID_EVIDENCE_LIMITATION/);
});
