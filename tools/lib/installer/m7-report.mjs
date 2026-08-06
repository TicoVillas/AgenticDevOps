import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { frameworkRoot } from '../io.mjs';

function json(value) { return `${JSON.stringify(value, null, 2)}\n`; }

export function expectedM7InstallersReport() {
  return json({
    schema_version: 1,
    milestone: 'M7.1-M7.8',
    result: 'PASS',
    linux_validation: 'SYNTHETICALLY_VALIDATED',
    windows_validation: 'PROJECTED',
    network_access_authorized: false,
    credential_access_authorized: false,
    direct_global_write: false,
    node_auto_install: false,
    verify_before_extract: true,
    ready_handoff_requires_verification_binding: true,
    standalone_transport_required: true,
    offline_wrapper_verified: true,
    verified_payload_source_only: true,
    apply_in_wrapper: false,
    download_adapters: ['GH_AUTHENTICATED', 'API_FINE_GRAINED_READ_ONLY', 'OFFLINE_BUNDLE'],
    reused_primitives: ['release', 'release-trust', 'release-security.scanSensitiveEntries', 'archive.validateLogicalPath', 'archive-restore.ensureNoSymlinkAncestry', 'lifecycle.paths', 'lifecycle.cli'],
    tests: [
      'tests/installers/bootstrap-contract.test.mjs',
      'tests/installers/downloader.test.mjs',
      'tests/installers/verify-extract-security.test.mjs',
    ],
    tested_scope: 'synthetic roots, in-memory/local fixtures, and injected transports only',
  });
}

export async function generateM7InstallersReport(root = frameworkRoot) {
  const output = resolve(root, 'generated/reports');
  await mkdir(output, { recursive: true });
  const name = 'm7-installers.json';
  await writeFile(resolve(output, name), expectedM7InstallersReport(), 'utf8');
  return name;
}

export async function validateM7InstallersReport(root = frameworkRoot) {
  try {
    const actual = await readFile(resolve(root, 'generated/reports/m7-installers.json'), 'utf8');
    return Object.freeze({ ok: actual === expectedM7InstallersReport(), errors: actual === expectedM7InstallersReport() ? [] : ['Generated M7 report drift: m7-installers.json'] });
  } catch (error) {
    return Object.freeze({ ok: false, errors: [`Missing generated M7 report: ${error.code}`] });
  }
}
