import { lstat, readFile, readdir } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';

const PRIVATE_MARKER = ['-----BEGIN ', '(?:OPENSSH |RSA |EC |DSA )?', 'PRIVATE KEY-----'].join('');
const PRIVATE_MARKER_RE = new RegExp(PRIVATE_MARKER, 'g');
const OPENSSH_MAGIC = Buffer.from(['openssh', '-key-v1\0'].join(''), 'utf8');
const SENSITIVE_FILENAME_RE = /(?:^|\/)(?:id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:key|p12|pfx|jks|keystore|kdbx))$/i;
const TOKEN_PATTERNS = Object.freeze([
  ['GITHUB_TOKEN', new RegExp(['(?:gh[pousr]_', '[A-Za-z0-9]{36,})|(?:github_pat_', '[A-Za-z0-9_]{40,})'].join(''), 'g')],
  ['NPM_TOKEN', new RegExp(['npm_', '[A-Za-z0-9]{36,}'].join(''), 'g')],
  ['AWS_ACCESS_KEY', new RegExp(['(?:AKIA|ASIA)', '[A-Z0-9]{16}'].join(''), 'g')],
  ['JWT_TOKEN', new RegExp(['eyJ[A-Za-z0-9_-]{10,}', '\\.[A-Za-z0-9_-]{10,}', '\\.[A-Za-z0-9_-]{10,}'].join(''), 'g')],
]);
const ASSIGNMENT_RE = /(?:access[_-]?token|auth[_-]?token|client[_-]?secret|private[_-]?key|signing[_-]?key|password)\s*[:=]\s*["']([^"'\r\n]{12,})["']/gi;

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function slash(path) {
  return path.split(sep).join('/');
}

function finding(path, code, severity = 'CRITICAL') {
  return Object.freeze({ path, code, severity, content_included: false });
}

function looksTestOnly(path, text, prefix) {
  return path.startsWith(`${prefix}/`) && /(?:"classification"\s*:\s*"TEST_ONLY"|classification\s*:\s*TEST_ONLY)/.test(text) && /(?:"synthetic"\s*:\s*true|synthetic\s*:\s*true)/.test(text);
}

export function scanSensitiveEntries(entries, { testFixturePrefix = 'tests/fixtures/release-crypto', permitLabeledSynthetic = false } = {}) {
  if (!Array.isArray(entries)) fail('SCAN_ENTRIES_REQUIRED');
  const findings = [];
  const allowedTestMaterial = [];
  const seen = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry.path !== 'string' || (!Buffer.isBuffer(entry.bytes) && !(entry.bytes instanceof Uint8Array))) fail('INVALID_SCAN_ENTRY');
    const path = slash(entry.path);
    if (seen.has(path)) fail('DUPLICATE_SCAN_PATH', path);
    seen.add(path);
    const bytes = Buffer.from(entry.bytes);
    const text = bytes.toString('utf8');
    const labeledSynthetic = permitLabeledSynthetic && looksTestOnly(path, text, testFixturePrefix);
    const codes = new Set();
    if (SENSITIVE_FILENAME_RE.test(path)) codes.add('SENSITIVE_KEY_FILENAME');
    PRIVATE_MARKER_RE.lastIndex = 0;
    if (PRIVATE_MARKER_RE.test(text) || bytes.includes(OPENSSH_MAGIC)) codes.add('PRIVATE_KEY_MATERIAL');
    for (const [code, pattern] of TOKEN_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) codes.add(code);
    }
    ASSIGNMENT_RE.lastIndex = 0;
    if (ASSIGNMENT_RE.test(text)) codes.add('LITERAL_SECRET_ASSIGNMENT');
    for (const code of codes) {
      if (labeledSynthetic && ['SENSITIVE_KEY_FILENAME', 'PRIVATE_KEY_MATERIAL'].includes(code)) allowedTestMaterial.push(finding(path, `ALLOWED_TEST_ONLY_${code}`, 'TEST_ONLY'));
      else findings.push(finding(path, code));
    }
  }
  findings.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code));
  allowedTestMaterial.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code));
  return Object.freeze({ ok: findings.length === 0, scanned: entries.length, findings, allowed_test_material: allowedTestMaterial });
}

export async function scanSensitiveTree(root, { exclude = ['node_modules'], testFixturePrefix = 'tests/fixtures/release-crypto', permitLabeledSynthetic = false } = {}) {
  const base = resolve(root);
  const entries = [];
  const excluded = exclude.map((value) => slash(value));
  async function visit(directory) {
    for (const name of (await readdir(directory)).sort()) {
      const path = resolve(directory, name);
      const rel = slash(relative(base, path));
      if (excluded.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) continue;
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) fail('SCAN_SYMLINK_REJECTED', rel);
      if (metadata.isDirectory()) await visit(path);
      else if (metadata.isFile()) entries.push({ path: rel, bytes: await readFile(path) });
      else fail('SCAN_UNEXPECTED_FILE_TYPE', rel);
    }
  }
  await visit(base);
  return scanSensitiveEntries(entries, { testFixturePrefix, permitLabeledSynthetic });
}

