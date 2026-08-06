import { constants } from 'node:fs';
import { lstat, open, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import { canonicalSha256 } from '../canonical-json.mjs';
import { parseLifecycleArgs, sanitizeMessage } from '../lifecycle/cli.mjs';
import { assertExactReleaseIdentity, assertImmutableReleaseReference } from '../release.mjs';
import { createOfflineBundleDownloader } from './downloader.mjs';
import { validateInstallerStaging, verifyBeforeExtract } from './staging.mjs';

const FLAGS = new Set(['--adapter', '--operation', '--release-id', '--release-version', '--release-tag', '--release-commit', '--repository', '--release-reference', '--source', '--destination', '--state', '--cache', '--temp', '--operation-id', '--authorization', '--staging', '--bundle', '--request']);
const REQUIRED = ['adapter', 'operation', 'release_id', 'release_version', 'release_tag', 'release_commit', 'repository', 'release_reference', 'destination', 'state', 'cache', 'temp', 'operation_id'];
const verificationCapabilities = new WeakSet();

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function contained(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith('/');
}

async function inspectStagingFile(stagingRoot, path) {
  if (!isAbsolute(path) || resolve(path) !== path || !contained(stagingRoot, path)) fail('OFFLINE_FILE_OUTSIDE_STAGING');
  const direct = await lstat(path);
  if (!direct.isFile() || direct.isSymbolicLink()) fail('OFFLINE_FILE_NOT_REGULAR');
  const resolvedPath = await realpath(path);
  if (!contained(stagingRoot, resolvedPath)) fail('OFFLINE_FILE_OUTSIDE_STAGING');
  const observed = await lstat(resolvedPath);
  if (!observed.isFile() || observed.isSymbolicLink()) fail('OFFLINE_FILE_NOT_REGULAR');
  if (typeof process.getuid === 'function') {
    if (observed.uid !== process.getuid()) fail('OFFLINE_FILE_NOT_OWNED');
    if ((observed.mode & 0o077) !== 0) fail('OFFLINE_FILE_MODE_INVALID');
  }
  return Object.freeze({ type: 'REGULAR_FILE', resolved_path: resolvedPath, dev: observed.dev, ino: observed.ino });
}

async function readStagingFile(stagingRoot, path) {
  const inspected = await inspectStagingFile(stagingRoot, path);
  const handle = await open(inspected.resolved_path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const observed = await handle.stat();
    if (!observed.isFile() || observed.dev !== inspected.dev || observed.ino !== inspected.ino) fail('OFFLINE_FILE_CHANGED_DURING_READ');
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function readOfflineRequest(stagingRoot, requestPath) {
  let document;
  try { document = JSON.parse((await readStagingFile(stagingRoot, requestPath)).toString('utf8')); }
  catch (error) { if (error?.code) throw error; fail('OFFLINE_REQUEST_INVALID'); }
  if (!document || document.schema_version !== 1 || !document.request || typeof document.verification_at !== 'string' || !Number.isFinite(Date.parse(document.verification_at))) fail('OFFLINE_REQUEST_INVALID');
  const allowed = new Set(['schema_version', 'verification_at', 'request']);
  if (Object.keys(document).some((key) => !allowed.has(key))) fail('OFFLINE_REQUEST_INVALID');
  return Object.freeze({ request: document.request, at: document.verification_at });
}

function failureResult(error, status = 'BLOCKED') {
  const reason = String(error?.code ?? error?.message ?? 'INSTALLER_BOOTSTRAP_FAILED').split(':', 1)[0].replace(/[^A-Z0-9_]/gi, '_').toUpperCase();
  return Object.freeze({
    schema_version: 1,
    ok: false,
    status,
    reason_code: reason,
    exit_code: 3,
    handoff: null,
    errors: [{ code: reason, message: sanitizeMessage(error?.message ?? error) }],
    sanitized: true,
  });
}

function transportRequiredResult() {
  return failureResult(Object.assign(new Error('TRANSPORT_INJECTION_REQUIRED'), { code: 'TRANSPORT_INJECTION_REQUIRED' }));
}

export function runtimeCapability(version = process.versions.node) {
  const major = Number.parseInt(String(version).split('.')[0], 10);
  return Object.freeze(major === 24
    ? { ok: true, status: 'READY', reason_code: null, required_node_major: 24 }
    : { ok: false, status: 'NEEDS_STATE_VALIDATION', reason_code: 'RUNTIME_UNSUPPORTED', required_node_major: 24 });
}

export function parseInstallerArgs(argv) {
  if (!Array.isArray(argv)) fail('INVALID_ARGUMENT_VECTOR');
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!FLAGS.has(flag)) fail('UNKNOWN_OPTION', flag);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) fail('MISSING_OPTION_VALUE', flag);
    index += 1;
    const key = flag.slice(2).replaceAll('-', '_');
    if (Object.hasOwn(values, key)) fail('DUPLICATE_OPTION', flag);
    values[key] = value;
  }
  for (const key of REQUIRED) if (!values[key]) fail('MISSING_REQUIRED_OPTION', key);
  if (!['BASH', 'POWERSHELL'].includes(values.adapter)) fail('INVALID_PLATFORM_ADAPTER');
  if (!['install', 'update'].includes(values.operation)) fail('INVALID_INSTALLER_OPERATION');
  for (const key of ['source', 'destination', 'state', 'cache', 'temp', 'authorization', 'staging', 'bundle', 'request']) {
    if (values[key] !== undefined && (!isAbsolute(values[key]) || resolve(values[key]) !== values[key])) fail('INVALID_ABSOLUTE_PATH', key);
  }
  return Object.freeze(values);
}

