import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../canonical-json.mjs';
import { reasonCode, sanitizeMessage } from './cli.mjs';

const digest = (value) => createHash('sha256').update(String(value)).digest('hex');
const HASH = /^[a-f0-9]{64}$/;
const LOGICAL_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)(?!.*\0)[^\r\n]+$/;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function safeLogicalPath(value) {
  if (value == null) return null;
  const path = String(value);
  return LOGICAL_PATH.test(path) ? path.slice(0, 256) : '[REDACTED]';
}

function safeHashes(value = {}) {
  const result = {};
  for (const [name, hash] of Object.entries(value).sort(([left], [right]) => left.localeCompare(right))) {
    if (/^[a-z][a-z0-9_]{0,63}$/.test(name) && HASH.test(hash)) result[name] = hash;
  }
  return result;
}

export function createLifecycleEventRecorder({ operationId, operationClass, clock = () => new Date() }) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/.test(operationId ?? '')) fail('INVALID_OPERATION_ID');
  const events = [];
  return Object.freeze({
    record({ type, status, reason = null, causalEventId = null, artifactHashes = {}, logicalPath = null, contentSha256 = null } = {}) {
      const sequence = events.length + 1;
      const event = Object.freeze({
        sequence,
        event_id: `event-${digest(`${operationId}:${sequence}`).slice(0, 24)}`,
        timestamp: clock().toISOString(),
        type,
        status,
        reason_code: reason == null ? null : reasonCode({ code: reason }),
        causal_event_id: causalEventId,
        artifact_hashes: safeHashes(artifactHashes),
        logical_path: safeLogicalPath(logicalPath),
        hash_prefix: HASH.test(contentSha256 ?? '') ? contentSha256.slice(0, 12) : null,
      });
      events.push(event);
      return event;
    },
    build({ limitations = [], operationsNotAuthorized = ['REAL_GLOBAL_WRITE', 'HOME_ACCESS', 'NETWORK', 'GIT'] } = {}) {
      if (events.length === 0) fail('LIFECYCLE_EVENT_REQUIRED');
      return Object.freeze({
        schema_version: 1,
        operation_id: operationId,
        operation_class: operationClass,
        sanitized: true,
        events: [...events],
        limitations: limitations.map((value) => sanitizeMessage(value)),
        operations_not_authorized: [...new Set(operationsNotAuthorized.map((value) => reasonCode({ code: value })))],
      });
    },
  });
}

export function buildLifecycleEventLogFromJournal({ operationId, operationClass, journal, clock = () => new Date(), limitations = [] }) {
  if (!journal || !Array.isArray(journal.entries)) fail('JOURNAL_REQUIRED');
  const recorder = createLifecycleEventRecorder({ operationId, operationClass, clock });
  recorder.record({ type: 'PLAN', status: 'PASS', artifactHashes: { journal: canonicalSha256(journal) } });
  for (const entry of [...journal.entries].sort((left, right) => left.sequence - right.sequence)) {
    const status = ['VERIFIED'].includes(entry.state) ? 'COMPLETED'
      : ['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN', 'NO_EFFECT'].includes(entry.state) ? entry.state
        : entry.state === 'FAILED_KNOWN' ? 'BLOCKED'
          : 'PLANNED';
    recorder.record({
      type: entry.action === 'SELF_UPDATE' ? 'SELF_UPDATE' : entry.action === 'BACKUP_RETIRE' ? 'WRITE' : 'VERIFY',
      status,
      reason: entry.error_code,
      logicalPath: entry.path,
      contentSha256: entry.after_sha256 ?? entry.before_sha256,
    });
  }
  recorder.record({
    type: 'STOP',
    status: ['PARTIAL_KNOWN', 'PARTIAL', 'UNKNOWN', 'NO_EFFECT'].includes(journal.status) ? journal.status : journal.status === 'FAILED_KNOWN' ? 'BLOCKED' : 'COMPLETED',
    reason: journal.status === 'FAILED_KNOWN' ? 'FAILED_KNOWN' : null,
  });
  return recorder.build({ limitations });
}

export function buildLifecycleEvidenceIndex({ evidenceId, commitSha, createdAt, artifacts, limitations = [] }) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/.test(evidenceId ?? '')) fail('INVALID_EVIDENCE_ID');
  if (!/^[a-f0-9]{40}$/.test(commitSha ?? '')) fail('EXPLICIT_COMMIT_BINDING_REQUIRED');
  if (!Array.isArray(artifacts) || artifacts.length === 0) fail('EVIDENCE_ARTIFACTS_REQUIRED');
  const entries = artifacts.map((artifact) => {
    if (!artifact?.id || !['BUILD', 'TEST', 'VALIDATION', 'HOST', 'RELEASE', 'LIMITATION'].includes(artifact.kind)) fail('INVALID_EVIDENCE_ARTIFACT');
    return Object.freeze({
      id: String(artifact.id),
      kind: artifact.kind,
      result: artifact.result,
      sha256: artifact.sha256 ?? canonicalSha256(artifact.document),
      ...(artifact.uri ? { uri: sanitizeMessage(artifact.uri) } : {}),
    });
  }).sort((left, right) => left.id.localeCompare(right.id));
  return Object.freeze({
    schema_version: 1,
    evidence_id: evidenceId,
    commit_sha: commitSha,
    created_at: new Date(createdAt).toISOString(),
    entries,
    limitations: limitations.map((value) => sanitizeMessage(value)),
    sanitized: true,
  });
}
