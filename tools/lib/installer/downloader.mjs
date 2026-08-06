import { relative, resolve, sep } from 'node:path';
import {
  assertExactReleaseIdentity,
  assertImmutableReleaseReference,
  sha256Bytes,
  validateReleaseAssetName,
} from '../release.mjs';
import { sanitizeMessage } from '../lifecycle/cli.mjs';

export const DOWNLOAD_ADAPTERS = Object.freeze(['GH_AUTHENTICATED', 'API_FINE_GRAINED_READ_ONLY', 'OFFLINE_BUNDLE']);
const HASH_RE = /^[a-f0-9]{64}$/;

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function contained(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith('/') && rel !== '';
}

function asBytes(value, code) {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail(code);
  return Buffer.from(value);
}

function validateIdentity(identity) {
  assertExactReleaseIdentity(identity, identity);
  return Object.freeze({
    release_id: identity.release_id,
    version: identity.version,
    tag: identity.tag,
    commit_sha: identity.commit_sha,
    repository: identity.repository,
  });
}

function normalizeAssetIdentity(asset) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) fail('ASSET_IDENTITY_REQUIRED');
  const name = validateReleaseAssetName(asset.name);
  if (!HASH_RE.test(asset.sha256 ?? '')) fail('INVALID_ASSET_SHA256', name);
  if (!Number.isSafeInteger(asset.size) || asset.size < 0) fail('INVALID_ASSET_SIZE', name);
  return Object.freeze({ name, sha256: asset.sha256, size: asset.size });
}

export function validateDownloadRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) fail('DOWNLOAD_REQUEST_REQUIRED');
  const identity = validateIdentity(request.identity);
  const reference = assertImmutableReleaseReference(request.reference);
  if (!(reference === identity.tag || reference.includes(`/${identity.tag}/`))) fail('RELEASE_REFERENCE_TAG_MISMATCH');
  if (!Array.isArray(request.asset_identities) || request.asset_identities.length === 0) fail('ASSET_IDENTITIES_REQUIRED');
  const assetIdentities = request.asset_identities.map(normalizeAssetIdentity);
  const names = new Set();
  for (const asset of assetIdentities) {
    if (names.has(asset.name)) fail('DUPLICATE_ASSET_IDENTITY', asset.name);
    names.add(asset.name);
  }
  const roles = request.artifact_roles;
  if (!roles || typeof roles !== 'object' || Array.isArray(roles)) fail('ARTIFACT_ROLES_REQUIRED');
  for (const role of ['manifest', 'manifest_signature', 'checksums', 'checksums_signature', 'trust_store', 'payload_archive']) {
    validateReleaseAssetName(roles[role]);
    if (!names.has(roles[role])) fail('ARTIFACT_IDENTITY_MISSING', role);
  }
  return Object.freeze({
    identity,
    reference,
    asset_identities: Object.freeze(assetIdentities),
    artifact_roles: Object.freeze({ ...roles }),
  });
}

function sanitizeFailure(error, sensitivePaths = []) {
  const withoutHeaders = String(error?.message ?? error).replace(/\b(?:authorization|proxy-authorization|x-[a-z0-9-]*(?:token|auth)[a-z0-9-]*)\s*:\s*[^\r\n]*/gi, '[REDACTED_HEADER]');
  let message = sanitizeMessage(withoutHeaders);
  for (const path of sensitivePaths) {
    if (typeof path === 'string' && path.length > 0) message = message.replaceAll(path, '[REDACTED_PATH]');
  }
  const code = String(error?.code ?? error?.message ?? 'DOWNLOAD_FAILED').split(':', 1)[0].replace(/[^A-Z0-9_]/gi, '_').toUpperCase();
  const safe = new Error(`${code}:${message}`);
  safe.code = code;
  return safe;
}

function decodeOfflineBundle(bytes) {
  let document;
  try { document = JSON.parse(asBytes(bytes, 'OFFLINE_BUNDLE_BYTES_REQUIRED').toString('utf8')); }
  catch { fail('OFFLINE_BUNDLE_INVALID'); }
  if (document?.schema_version !== 1 || !document.identity || !Array.isArray(document.artifacts)) fail('OFFLINE_BUNDLE_INVALID');
  const artifacts = document.artifacts.map((asset) => {
    if (typeof asset?.name !== 'string' || typeof asset?.bytes_base64 !== 'string') fail('OFFLINE_BUNDLE_INVALID');
    const bytesValue = Buffer.from(asset.bytes_base64, 'base64');
    if (bytesValue.toString('base64') !== asset.bytes_base64) fail('OFFLINE_BUNDLE_INVALID');
    return { name: asset.name, bytes: bytesValue };
  });
  return { identity: document.identity, artifacts };
}

