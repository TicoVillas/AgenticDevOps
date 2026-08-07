import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../canonical-json.mjs';
import { assertImmutableReleaseReference } from '../release.mjs';
import { scanSensitiveEntries } from '../release-security.mjs';

const HASH_RE = /^[a-f0-9]{64}$/;
const COMMIT_RE = /^[a-f0-9]{40}$/;
const ACTION_RE = /^[^\s@]+@[a-f0-9]{40}$/;
const RUNTIME_PREFIXES = Object.freeze([
  'adapters/', 'contracts/', 'core/', 'decisions/', 'examples/', 'generated/',
  'installers/', 'policies/', 'skills/', 'tools/',
]);
const REQUIRED_PACKAGE_FILES = Object.freeze([
  'package.json',
  'framework.lock',
  'PRIVATE-USE-LICENSE.md',
]);
const RUNTIME_FILES = new Set(REQUIRED_PACKAGE_FILES);
const GOVERNANCE_PREFIXES = Object.freeze([
  '.agentic/', '.github/', '.kiro/', 'tests/', 'history/', 'histories/', 'state/',
  'receipts/', 'journals/', 'backups/',
]);
const SENSITIVE_KEY_RE = /(?:^|_)(?:token|secret|password|private_key|signing_key|authorization)(?:$|_)/i;

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function normalizedPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.startsWith('/') || value.includes('\\') || value.includes('\0')) fail('INVALID_PACKAGE_PATH');
  const path = value.replace(/^package\//, '').replace(/^\.\//, '');
  if (path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) fail('INVALID_PACKAGE_PATH', value);
  return path;
}

function isGovernancePath(path) {
  return path === 'AGENTS.md' || GOVERNANCE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isRuntimePath(path) {
  return RUNTIME_FILES.has(path) || RUNTIME_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function validatePackageEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) fail('PACKAGE_ENTRIES_REQUIRED');
  const errors = [];
  const paths = [];
  const seen = new Set();
  for (const entry of entries) {
    let path;
    try { path = normalizedPath(typeof entry === 'string' ? entry : entry?.path); }
    catch (error) { errors.push(error.message); continue; }
    if (seen.has(path)) errors.push(`DUPLICATE_PACKAGE_PATH:${path}`);
    seen.add(path);
    paths.push(path);
    if (isGovernancePath(path)) errors.push(`GOVERNANCE_IN_PACKAGE:${path}`);
    else if (!isRuntimePath(path)) errors.push(`PACKAGE_PATH_OUTSIDE_ALLOWLIST:${path}`);
  }
  for (const required of REQUIRED_PACKAGE_FILES) if (!seen.has(required)) errors.push(`PACKAGE_REQUIRED_PATH_MISSING:${required}`);
  return Object.freeze({ ok: errors.length === 0, errors, file_count: paths.length, paths: Object.freeze(paths.sort()), governance_excluded: !paths.some(isGovernancePath) });
}

export function validateNpmPackReport(report) {
  const record = Array.isArray(report) ? report[0] : report;
  if (!record || !Array.isArray(record.files)) fail('NPM_PACK_REPORT_INVALID');
  return validatePackageEntries(record.files);
}

export function validatePackageConfiguration(document) {
  if (!document || !Array.isArray(document.files)) fail('PACKAGE_FILES_ALLOWLIST_REQUIRED');
  const errors = [];
  const files = document.files.map((path) => String(path));
  for (const required of RUNTIME_PREFIXES) if (!files.includes(required)) errors.push(`PACKAGE_PREFIX_MISSING:${required}`);
  if (!files.includes('framework.lock')) errors.push('PACKAGE_FILE_MISSING:framework.lock');
  for (const path of files) {
    const normalized = path.endsWith('/') ? path : normalizedPath(path);
    if (isGovernancePath(normalized) || normalized === 'tests/' || normalized === '.github/') errors.push(`GOVERNANCE_ALLOWLISTED:${path}`);
  }
  return Object.freeze({ ok: errors.length === 0, errors, entries: files.length });
}

export function collectWorkflowUses(workflow) {
  const uses = [];
  for (const job of Object.values(workflow?.jobs ?? {})) {
    if (typeof job?.uses === 'string') uses.push(job.uses);
    for (const step of job?.steps ?? []) if (typeof step?.uses === 'string') uses.push(step.uses);
  }
  return uses;
}

export function validatePinnedActions(workflow) {
  const errors = [];
  const uses = collectWorkflowUses(workflow);
  for (const reference of uses) if (!reference.startsWith('./') && !ACTION_RE.test(reference)) errors.push(`ACTION_NOT_PINNED:${reference}`);
  return Object.freeze({ ok: errors.length === 0, errors, action_count: uses.length });
}

export function scanMutableReleaseSources(references) {
  if (!Array.isArray(references)) fail('RELEASE_REFERENCES_REQUIRED');
  const errors = [];
  for (const reference of references) {
    try { assertImmutableReleaseReference(reference); }
    catch (error) { errors.push(error.message); }
  }
  return Object.freeze({ ok: errors.length === 0, errors, scanned: references.length });
}

function buildEntry(entry) {
  const path = normalizedPath(entry?.path);
  const bytes = entry?.bytes;
  const sha256 = bytes !== undefined
    ? createHash('sha256').update(Buffer.from(bytes)).digest('hex')
    : entry?.sha256;
  const size = bytes !== undefined ? Buffer.byteLength(Buffer.from(bytes)) : entry?.size;
  if (!HASH_RE.test(sha256 ?? '') || !Number.isSafeInteger(size) || size < 0) fail('INVALID_BUILD_ENTRY', path);
  return { path, sha256, size };
}

