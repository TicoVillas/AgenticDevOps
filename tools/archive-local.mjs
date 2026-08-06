#!/usr/bin/env node
import { getuid } from 'node:process';
import { constants as fsConstants } from 'node:fs';
import {
  access,
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
} from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import {
  TRUST_HISTORICAL,
  TRUST_VERIFIED,
  assertM3Manifest,
  assertSameInventory,
  copyOpaqueFile,
  createDeterministicSnapshot,
  inventorySource,
  runCommand,
  sha256File,
  validateLogicalPath,
  verifyArchiveRecord,
  verifyBundleRefs,
  verifySnapshotArchive,
  writeCanonicalJsonExclusive,
} from './lib/archive.mjs';
import { validateArtifact } from './lib/artifacts.mjs';

const OPERATION_ID_PATTERN = /^archive-local-r\d{2}-\d{8}-\d{2}$/;
const SOURCE_DATE_EPOCH = 0;

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const key = rest[index];
    if (!key?.startsWith('--') || rest[index + 1] === undefined) throw new Error(`INVALID_ARGUMENT:${key ?? ''}`);
    options[key.slice(2)] = rest[index + 1];
  }
  return { command, options };
}

function contained(root, candidate) {
  const base = resolve(root);
  const target = resolve(candidate);
  const rel = relative(base, target);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

async function ensureNoSymlinkAncestry(path) {
  const absolute = resolve(path);
  const parts = absolute.split(sep).filter(Boolean);
  let current = sep;
  for (const part of parts) {
    current = join(current, part);
    try {
      const metadata = await lstat(current);
      if (metadata.isSymbolicLink()) throw new Error(`SYMLINK_UNEXPECTED:${current}`);
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
  }
}

async function createExclusiveStaging(outputRoot, operationId) {
  if (basename(outputRoot) !== operationId || !OPERATION_ID_PATTERN.test(operationId)) throw new Error('OUTPUT_OPERATION_BINDING_INVALID');
  await ensureNoSymlinkAncestry(outputRoot);
  const parent = dirname(outputRoot);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const parentMetadata = await lstat(parent);
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) throw new Error('STAGING_PARENT_INVALID');
  if (typeof getuid === 'function' && parentMetadata.uid !== getuid()) throw new Error('STAGING_PARENT_NOT_OWNED');
  await mkdir(outputRoot, { mode: 0o700 });
  await chmod(outputRoot, 0o700);
  const rootMetadata = await lstat(outputRoot);
  if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink() || (typeof getuid === 'function' && rootMetadata.uid !== getuid())) throw new Error('STAGING_ROOT_INVALID');
  for (const directory of ['manifests', 'inventory', 'bundles', 'snapshots', 'checksums', 'reports', 'evidence', 'limitations', '.work']) {
    await mkdir(join(outputRoot, directory), { mode: 0o700 });
  }
}

async function checkToolVersions() {
  const [git, tar, gzip] = await Promise.all([
    runCommand('git', ['--version']),
    runCommand('tar', ['--version']),
    runCommand('gzip', ['--version']),
  ]);
  if (!/^git version 2\./.test(git.stdout)) throw new Error('GIT_UNSUPPORTED');
  if (!/^tar \(GNU tar\) 1\./.test(tar.stdout)) throw new Error('GNU_TAR_REQUIRED');
  if (!/^gzip 1\./.test(gzip.stdout)) throw new Error('GZIP_UNSUPPORTED');
  return {
    git: git.stdout.split('\n')[0],
    tar: tar.stdout.split('\n')[0],
    gzip: gzip.stdout.split('\n')[0],
  };
}

function sourceDefinitions(projectRoot) {
  return [
    { id: 'kiro-v2-3', root: join(projectRoot, 'Kiro_v2_3_source'), sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED, origin: 'workspace:Kiro_v2_3_source' },
    { id: 'kiro-v2-4', root: join(projectRoot, 'Kiro_v2_4_source'), sourceKind: 'DIRECTORY', trustLabel: TRUST_VERIFIED, origin: 'workspace:Kiro_v2_4_source' },
    { id: 'analysis-v3', root: join(projectRoot, 'Analise_Workflow_v3.0.md'), sourceKind: 'FILE', trustLabel: TRUST_VERIFIED, origin: 'workspace:Analise_Workflow_v3.0.md' },
    { id: 'historical-tgz', root: join(projectRoot, 'framework', 'agentic-devops-framework-v3-3.0.0.tgz'), sourceKind: 'FILE', trustLabel: TRUST_HISTORICAL, origin: 'workspace:framework/agentic-devops-framework-v3-3.0.0.tgz' },
  ];
}

