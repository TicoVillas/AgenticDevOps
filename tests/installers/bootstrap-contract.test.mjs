import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { frameworkRoot } from '../../tools/lib/io.mjs';
import { validateBySchemaId } from '../../tools/lib/schema.mjs';
import { sha256Bytes } from '../../tools/lib/release.mjs';
import { createOfflineBundleDownloader } from '../../tools/lib/installer/downloader.mjs';
import { createInstallerHandoff, parseInstallerArgs, runInstallerBootstrap, runInstallerPipeline, runtimeCapability } from '../../tools/lib/installer/bootstrap.mjs';
import { installerFixture, NOW, stagingHarness, writeOfflineFixture } from './harness.mjs';

const common = ['--operation', 'install', '--release-id', 'release-310', '--release-version', '3.1.0', '--release-tag', 'v3.1.0', '--release-commit', 'a'.repeat(40), '--repository', 'TicoVillas/AgenticDevOps', '--release-reference', 'releases/download/v3.1.0/assets', '--source', '/arbitrary/unverified/source', '--destination', '/synthetic/destination', '--state', '/synthetic/state', '--cache', '/synthetic/cache', '--temp', '/synthetic/temp', '--operation-id', 'install-synthetic-0001'];
const args = (adapter, extra = []) => ['--adapter', adapter, ...common, ...extra];

function execute(command, argv, options = {}) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, argv, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout = []; const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => resolveResult({ code, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') }));
  });
}

function localReader() {
  return {
    async inspectLocalBundle({ bundle_path }) { return { type: 'REGULAR_FILE', resolved_path: bundle_path }; },
    async readLocalBundle({ bundle_path }) { return readFile(bundle_path); },
  };
}

async function runOfflinePipeline({ adapter = 'BASH', fixture = null, harness = null, extra = [], bundlePath } = {}) {
  const selectedFixture = fixture ?? await installerFixture();
  const selectedHarness = harness ?? await stagingHarness();
  const path = bundlePath ?? await writeOfflineFixture(selectedHarness.staging, selectedFixture);
  const downloader = createOfflineBundleDownloader({ transport: localReader() });
  const result = await runInstallerPipeline({
    downloader,
    request: { ...selectedFixture.request, bundle_path: path },
    expectedIdentity: selectedFixture.identity,
    stagingRoot: selectedHarness.staging,
    platformArgs: args(adapter, extra),
    at: NOW,
  });
  return { result, harness: selectedHarness, path };
}

async function absent(path) {
  try { await access(path); return false; }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}

test('direct handoff construction rejects caller-supplied verification objects', () => {
  assert.throws(() => createInstallerHandoff(parseInstallerArgs(args('BASH')), { verification: { payload_root: '/arbitrary/unverified/source' } }), /VERIFICATION_CAPABILITY_REQUIRED/);
});

test('standalone bootstrap for both adapters blocks arbitrary source without injected transport', async () => {
  for (const adapter of ['BASH', 'POWERSHELL']) {
    const result = await runInstallerBootstrap(args(adapter));
    assert.equal(result.ok, false);
    assert.equal(result.status, 'BLOCKED');
    assert.equal(result.reason_code, 'TRANSPORT_INJECTION_REQUIRED');
    assert.equal(result.handoff, null);
  }
});

test('offline pipeline verifies before READY and binds source exactly to verified payload root', async (t) => {
  const { result, harness } = await runOfflinePipeline();
  t.after(harness.cleanup);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'READY_FOR_INSPECT_AND_PLAN');
  assert.equal(result.handoff.bindings.source, resolve(harness.staging, 'payload'));
  assert.notEqual(result.handoff.bindings.source, '/arbitrary/unverified/source');
  assert.equal(result.handoff.verification.payload_root, result.handoff.bindings.source);
  assert.equal(result.handoff.verification.staging_root, harness.staging);
  assert.equal(result.handoff.verification.file_count, 2);
  assert.equal(result.handoff.verification.release_identity_sha256, result.handoff.bindings.release_identity_sha256);
  assert.match(result.handoff.verification.manifest_sha256, /^[a-f0-9]{64}$/);
  for (const name of ['inspect_argv', 'plan_argv']) assert.equal(result.handoff.lifecycle[name].includes(result.handoff.bindings.source), true);
  assert.equal(result.handoff.lifecycle.apply_argv, null);
  assert.equal((await validateBySchemaId(result.handoff, 'urn:agentic-devops:installer-handoff:3.0')).ok, true);
});

test('Bash and PowerShell verified pipelines preserve equivalent lifecycle policy and PROJECTED semantics', async (t) => {
  const bash = await runOfflinePipeline({ adapter: 'BASH' });
  const powershell = await runOfflinePipeline({ adapter: 'POWERSHELL' });
  t.after(bash.harness.cleanup);
  t.after(powershell.harness.cleanup);
  assert.equal(bash.result.ok, true);
  assert.equal(powershell.result.ok, true);
  assert.equal(bash.result.handoff.platform_validation, 'SYNTHETICALLY_VALIDATED');
  assert.equal(powershell.result.handoff.platform_validation, 'PROJECTED');
  for (const key of ['decisions', 'stops', 'receipt_semantics']) assert.deepEqual(bash.result.handoff[key], powershell.result.handoff[key], key);
});

test('apply argv is emitted only after verification and explicit authorization, never executed', async (t) => {
  const { result, harness } = await runOfflinePipeline({ extra: ['--authorization', '/synthetic/authorization.json'] });
  t.after(harness.cleanup);
  assert.equal(result.ok, true);
  assert.equal(result.handoff.decisions.apply_authorized, true);
  assert.equal(result.handoff.decisions.wrapper_executes_apply, false);
  assert.ok(result.handoff.lifecycle.apply_argv.includes('--apply'));
});