function identityFrom(values) {
  const identity = Object.freeze({
    release_id: values.release_id,
    version: values.release_version,
    tag: values.release_tag,
    commit_sha: values.release_commit,
    repository: values.repository,
  });
  assertExactReleaseIdentity(identity, identity);
  const reference = assertImmutableReleaseReference(values.release_reference);
  if (!(reference === identity.tag || reference.includes(`/${identity.tag}/`))) fail('RELEASE_REFERENCE_TAG_MISMATCH');
  return identity;
}

function lifecycleBase(values) {
  return ['--source', values.source, '--destination', values.destination, '--state', values.state, '--cache', values.cache, '--temp', values.temp, '--operation-id', values.operation_id, '--format', 'json'];
}

function createVerificationCapability(verification, identity) {
  if (!verification || !Object.isFrozen(verification) || verification.method !== 'VERIFY_BEFORE_EXTRACT') fail('VERIFICATION_RESULT_INVALID');
  if (verification.release_identity_sha256 !== canonicalSha256(identity)) fail('VERIFICATION_IDENTITY_MISMATCH');
  if (!Number.isSafeInteger(verification.file_count) || verification.file_count < 1) fail('VERIFICATION_FILE_COUNT_INVALID');
  if (!isAbsolute(verification.staging_root) || resolve(verification.staging_root) !== verification.staging_root) fail('VERIFICATION_STAGING_ROOT_INVALID');
  if (!isAbsolute(verification.payload_root) || resolve(verification.payload_root) !== verification.payload_root || !contained(verification.staging_root, verification.payload_root)) fail('VERIFICATION_PAYLOAD_ROOT_INVALID');
  if (!/^[a-f0-9]{64}$/.test(verification.manifest_sha256)) fail('VERIFICATION_MANIFEST_HASH_INVALID');
  const capability = Object.freeze({ verification });
  verificationCapabilities.add(capability);
  return capability;
}