async function inventoryAll(sources, capturedAt) {
  const entries = [];
  for (const source of sources) entries.push(await inventorySource({ ...source, capturedAt }));
  return entries;
}

function parseRefs(output) {
  return output.trim().split('\n').filter(Boolean).map((line) => {
    const separator = line.indexOf(' ');
    return { oid: line.slice(0, separator), ref: line.slice(separator + 1) };
  }).sort((left, right) => left.ref.localeCompare(right.ref, 'en'));
}

async function collectGitMetadata(sourceRoot) {
  const env = { GIT_OPTIONAL_LOCKS: '0' };
  const [head, refs, status, fsck, containing] = await Promise.all([
    runCommand('git', ['-C', sourceRoot, 'rev-parse', 'HEAD'], { env }),
    runCommand('git', ['-C', sourceRoot, 'for-each-ref', '--format=%(objectname) %(refname)'], { env }),
    runCommand('git', ['-C', sourceRoot, 'status', '--porcelain=v1', '--untracked-files=all'], { env }),
    runCommand('git', ['-C', sourceRoot, 'fsck', '--full', '--strict'], { env }),
    runCommand('git', ['-C', sourceRoot, 'for-each-ref', '--contains=HEAD', '--format=%(refname)'], { env }),
  ]);
  if (status.stdout !== '') throw new Error('GIT_SOURCE_DIRTY');
  const oid = head.stdout.trim();
  const sourceRefs = parseRefs(refs.stdout);
  const headReachableFrom = containing.stdout.trim().split('\n').filter(Boolean).sort();
  if (headReachableFrom.length === 0) throw new Error('GIT_HEAD_UNREACHABLE');
  return {
    head_oid: oid,
    head_state: 'DETACHED',
    refs: sourceRefs,
    head_reachable_from: headReachableFrom,
    status_clean: true,
    fsck: 'PASS',
  };
}

async function buildAndVerifyBundle(sourceRoot, bundlePath, gitMetadata) {
  const env = { GIT_OPTIONAL_LOCKS: '0' };
  await runCommand('git', ['-C', sourceRoot, 'bundle', 'create', bundlePath, '--all'], { env });
  await chmod(bundlePath, 0o600);
  const verify = await runCommand('git', ['-C', sourceRoot, 'bundle', 'verify', bundlePath], { env });
  const heads = await runCommand('git', ['bundle', 'list-heads', bundlePath], { env });
  const bundleRefs = parseRefs(heads.stdout);
  const counts = verifyBundleRefs(gitMetadata.refs, bundleRefs, gitMetadata.head_oid);
  return {
    result: 'PASS',
    ...counts,
    refs: bundleRefs,
    head_oid: gitMetadata.head_oid,
    head_state: gitMetadata.head_state,
    head_reachable_from: gitMetadata.head_reachable_from,
    verify_summary: verify.stderr.trim().split('\n').filter(Boolean).map((line) => line.replace(bundlePath, 'bundles/kiro-v2-3.bundle')),
    object_verification: 'git bundle verify plus source git fsck --full --strict',
    restore_performed: false,
  };
}

function archiveRecord(sourceSetId, name, kind, format, trustLabel, hash, extra = {}) {
  return { source_set_id: sourceSetId, name, kind, format, trust_label: trustLabel, algorithm: 'sha256', sha256: hash.sha256, size: hash.size, ...extra };
}