function instant(value, code) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) fail(code);
  return timestamp;
}

function blocked(releaseId, observedAt, providerCapability, reasonCode) {
  return Object.freeze({
    schema_version: 1,
    release_id: releaseId,
    observed_at: observedAt,
    provider_capability: providerCapability,
    mode: 'NONE',
    native_immutable: false,
    result: 'BLOCKED',
    reason_code: reasonCode,
    publish_authorized: false,
    checkpoint_required: true,
  });
}

function validateCompensatingControl(control, { releaseId, observedAt, expectedAuthorizationSha256 }) {
  if (!control || typeof control !== 'object' || Array.isArray(control)) fail('COMPENSATING_CONTROL_REQUIRED');
  if (control.release_id !== releaseId) fail('COMPENSATING_CONTROL_RELEASE_MISMATCH');
  if (control.approval_status !== 'EXPLICITLY_APPROVED') fail('COMPENSATING_CONTROL_NOT_EXPLICITLY_APPROVED');
  if (!control.approval_authority || control.approval_authority.authorization_sha256 !== expectedAuthorizationSha256) fail('COMPENSATING_CONTROL_AUTHORIZATION_MISMATCH');
  if (!/^[a-f0-9]{64}$/.test(expectedAuthorizationSha256 ?? '')) fail('CURRENT_AUTHORIZATION_REQUIRED');
  const observed = instant(observedAt, 'INVALID_IMMUTABILITY_OBSERVED_AT');
  if (instant(control.approved_at, 'INVALID_CONTROL_APPROVED_AT') > observed) fail('COMPENSATING_CONTROL_NOT_YET_APPROVED');
  if (control.expires_at !== undefined && instant(control.expires_at, 'INVALID_CONTROL_EXPIRY') <= observed) fail('COMPENSATING_CONTROL_EXPIRED');
  if (!/^[a-f0-9]{64}$/.test(control.evidence_sha256 ?? '')) fail('COMPENSATING_CONTROL_EVIDENCE_REQUIRED');
  return true;
}

export function evaluateImmutabilityGate({ releaseId, observedAt, providerCapability, nativeImmutable, compensatingControl, expectedAuthorizationSha256 }) {
  if (typeof releaseId !== 'string' || releaseId.length < 3) fail('RELEASE_ID_REQUIRED');
  instant(observedAt, 'INVALID_IMMUTABILITY_OBSERVED_AT');
  if (!['AVAILABLE', 'UNAVAILABLE', 'UNKNOWN'].includes(providerCapability)) fail('INVALID_PROVIDER_CAPABILITY');
  if (providerCapability === 'AVAILABLE' && nativeImmutable === true) {
    return Object.freeze({
      schema_version: 1,
      release_id: releaseId,
      observed_at: observedAt,
      provider_capability: 'AVAILABLE',
      mode: 'NATIVE_IMMUTABLE',
      native_immutable: true,
      result: 'READY',
      publish_authorized: false,
      checkpoint_required: true,
    });
  }
  if (providerCapability === 'UNAVAILABLE' && nativeImmutable === false && compensatingControl !== undefined) {
    try {
      validateCompensatingControl(compensatingControl, { releaseId, observedAt, expectedAuthorizationSha256 });
      return Object.freeze({
        schema_version: 1,
        release_id: releaseId,
        observed_at: observedAt,
        provider_capability: 'UNAVAILABLE',
        mode: 'COMPENSATING_CONTROL',
        native_immutable: false,
        compensating_control: structuredClone(compensatingControl),
        result: 'READY',
        publish_authorized: false,
        checkpoint_required: true,
      });
    } catch (error) {
      return blocked(releaseId, observedAt, providerCapability, error.message.split(':', 1)[0]);
    }
  }
  const reason = providerCapability === 'UNKNOWN'
    ? 'IMMUTABILITY_UNAVAILABLE'
    : providerCapability === 'AVAILABLE'
      ? 'NATIVE_IMMUTABILITY_NOT_OBSERVED'
      : 'COMPENSATING_CONTROL_REQUIRED';
  return blocked(releaseId, observedAt, providerCapability, reason);
}

export function evaluateKeyIncidentHardStop(incident) {
  if (!incident || incident.hard_stop !== true || incident.publish_authorized !== false) fail('INVALID_KEY_INCIDENT');
  return Object.freeze({ result: 'BLOCKED', reason_code: 'COMPROMISED_KEY_HARD_STOP', signing_authorized: false, publish_authorized: false });
}