export function encodeOfflineBundle(download) {
  return Buffer.from(`${JSON.stringify({
    schema_version: 1,
    identity: download.identity,
    artifacts: download.artifacts.map(({ name, bytes }) => ({ name, bytes_base64: asBytes(bytes, 'ASSET_BYTES_REQUIRED').toString('base64') })),
  })}\n`, 'utf8');
}

function assertDownloadedArtifacts(download, request) {
  assertExactReleaseIdentity(download.identity, request.identity);
  if (!Array.isArray(download.artifacts)) fail('DOWNLOADED_ASSETS_REQUIRED');
  const expected = new Map(request.asset_identities.map((asset) => [asset.name, asset]));
  const observed = new Set();
  const artifacts = download.artifacts.map((asset) => {
    const name = validateReleaseAssetName(asset?.name);
    if (observed.has(name)) fail('DUPLICATE_DOWNLOADED_ASSET', name);
    observed.add(name);
    const binding = expected.get(name);
    if (!binding) fail('UNEXPECTED_DOWNLOADED_ASSET', name);
    const bytes = asBytes(asset.bytes, `ASSET_BYTES_REQUIRED:${name}`);
    if (bytes.length !== binding.size) fail('ASSET_SIZE_MISMATCH', name);
    if (sha256Bytes(bytes) !== binding.sha256) fail('ASSET_HASH_MISMATCH', name);
    return Object.freeze({ name, bytes });
  });
  for (const name of expected.keys()) if (!observed.has(name)) fail('MISSING_DOWNLOADED_ASSET', name);
  return Object.freeze({ identity: request.identity, artifacts: Object.freeze(artifacts), artifact_roles: request.artifact_roles });
}

export function createDownloader({ adapter, transport, emit = () => {} }) {
  if (!DOWNLOAD_ADAPTERS.includes(adapter)) fail('DOWNLOAD_ADAPTER_UNSUPPORTED');
  if (!transport || typeof transport !== 'object') fail('INJECTED_TRANSPORT_REQUIRED');
  return Object.freeze({
    adapter,
    async download(input) {
      const sensitivePaths = [input?.bundle_path, input?.staging_root].filter(Boolean);
      try {
        const request = validateDownloadRequest(input);
        let downloaded;
        if (adapter === 'OFFLINE_BUNDLE') {
          if (typeof transport.inspectLocalBundle !== 'function' || typeof transport.readLocalBundle !== 'function') fail('LOCAL_BUNDLE_READER_REQUIRED');
          if (!input.bundle_path || !input.staging_root || !contained(input.staging_root, input.bundle_path)) fail('OFFLINE_BUNDLE_OUTSIDE_STAGING');
          const inspection = await transport.inspectLocalBundle({ bundle_path: input.bundle_path });
          if (inspection?.type !== 'REGULAR_FILE' || typeof inspection.resolved_path !== 'string' || !contained(input.staging_root, inspection.resolved_path)) fail('OFFLINE_BUNDLE_OUTSIDE_STAGING');
          downloaded = decodeOfflineBundle(await transport.readLocalBundle({ bundle_path: input.bundle_path }));
        } else {
          if (typeof transport.readExactRelease !== 'function' || typeof transport.readExactAsset !== 'function') fail('INJECTED_TRANSPORT_METHODS_REQUIRED');
          const observedIdentity = await transport.readExactRelease({ identity: request.identity, reference: request.reference });
          assertExactReleaseIdentity(observedIdentity, request.identity);
          const artifacts = [];
          for (const asset of request.asset_identities) {
            const bytes = await transport.readExactAsset({ identity: request.identity, asset_identity: asset });
            artifacts.push({ name: asset.name, bytes: asBytes(bytes, `ASSET_BYTES_REQUIRED:${asset.name}`) });
          }
          downloaded = { identity: observedIdentity, artifacts };
        }
        const result = assertDownloadedArtifacts(downloaded, request);
        emit(Object.freeze({ event: 'DOWNLOAD_COMPLETED', adapter, release_id: request.identity.release_id, sanitized: true }));
        return result;
      } catch (error) {
        const safe = sanitizeFailure(error, sensitivePaths);
        emit(Object.freeze({ event: 'DOWNLOAD_BLOCKED', adapter, reason_code: safe.code, message: safe.message, sanitized: true }));
        throw safe;
      }
    },
  });
}

export const createGhAuthenticatedDownloader = (options) => createDownloader({ ...options, adapter: 'GH_AUTHENTICATED' });
export const createApiFineGrainedReadOnlyDownloader = (options) => createDownloader({ ...options, adapter: 'API_FINE_GRAINED_READ_ONLY' });
export const createOfflineBundleDownloader = (options) => createDownloader({ ...options, adapter: 'OFFLINE_BUNDLE' });