async function writeTextExclusive(path, text) {
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(text, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  return sha256File(path);
}

async function buildOperation({ projectRoot, outputRoot, operationId, capturedAt }) {
  projectRoot = await realpath(resolve(projectRoot));
  outputRoot = resolve(outputRoot);
  if (contained(projectRoot, outputRoot)) throw new Error('STAGING_INSIDE_SOURCE_ROOT');
  const sources = sourceDefinitions(projectRoot);
  for (const source of sources) {
    await ensureNoSymlinkAncestry(source.root);
    await access(source.root, fsConstants.R_OK);
  }
  const tools = await checkToolVersions();
  await createExclusiveStaging(outputRoot, operationId);
  const createdAt = capturedAt ?? new Date().toISOString();
  const initial = await inventoryAll(sources, createdAt);
  for (const inventory of initial) await writeCanonicalJsonExclusive(join(outputRoot, 'inventory', `${inventory.source_set_id}.json`), inventory);

  const gitSource = sources.find((source) => source.id === 'kiro-v2-3');
  const gitMetadata = await collectGitMetadata(gitSource.root);
  const bundleRelative = 'bundles/kiro-v2-3.bundle';
  const bundlePath = join(outputRoot, bundleRelative);
  const bundleReport = await buildAndVerifyBundle(gitSource.root, bundlePath, gitMetadata);
  const bundleHash = await sha256File(bundlePath);
  await writeCanonicalJsonExclusive(join(outputRoot, 'reports', 'bundle-verification.json'), bundleReport);

  const archives = [archiveRecord('kiro-v2-3', bundleRelative, 'GIT_BUNDLE', 'GIT_BUNDLE', TRUST_VERIFIED, bundleHash, { reproducible: false })];
  const reproducibility = { operation_id: operationId, source_date_epoch: SOURCE_DATE_EPOCH, snapshots: [] };
  const archiveVerification = { operation_id: operationId, archives: [] };
  for (const source of sources.filter((entry) => entry.id !== 'historical-tgz')) {
    const inventory = initial.find((entry) => entry.source_set_id === source.id);
    const relativePath = `snapshots/${source.id}.tar.gz`;
    const result = await createDeterministicSnapshot({
      source,
      inventory,
      outputPath: join(outputRoot, relativePath),
      workDirectory: join(outputRoot, '.work'),
      sourceDateEpoch: SOURCE_DATE_EPOCH,
    });
    reproducibility.snapshots.push({ source_set_id: source.id, dual_build_sha256: result.sha256, size: result.size, match: result.dual_build_match });
    archives.push(archiveRecord(source.id, relativePath, 'SNAPSHOT', 'TAR_GZIP', source.trustLabel, result, {
      logical_root: source.id,
      reproducible: true,
      normalization: { mtime_epoch: SOURCE_DATE_EPOCH, owner: 0, group: 0, mode: '0644', gzip_name_and_time: false },
    }));
  }

  const historical = sources.find((source) => source.id === 'historical-tgz');
  const opaqueRelative = 'snapshots/agentic-devops-framework-v3-3.0.0.historical.tgz';
  const opaqueHash = await copyOpaqueFile(historical.root, join(outputRoot, opaqueRelative));
  archives.push(archiveRecord('historical-tgz', opaqueRelative, 'HISTORICAL_OPAQUE', 'OPAQUE_TGZ', TRUST_HISTORICAL, opaqueHash, { reproducible: false }));
  archives.sort((left, right) => Buffer.from(left.name).compare(Buffer.from(right.name)));

  const final = await inventoryAll(sources, createdAt);
  const immutability = { operation_id: operationId, result: 'PASS', sources: [] };
  for (const before of initial) {
    const after = final.find((entry) => entry.source_set_id === before.source_set_id);
    assertSameInventory(before, after);
    immutability.sources.push({ source_set_id: before.source_set_id, before_sha256: before.snapshot_sha256, after_sha256: after.snapshot_sha256, file_count: after.file_count, total_size: after.total_size, match: true });
  }

  const sourceSets = sources.map((source) => {
    const base = {
      id: source.id,
      origin: source.origin,
      captured_at: createdAt,
      source_kind: source.sourceKind,
      trust_label: source.trustLabel,
      git_bundle: source.id === 'kiro-v2-3',
    };
    if (source.id === 'kiro-v2-3') base.git = gitMetadata;
    return base;
  });
  const files = initial.flatMap((inventory) => inventory.files).sort((left, right) => Buffer.from(`${left.source_set_id}\u0000${left.path}`).compare(Buffer.from(`${right.source_set_id}\u0000${right.path}`)));
  const manifest = {
    schema_version: 1,
    manifest_id: `${operationId}-manifest`,
    created_at: createdAt,
    trust_label: 'HISTORICAL_UNTRUSTED',
    source_sets: sourceSets,
    files,
    archives,
  };
  assertM3Manifest(manifest);
  await writeCanonicalJsonExclusive(join(outputRoot, 'manifests', 'archive-provenance-manifest.json'), manifest);

  for (const archive of archives) {
    await verifyArchiveRecord(outputRoot, archive);
    if (archive.kind === 'SNAPSHOT') {
      const inventory = initial.find((entry) => entry.source_set_id === archive.source_set_id);
      const result = await verifySnapshotArchive({ archivePath: join(outputRoot, archive.name), sourceSetId: archive.source_set_id, inventory });
      archiveVerification.archives.push({ name: archive.name, result: 'PASS', member_count: result.member_count, sha256: result.sha256, size: result.size });
    } else archiveVerification.archives.push({ name: archive.name, result: 'PASS', sha256: archive.sha256, size: archive.size });
  }

  const reportHashes = {};
  reportHashes.reproducibility = await writeCanonicalJsonExclusive(join(outputRoot, 'reports', 'reproducibility.json'), reproducibility);
  reportHashes.immutability = await writeCanonicalJsonExclusive(join(outputRoot, 'reports', 'source-immutability.json'), immutability);
  reportHashes.archive = await writeCanonicalJsonExclusive(join(outputRoot, 'reports', 'archive-verification.json'), archiveVerification);
  reportHashes.bundle = await sha256File(join(outputRoot, 'reports', 'bundle-verification.json'));
  reportHashes.tools = await writeCanonicalJsonExclusive(join(outputRoot, 'reports', 'tool-versions.json'), { operation_id: operationId, tools });

  const limitation = {
    code: 'IMPLEMENTATION_COMMIT_UNAVAILABLE',
    statement: 'The project and framework roots have no Git metadata. evidence-index.commit_sha identifies the preserved v2.3 source HEAD, not an implementation commit.',
    implementation_binding: 'framework.lock',
    preserved_source_head: gitMetadata.head_oid,
    effect: 'Local archive evidence is valid for M3.1-M3.4; no implementation commit identity is claimed.',
  };
  const limitationHash = await writeCanonicalJsonExclusive(join(outputRoot, 'limitations', 'implementation-commit-unavailable.json'), limitation);
  const evidence = {
    schema_version: 1,
    evidence_id: `${operationId}-evidence`,
    commit_sha: gitMetadata.head_oid,
    created_at: createdAt,
    entries: [
      { id: 'archive-verify', kind: 'VALIDATION', result: 'PASS', sha256: reportHashes.archive.sha256, uri: 'reports/archive-verification.json' },
      { id: 'bundle-verify', kind: 'VALIDATION', result: 'PASS', sha256: reportHashes.bundle.sha256, uri: 'reports/bundle-verification.json' },
      { id: 'dual-build', kind: 'BUILD', result: 'PASS', sha256: reportHashes.reproducibility.sha256, uri: 'reports/reproducibility.json' },
      { id: 'source-immutability', kind: 'VALIDATION', result: 'PASS', sha256: reportHashes.immutability.sha256, uri: 'reports/source-immutability.json' },
      { id: 'implementation-commit-unavailable', kind: 'LIMITATION', result: 'BLOCKED', sha256: limitationHash.sha256, uri: 'limitations/implementation-commit-unavailable.json' },
    ],
    limitations: [limitation.statement],
    sanitized: true,
  };
  await writeCanonicalJsonExclusive(join(outputRoot, 'evidence', 'evidence-index.json'), evidence);
  await writeCanonicalJsonExclusive(join(outputRoot, 'operations-not-authorized.json'), {
    operation_id: operationId,
    checkpoint: 'ARCHIVE-LOCAL',
    operations_not_authorized: ['REMOTE_UPLOAD', 'REMOTE_REDOWNLOAD', 'RESTORE_DRILL', 'SOURCE_MOVE', 'SOURCE_DELETE', 'GIT_WRITE', 'M3.5_APPROVAL', 'M3.6_PLUS', 'M4_PLUS'],
  });
  const checksumLines = archives.map((archive) => `${archive.sha256}  ${archive.name}`).join('\n');
  await writeTextExclusive(join(outputRoot, 'checksums', 'SHA256SUMS'), `${checksumLines}\n`);
  await rm(join(outputRoot, '.work'), { recursive: true });

  const verification = await verifyOperation({ projectRoot, outputRoot, expectedOperationId: operationId });
  return { operation_id: operationId, output_root: outputRoot, checkpoint: 'ARCHIVE-LOCAL', ...verification };
}

async function verifyOperation({ projectRoot, outputRoot, expectedOperationId }) {
  projectRoot = await realpath(resolve(projectRoot));
  outputRoot = await realpath(resolve(outputRoot));
  const manifest = JSON.parse(await readFile(join(outputRoot, 'manifests', 'archive-provenance-manifest.json'), 'utf8'));
  assertM3Manifest(manifest);
  const manifestSchema = await validateArtifact('archive-provenance-manifest', manifest);
  if (!manifestSchema.ok) throw new Error(`ARCHIVE_MANIFEST_SCHEMA_INVALID:${manifestSchema.errors.join('|')}`);
  if (expectedOperationId && manifest.manifest_id !== `${expectedOperationId}-manifest`) throw new Error('OPERATION_MANIFEST_MISMATCH');
  const inventories = new Map();
  for (const source of manifest.source_sets) inventories.set(source.id, JSON.parse(await readFile(join(outputRoot, 'inventory', `${source.id}.json`), 'utf8')));
  const results = [];
  for (const archive of manifest.archives) {
    await verifyArchiveRecord(outputRoot, archive);
    if (archive.kind === 'SNAPSHOT') await verifySnapshotArchive({ archivePath: join(outputRoot, archive.name), sourceSetId: archive.source_set_id, inventory: inventories.get(archive.source_set_id) });
    results.push({ name: archive.name, sha256: archive.sha256, size: archive.size, result: 'PASS' });
  }
  const bundle = manifest.archives.find((archive) => archive.kind === 'GIT_BUNDLE');
  const sourceRoot = join(projectRoot, 'Kiro_v2_3_source');
  await runCommand('git', ['-C', sourceRoot, 'bundle', 'verify', join(outputRoot, bundle.name)], { env: { GIT_OPTIONAL_LOCKS: '0' } });
  const operations = JSON.parse(await readFile(join(outputRoot, 'operations-not-authorized.json'), 'utf8'));
  if (!operations.operations_not_authorized.includes('REMOTE_UPLOAD') || !operations.operations_not_authorized.includes('RESTORE_DRILL')) throw new Error('UNAUTHORIZED_OPERATIONS_GUARD_MISSING');
  const evidence = JSON.parse(await readFile(join(outputRoot, 'evidence', 'evidence-index.json'), 'utf8'));
  const evidenceSchema = await validateArtifact('evidence-index', evidence);
  if (!evidenceSchema.ok) throw new Error(`EVIDENCE_INDEX_SCHEMA_INVALID:${evidenceSchema.errors.join('|')}`);
  for (const entry of evidence.entries) {
    validateLogicalPath(entry.uri);
    const observed = await sha256File(join(outputRoot, entry.uri));
    if (observed.sha256 !== entry.sha256) throw new Error(`EVIDENCE_HASH_MISMATCH:${entry.id}`);
  }
  for (const directory of ['manifests', 'inventory', 'reports', 'evidence', 'limitations']) {
    for (const name of await readdir(join(outputRoot, directory))) {
      const text = await readFile(join(outputRoot, directory, name), 'utf8');
      if (text.includes(projectRoot) || text.includes(outputRoot)) throw new Error(`UNSANITIZED_ABSOLUTE_PATH:${directory}/${name}`);
    }
  }
  return {
    result: 'PASS',
    archive_count: results.length,
    archives: results,
    evidence_hash_count: evidence.entries.length,
    schema_validation: 'PASS',
    absolute_path_scan: 'PASS',
    restore_performed: false,
    remote_operation_performed: false,
  };
}

async function inventoryCommand({ projectRoot, capturedAt }) {
  const root = await realpath(resolve(projectRoot));
  const inventories = await inventoryAll(sourceDefinitions(root), capturedAt ?? new Date().toISOString());
  process.stdout.write(`${JSON.stringify(inventories, null, 2)}\n`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === 'build') {
    for (const required of ['project-root', 'output-root', 'operation-id']) if (!options[required]) throw new Error(`MISSING_ARGUMENT:${required}`);
    const result = await buildOperation({ projectRoot: options['project-root'], outputRoot: options['output-root'], operationId: options['operation-id'], capturedAt: options['captured-at'] });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (command === 'verify') {
    for (const required of ['project-root', 'output-root']) if (!options[required]) throw new Error(`MISSING_ARGUMENT:${required}`);
    const result = await verifyOperation({ projectRoot: options['project-root'], outputRoot: options['output-root'], expectedOperationId: options['operation-id'] });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (command === 'inventory') {
    if (!options['project-root']) throw new Error('MISSING_ARGUMENT:project-root');
    await inventoryCommand({ projectRoot: options['project-root'], capturedAt: options['captured-at'] });
  } else throw new Error(`UNKNOWN_COMMAND:${command ?? ''}`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exitCode = 1;
});
