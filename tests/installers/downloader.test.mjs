import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createDownloader } from '../../tools/lib/installer/downloader.mjs';
import { injectedTransport, installerFixture, stagingHarness, writeOfflineFixture } from './harness.mjs';

test('GH and API adapters use only injected exact-release transports', async () => {
  const fixture = await installerFixture();
  for (const adapter of ['GH_AUTHENTICATED', 'API_FINE_GRAINED_READ_ONLY']) {
    const transport = injectedTransport(fixture);
    const downloaded = await createDownloader({ adapter, transport }).download(fixture.request);
    assert.deepEqual(downloaded.identity, fixture.identity);
    assert.equal(transport.calls[0][0], 'release');
    assert.equal(transport.calls.filter(([kind]) => kind === 'asset').length, fixture.request.asset_identities.length);
  }
});

test('mutable branch/reference is rejected before any transport call', async () => {
  const fixture = await installerFixture();
  for (const reference of ['refs/heads/main', 'main', 'raw.githubusercontent.com/org/repo/main/file']) {
    const transport = injectedTransport(fixture);
    await assert.rejects(createDownloader({ adapter: 'GH_AUTHENTICATED', transport }).download({ ...fixture.request, reference }), /MUTABLE_RELEASE_REFERENCE/);
    assert.equal(transport.calls.length, 0);
  }
});

test('exact asset identity is validated before transport and mismatches fail closed', async () => {
  const fixture = await installerFixture();
  const transport = injectedTransport(fixture);
  const invalid = structuredClone(fixture.request);
  invalid.asset_identities[0].sha256 = 'not-a-hash';
  await assert.rejects(createDownloader({ adapter: 'API_FINE_GRAINED_READ_ONLY', transport }).download(invalid), /INVALID_ASSET_SHA256/);
  assert.equal(transport.calls.length, 0);
  const wrong = injectedTransport(fixture);
  wrong.readExactAsset = async ({ asset_identity }) => asset_identity.name === fixture.request.asset_identities[0].name ? Buffer.from('tampered') : Buffer.alloc(0);
  await assert.rejects(createDownloader({ adapter: 'GH_AUTHENTICATED', transport: wrong }).download(fixture.request), /ASSET_(?:SIZE|HASH)_MISMATCH/);
});

test('offline adapter accepts only an injected local bundle contained in staging', async (t) => {
  const fixture = await installerFixture();
  const harness = await stagingHarness();
  t.after(harness.cleanup);
  const bundlePath = await writeOfflineFixture(harness.staging, fixture);
  const reads = [];
  const transport = {
    async inspectLocalBundle({ bundle_path }) { return { type: 'REGULAR_FILE', resolved_path: bundle_path }; },
    async readLocalBundle({ bundle_path }) { reads.push(bundle_path); return readFile(bundle_path); },
  };
  const downloaded = await createDownloader({ adapter: 'OFFLINE_BUNDLE', transport }).download({ ...fixture.request, staging_root: harness.staging, bundle_path: bundlePath });
  assert.equal(downloaded.artifacts.length, fixture.download.artifacts.length);
  assert.deepEqual(reads, [bundlePath]);
  await assert.rejects(createDownloader({ adapter: 'OFFLINE_BUNDLE', transport }).download({ ...fixture.request, staging_root: harness.staging, bundle_path: resolve(harness.sandbox, 'outside.bundle') }), /OFFLINE_BUNDLE_OUTSIDE_STAGING/);
});

test('invalid offline bundle and tampered bundle are rejected', async (t) => {
  const fixture = await installerFixture();
  const harness = await stagingHarness();
  t.after(harness.cleanup);
  const badPath = resolve(harness.staging, 'invalid.bundle.json');
  await writeFile(badPath, '{"schema_version":1}\n');
  const transport = {
    inspectLocalBundle: async ({ bundle_path }) => ({ type: 'REGULAR_FILE', resolved_path: bundle_path }),
    readLocalBundle: ({ bundle_path }) => readFile(bundle_path),
  };
  await assert.rejects(createDownloader({ adapter: 'OFFLINE_BUNDLE', transport }).download({ ...fixture.request, staging_root: harness.staging, bundle_path: badPath }), /OFFLINE_BUNDLE_INVALID/);
  const validPath = await writeOfflineFixture(harness.staging, fixture);
  const document = JSON.parse(await readFile(validPath, 'utf8'));
  document.artifacts[0].bytes_base64 = Buffer.from('tampered').toString('base64');
  await writeFile(validPath, `${JSON.stringify(document)}\n`);
  await assert.rejects(createDownloader({ adapter: 'OFFLINE_BUNDLE', transport }).download({ ...fixture.request, staging_root: harness.staging, bundle_path: validPath }), /ASSET_(?:SIZE|HASH)_MISMATCH/);
});

test('transport errors and emitted logs redact bearer, token, header and sensitive path', async () => {
  const fixture = await installerFixture();
  const events = [];
  const secret = 'github_pat_' + 'A'.repeat(40);
  const path = '/home/sensitive-user/private.bundle';
  const transport = injectedTransport(fixture, { error: Object.assign(new Error(`Authorization: Bearer top.secret token=${secret} ${path}`), { code: 'TRANSPORT_FAILED' }) });
  await assert.rejects(createDownloader({ adapter: 'GH_AUTHENTICATED', transport, emit: (event) => events.push(event) }).download({ ...fixture.request, bundle_path: path }), (error) => {
    assert.equal(error.message.includes('top.secret'), false);
    assert.equal(error.message.includes(secret), false);
    assert.equal(error.message.includes(path), false);
    return true;
  });
  const encoded = JSON.stringify(events);
  assert.equal(encoded.includes('top.secret'), false);
  assert.equal(encoded.includes(secret), false);
  assert.equal(encoded.includes(path), false);
});