test('invalid offline bundle, manifest, signature, or checksum creates zero payload and no handoff', async () => {
  for (const role of ['manifest', 'manifest_signature', 'checksums']) {
    const fixture = await installerFixture();
    const harness = await stagingHarness();
    try {
      const name = fixture.request.artifact_roles[role];
      const artifact = fixture.download.artifacts.find((entry) => entry.name === name);
      artifact.bytes[0] ^= 0x01;
      const binding = fixture.request.asset_identities.find((entry) => entry.name === name);
      binding.sha256 = sha256Bytes(artifact.bytes);
      const { result } = await runOfflinePipeline({ fixture, harness });
      assert.equal(result.ok, false, role);
      assert.equal(result.handoff, null, role);
      assert.equal(await absent(resolve(harness.staging, 'payload')), true, role);
    } finally { await harness.cleanup(); }
  }

  const fixture = await installerFixture();
  const harness = await stagingHarness();
  try {
    const bundlePath = resolve(harness.staging, 'invalid.bundle.json');
    await writeFile(bundlePath, '{"schema_version":1}\n', { mode: 0o600 });
    const { result } = await runOfflinePipeline({ fixture, harness, bundlePath });
    assert.equal(result.ok, false);
    assert.equal(result.handoff, null);
    assert.equal(await absent(resolve(harness.staging, 'payload')), true);
  } finally { await harness.cleanup(); }
});

test('branch and mutable URL/ref are blocked with structured output', async () => {
  for (const reference of ['refs/heads/main', 'main', 'raw.githubusercontent.com/org/repo/main/file']) {
    const changed = [...args('BASH')];
    changed[changed.indexOf('--release-reference') + 1] = reference;
    const result = await runInstallerBootstrap(changed);
    assert.equal(result.ok, false);
    assert.match(result.reason_code, /MUTABLE_RELEASE_REFERENCE/);
    assert.equal(result.sanitized, true);
  }
});

test('runtime capability returns NEEDS_STATE_VALIDATION without auto-install', () => {
  assert.equal(runtimeCapability('24.1.0').ok, true);
  assert.deepEqual(runtimeCapability('23.9.0'), { ok: false, status: 'NEEDS_STATE_VALIDATION', reason_code: 'RUNTIME_UNSUPPORTED', required_node_major: 24 });
});

test('Bash wrapper blocks arbitrary source and missing Node remains structured', async () => {
  const script = resolve(frameworkRoot, 'installers/install.sh');
  const blocked = await execute('/bin/bash', [script, ...common]);
  assert.equal(blocked.code, 3, blocked.stderr);
  const parsed = JSON.parse(blocked.stdout);
  assert.equal(parsed.status, 'BLOCKED');
  assert.equal(parsed.reason_code, 'TRANSPORT_INJECTION_REQUIRED');
  assert.equal(parsed.handoff, null);
  const missing = await execute('/bin/bash', [script], { env: { PATH: '' } });
  assert.equal(missing.code, 3);
  assert.equal(JSON.parse(missing.stdout).status, 'NEEDS_STATE_VALIDATION');
});

test('Bash wrapper consumes an offline bundle in secure synthetic staging and emits only a verified handoff', async (t) => {
  const fixture = await installerFixture();
  const harness = await stagingHarness();
  t.after(harness.cleanup);
  const bundlePath = await writeOfflineFixture(harness.staging, fixture);
  const requestPath = resolve(harness.staging, 'offline-request.json');
  await writeFile(requestPath, `${JSON.stringify({ schema_version: 1, verification_at: NOW, request: fixture.request })}\n`, { flag: 'wx', mode: 0o600 });
  const wrapperArgs = [...common];
  for (const [flag, value] of [
    ['--destination', harness.destination],
    ['--state', resolve(harness.sandbox, 'state')],
    ['--cache', resolve(harness.sandbox, 'cache')],
    ['--temp', resolve(harness.sandbox, 'temp')],
  ]) wrapperArgs[wrapperArgs.indexOf(flag) + 1] = value;
  wrapperArgs.push('--staging', harness.staging, '--bundle', bundlePath, '--request', requestPath);

  const executed = await execute('/bin/bash', [resolve(frameworkRoot, 'installers/install.sh'), ...wrapperArgs]);
  assert.equal(executed.code, 0, executed.stderr || executed.stdout);
  const result = JSON.parse(executed.stdout);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'READY_FOR_INSPECT_AND_PLAN');
  assert.equal(result.handoff.bindings.source, resolve(harness.staging, 'payload'));
  assert.equal(result.handoff.verification.method, 'VERIFY_BEFORE_EXTRACT');
  assert.equal(result.handoff.verification.staging_root, harness.staging);
  assert.equal(result.handoff.decisions.wrapper_executes_apply, false);
  assert.equal(result.handoff.lifecycle.apply_argv, null);
});

test('wrappers are thin and prohibit network, shell pipelines, planner, auto-install and direct writes', async () => {
  const bash = await readFile(resolve(frameworkRoot, 'installers/install.sh'), 'utf8');
  const powershell = await readFile(resolve(frameworkRoot, 'installers/install.ps1'), 'utf8');
  for (const source of [bash, powershell]) {
    for (const token of ['curl', 'wget', 'Invoke-WebRequest', 'Invoke-Expression', 'iex ', 'planDistribution', 'npm install', 'apt-get', 'destination_root']) assert.equal(source.includes(token), false, token);
  }
  assert.equal(/\|\s*(?:bash|sh|pwsh|powershell)/i.test(bash + powershell), false);
  assert.equal(powershell.includes("'PROJECTED'"), false);
});