export function logicalBuildIdentity(entries) {
  if (!Array.isArray(entries) || entries.length === 0) fail('BUILD_ENTRIES_REQUIRED');
  const normalized = entries.map(buildEntry).sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(normalized.map(({ path }) => path)).size !== normalized.length) fail('DUPLICATE_BUILD_PATH');
  return Object.freeze({ files: normalized.length, logical_sha256: canonicalSha256(normalized), entries: Object.freeze(normalized) });
}

export function compareDualBuilds(first, second) {
  const left = logicalBuildIdentity(first);
  const right = logicalBuildIdentity(second);
  const equivalent = left.logical_sha256 === right.logical_sha256;
  return Object.freeze({ ok: equivalent, result: equivalent ? 'EQUIVALENT' : 'BLOCKED_REPRODUCIBILITY_DRIFT', first: left.logical_sha256, second: right.logical_sha256, files: left.files });
}

function checkpointValid(checkpoint, commitSha) {
  return checkpoint?.status === 'APPROVED'
    && checkpoint?.independent === true
    && checkpoint?.commit_sha === commitSha
    && checkpoint?.build_session !== checkpoint?.review_session
    && HASH_RE.test(checkpoint?.evidence_sha256 ?? '')
    && HASH_RE.test(checkpoint?.authorization_sha256 ?? '');
}

export function evaluateReleaseStage({ stage, commitSha, immutabilityDecision, checkpoint }) {
  if (!['DRAFT', 'REVIEW', 'PUBLISH'].includes(stage)) fail('INVALID_RELEASE_STAGE');
  if (!COMMIT_RE.test(commitSha ?? '')) fail('INVALID_COMMIT_SHA');
  const base = { stage, commit_sha: commitSha, authorization_granted: false, publish_authorized: false };
  if (stage !== 'PUBLISH') return Object.freeze({ ...base, result: 'READY_WITHOUT_PUBLICATION_AUTHORITY', reason_code: 'STAGE_DOES_NOT_AUTHORIZE_PUBLISH' });
  if (immutabilityDecision?.result !== 'READY' || immutabilityDecision?.publish_authorized !== false || immutabilityDecision?.checkpoint_required !== true) {
    return Object.freeze({ ...base, result: 'BLOCKED', reason_code: 'IMMUTABILITY_GATE_NOT_READY' });
  }
  if (!checkpointValid(checkpoint, commitSha)) return Object.freeze({ ...base, result: 'BLOCKED', reason_code: 'INDEPENDENT_CHECKPOINT_REQUIRED' });
  return Object.freeze({ ...base, result: 'READY', authorization_granted: true, publish_authorized: true, reason_code: 'EXPLICIT_INDEPENDENT_CHECKPOINT' });
}

function inspectSensitiveShape(value, path = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => inspectSensitiveShape(item, `${path}[${index}]`));
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && (value.startsWith('/') || /(?:^|\/)home\//.test(value))) fail('SENSITIVE_PATH_IN_EVIDENCE', path);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY_RE.test(key) && key !== 'authorization_granted') fail('SENSITIVE_FIELD_IN_EVIDENCE', `${path}.${key}`);
    inspectSensitiveShape(child, `${path}.${key}`);
  }
}

export function sanitizeEvidenceIndex(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('EVIDENCE_INDEX_REQUIRED');
  inspectSensitiveShape(input);
  const scan = scanSensitiveEntries([{ path: 'ci-evidence-index.json', bytes: Buffer.from(JSON.stringify(input)) }]);
  if (!scan.ok) fail('SENSITIVE_CONTENT_IN_EVIDENCE', scan.findings[0].code);
  if (!COMMIT_RE.test(input.commit_sha ?? '')) fail('INVALID_COMMIT_SHA');
  if (!['pr', 'release'].includes(input.workflow)) fail('INVALID_EVIDENCE_WORKFLOW');
  const jobs = (input.jobs ?? []).map((job) => {
    if (!/^[a-z][a-z0-9_-]{1,63}$/.test(job?.id ?? '') || !['PASS', 'BLOCKED', 'SKIPPED'].includes(job?.result) || !HASH_RE.test(job?.evidence_sha256 ?? '')) fail('INVALID_EVIDENCE_JOB');
    return { id: job.id, result: job.result, evidence_sha256: job.evidence_sha256 };
  });
  const artifacts = (input.artifacts ?? []).map((artifact) => {
    const name = normalizedPath(artifact?.name);
    if (name.includes('/')) fail('EVIDENCE_ARTIFACT_BASENAME_REQUIRED', name);
    if (!HASH_RE.test(artifact?.sha256 ?? '') || !Number.isSafeInteger(artifact?.size) || artifact.size < 0) fail('INVALID_EVIDENCE_ARTIFACT', name);
    return { name, sha256: artifact.sha256, size: artifact.size };
  });
  const limitations = (input.limitations ?? []).map((value) => {
    if (!/^[A-Z][A-Z0-9_]{2,63}$/.test(value)) fail('INVALID_EVIDENCE_LIMITATION');
    return value;
  });
  if (!jobs.length) fail('EVIDENCE_JOBS_REQUIRED');
  return Object.freeze({
    schema_version: 1,
    workflow: input.workflow,
    commit_sha: input.commit_sha,
    generated_at: input.generated_at,
    jobs,
    artifacts,
    limitations,
    authorization_granted: false,
    sanitized: true,
  });
}