export function createInstallerHandoff(values, capability) {
  const runtime = runtimeCapability();
  if (!runtime.ok) fail(runtime.reason_code);
  if (!capability || !verificationCapabilities.delete(capability)) fail('VERIFICATION_CAPABILITY_REQUIRED');
  const identity = identityFrom(values);
  const verification = capability.verification;
  if (values.source !== verification.payload_root) fail('VERIFIED_SOURCE_MISMATCH');
  if (verification.release_identity_sha256 !== canonicalSha256(identity)) fail('VERIFICATION_IDENTITY_MISMATCH');
  const base = lifecycleBase(values);
  const inspect = ['inspect-state', ...base];
  const plan = [values.operation, ...base];
  parseLifecycleArgs(inspect);
  parseLifecycleArgs(plan);
  let applyArgv = null;
  if (values.authorization) {
    applyArgv = [values.operation, ...base, '--apply', '--authorization', values.authorization];
    parseLifecycleArgs(applyArgv);
  }
  return Object.freeze({
    schema_version: 1,
    adapter: values.adapter,
    platform_validation: values.adapter === 'BASH' ? 'SYNTHETICALLY_VALIDATED' : 'PROJECTED',
    status: 'READY_FOR_INSPECT_AND_PLAN',
    release_identity: identity,
    verification,
    operation: values.operation,
    lifecycle: Object.freeze({
      cli: 'tools/lifecycle-cli.mjs',
      inspect_argv: Object.freeze(inspect),
      plan_argv: Object.freeze(plan),
      apply_argv: applyArgv ? Object.freeze(applyArgv) : null,
    }),
    bindings: Object.freeze({
      release_identity_sha256: canonicalSha256(identity),
      source: values.source,
      destination: values.destination,
      state: values.state,
      cache: values.cache,
      temp: values.temp,
      operation_id: values.operation_id,
    }),
    decisions: Object.freeze({
      exact_release: true,
      payload_verification_required: true,
      apply_authorized: Boolean(values.authorization),
      wrapper_executes_apply: false,
      direct_global_write: false,
    }),
    stops: Object.freeze(['VERIFY_BEFORE_EXTRACT', 'LIFECYCLE_INSPECT', 'LIFECYCLE_PLAN', 'EXPLICIT_APPLY_AUTHORIZATION']),
    receipt_semantics: Object.freeze({ producer: 'tools/lifecycle-cli.mjs', namespace: 'GLOBAL_LIFECYCLE', finalization: 'LIFECYCLE_ENGINE_ONLY' }),
  });
}

export async function runInstallerPipeline({ downloader, request, expectedIdentity, stagingRoot, platformArgs, at }) {
  const runtime = runtimeCapability();
  if (!runtime.ok) return failureResult(Object.assign(new Error(runtime.reason_code), { code: runtime.reason_code }), runtime.status);
  try {
    if (!downloader || typeof downloader.download !== 'function') fail('TRANSPORT_INJECTION_REQUIRED');
    const parsed = parseInstallerArgs(platformArgs);
    const identity = identityFrom(parsed);
    assertExactReleaseIdentity(identity, expectedIdentity);
    const download = await downloader.download({ ...request, staging_root: stagingRoot });
    const verified = await verifyBeforeExtract({ download, expectedIdentity, stagingRoot, at });
    const values = Object.freeze({ ...parsed, source: verified.payload_root });
    const capability = createVerificationCapability(verified.verification_binding, identity);
    const handoff = createInstallerHandoff(values, capability);
    return Object.freeze({ schema_version: 1, ok: true, status: handoff.status, reason_code: null, exit_code: 0, handoff, errors: [], sanitized: true });
  } catch (error) {
    return failureResult(error);
  }
}

export async function runInstallerBootstrap(argv) {
  const runtime = runtimeCapability();
  if (!runtime.ok) return failureResult(Object.assign(new Error(runtime.reason_code), { code: runtime.reason_code }), runtime.status);
  try {
    const parsed = parseInstallerArgs(argv);
    const identity = identityFrom(parsed);
    const offlineValues = [parsed.staging, parsed.bundle, parsed.request];
    if (offlineValues.every((value) => value === undefined)) return transportRequiredResult();
    if (offlineValues.some((value) => value === undefined)) fail('OFFLINE_TRANSPORT_ARGUMENTS_INCOMPLETE');
    const stagingRoot = await validateInstallerStaging(parsed.staging);
    const offline = await readOfflineRequest(stagingRoot, parsed.request);
    const downloader = createOfflineBundleDownloader({
      transport: Object.freeze({
        inspectLocalBundle: ({ bundle_path }) => inspectStagingFile(stagingRoot, bundle_path),
        readLocalBundle: ({ bundle_path }) => readStagingFile(stagingRoot, bundle_path),
      }),
    });
    return await runInstallerPipeline({
      downloader,
      request: { ...offline.request, bundle_path: parsed.bundle },
      expectedIdentity: identity,
      stagingRoot,
      platformArgs: argv.filter((value, index) => !['--staging', '--bundle', '--request'].includes(argv[index - 1]) && !['--staging', '--bundle', '--request'].includes(value)),
      at: offline.at,
    });
  } catch (error) {
    return failureResult(error);
  }
}
