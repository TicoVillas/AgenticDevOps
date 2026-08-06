import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';
import { canonicalSha256 } from './canonical-json.mjs';
import {
  TRUST_HISTORICAL,
  TRUST_VERIFIED,
  assertM3Manifest,
  assertSameInventory,
  copyOpaqueFile,
  parseTarGzip,
  runCommand,
  sha256Bytes,
  sha256File,
  validateLogicalPath,
  verifySnapshotMembers,
  writeCanonicalJsonExclusive,
} from './archive.mjs';

const EXPECTED_PAYLOAD_FILES = 19;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const HIGH_CONFIDENCE_SECRET_PATTERN = /(?:github_pat_[A-Za-z0-9_]{20,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/u;

function contained(root, candidate) {
  const base = resolve(root);
  const target = resolve(candidate);
  const rel = relative(base, target);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

async function pathMetadata(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export async function ensureNoSymlinkAncestry(path) {
  const absolute = resolve(path);
  const parts = absolute.split(sep).filter(Boolean);
  let current = sep;
  for (const part of parts) {
    current = join(current, part);
    const metadata = await pathMetadata(current);
    if (!metadata) return;
    if (metadata.isSymbolicLink()) throw new Error(`SYMLINK_ANCESTRY:${current}`);
  }
}

export async function createExclusiveRestoreRoot(path, { forbiddenRoots = [] } = {}) {
  const absolute = resolve(path);
  if (await pathMetadata(absolute)) throw new Error('RESTORE_ROOT_PREEXISTING');
  await ensureNoSymlinkAncestry(absolute);
  for (const forbidden of forbiddenRoots) {
    const root = await realpath(resolve(forbidden));
    if (contained(root, absolute)) throw new Error(`RESTORE_ROOT_FORBIDDEN:${root}`);
  }
  const parent = dirname(absolute);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await chmod(parent, 0o700);
  await ensureNoSymlinkAncestry(parent);
  const parentMetadata = await lstat(parent);
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink()) throw new Error('RESTORE_PARENT_INVALID');
  if (typeof process.getuid === 'function' && parentMetadata.uid !== process.getuid()) throw new Error('RESTORE_PARENT_NOT_OWNED');
  await mkdir(absolute, { mode: 0o700 });
  await chmod(absolute, 0o700);
  const metadata = await lstat(absolute);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error('RESTORE_ROOT_INVALID');
  if (typeof process.getuid === 'function' && metadata.uid !== process.getuid()) throw new Error('RESTORE_ROOT_NOT_OWNED');
  if ((metadata.mode & 0o777) !== 0o700) throw new Error('RESTORE_ROOT_MODE_INVALID');
  return await realpath(absolute);
}

async function createExclusiveDirectory(path) {
  if (await pathMetadata(path)) throw new Error(`RESTORE_DESTINATION_PREEXISTING:${path}`);
  await ensureNoSymlinkAncestry(path);
  await mkdir(path, { mode: 0o700 });
  await chmod(path, 0o700);
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`RESTORE_DESTINATION_INVALID:${path}`);
}

async function readStableFile(path) {
  const before = await lstat(path, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) throw new Error(`TYPE_CONFLICT:${path}`);
  const bytes = await readFile(path);
  const after = await lstat(path, { bigint: true });
  if (before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs
      || BigInt(bytes.length) !== after.size) throw new Error(`SOURCE_MODIFIED_DURING_READ:${path}`);
  return { bytes, sha256: sha256Bytes(bytes), size: bytes.length };
}

export function assertArtifactBinding(observed, expected) {
  if (!SHA256_PATTERN.test(expected?.sha256 ?? '') || !Number.isSafeInteger(expected?.size)) throw new Error('ARTIFACT_BINDING_INVALID');
  if (observed.sha256 !== expected.sha256 || observed.size !== expected.size) throw new Error(`ARCHIVE_HASH_MISMATCH:${expected.name ?? 'artifact'}`);
}

function inventoryFromFiles(sourceSetId, files, capturedAt) {
  const sorted = files
    .map((file) => ({ source_set_id: sourceSetId, path: file.path, sha256: file.sha256, size: file.size }))
    .sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  return {
    schema_version: 1,
    source_set_id: sourceSetId,
    captured_at: capturedAt,
    source_kind: 'DIRECTORY',
    trust_label: TRUST_VERIFIED,
    file_count: sorted.length,
    total_size: sorted.reduce((sum, file) => sum + file.size, 0),
    snapshot_sha256: canonicalSha256(sorted),
    files: sorted,
  };
}

export function inventoryFromManifest(manifest, sourceSetId, capturedAt = manifest.created_at) {
  const source = manifest.source_sets.find((entry) => entry.id === sourceSetId);
  if (!source) throw new Error(`SOURCE_SET_MISSING:${sourceSetId}`);
  const inventory = inventoryFromFiles(sourceSetId, manifest.files.filter((file) => file.source_set_id === sourceSetId), capturedAt);
  inventory.source_kind = source.source_kind;
  inventory.trust_label = source.trust_label;
  return inventory;
}

async function walkRegularFiles(root, { sourceSetId, capturedAt, excludeRootNames = [] } = {}) {
  const absolute = resolve(root);
  const files = [];
  const folded = new Map();
  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => Buffer.from(left.name).compare(Buffer.from(right.name)));
    for (const entry of entries) {
      if (directory === absolute && excludeRootNames.includes(entry.name)) continue;
      const path = join(directory, entry.name);
      const logicalPath = relative(absolute, path).split(sep).join('/');
      validateLogicalPath(logicalPath);
      const foldedPath = logicalPath.normalize('NFC').toLocaleLowerCase('en-US');
      if (folded.has(foldedPath) && folded.get(foldedPath) !== logicalPath) throw new Error(`CASE_FOLD_COLLISION:${folded.get(foldedPath)}:${logicalPath}`);
      folded.set(foldedPath, logicalPath);
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) throw new Error(`SYMLINK_UNEXPECTED:${logicalPath}`);
      if (metadata.isDirectory()) await visit(path);
      else if (metadata.isFile()) {
        const observed = await readStableFile(path);
        files.push({ path: logicalPath, sha256: observed.sha256, size: observed.size });
      } else throw new Error(`TYPE_CONFLICT:${logicalPath}`);
    }
  };
  await visit(absolute);
  return inventoryFromFiles(sourceSetId, files, capturedAt);
}

export function validateRestoreMembers({ members, sourceSetId, inventory, requireData = false }) {
  const folded = new Map();
  const prefix = `${sourceSetId}/`;
  for (const member of members) {
    if (member.type !== '0' && member.type !== '\0') throw new Error(`ARCHIVE_TYPE_CONFLICT:${member.name}:${member.type}`);
    if (!member.name.startsWith(prefix)) throw new Error(`ARCHIVE_ROOT_MISMATCH:${member.name}`);
    const logicalPath = member.name.slice(prefix.length);
    validateLogicalPath(logicalPath);
    const foldedPath = logicalPath.normalize('NFC').toLocaleLowerCase('en-US');
    if (folded.has(foldedPath) && folded.get(foldedPath) !== logicalPath) throw new Error(`CASE_FOLD_COLLISION:${folded.get(foldedPath)}:${logicalPath}`);
    folded.set(foldedPath, logicalPath);
    if (requireData && (!Buffer.isBuffer(member.data) || member.data.length !== member.size || sha256Bytes(member.data) !== member.sha256)) {
      throw new Error(`ARCHIVE_MEMBER_DATA_INVALID:${logicalPath}`);
    }
  }
  return verifySnapshotMembers({ members, sourceSetId, inventory });
}

export function assertExtractableSnapshot(archive) {
  if (archive?.kind === 'HISTORICAL_OPAQUE' || archive?.trust_label === TRUST_HISTORICAL) throw new Error('HISTORICAL_TGZ_EXTRACTION_FORBIDDEN');
  if (archive?.kind !== 'SNAPSHOT' || archive?.format !== 'TAR_GZIP' || archive?.trust_label !== TRUST_VERIFIED) throw new Error('ARCHIVE_NOT_EXTRACTABLE');
}

async function ensureContainedParents(root, logicalPath) {
  const segments = logicalPath.split('/');
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    current = join(current, segment);
    if (!contained(root, current)) throw new Error(`PATH_OUTSIDE_ROOT:${logicalPath}`);
    try {
      await mkdir(current, { mode: 0o700 });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const metadata = await lstat(current);
    if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new Error(`RESTORE_PARENT_TYPE_CONFLICT:${logicalPath}`);
  }
}

export async function extractSnapshotArchive({ archivePath, archive, destinationRoot, inventory, capturedAt }) {
  assertExtractableSnapshot(archive);
  const source = await readStableFile(archivePath);
  assertArtifactBinding(source, archive);
  const members = parseTarGzip(source.bytes, { includeData: true });
  validateRestoreMembers({ members, sourceSetId: archive.source_set_id, inventory, requireData: true });
  await createExclusiveDirectory(destinationRoot);
  const prefix = `${archive.source_set_id}/`;
  for (const member of members) {
    const logicalPath = member.name.slice(prefix.length);
    await ensureContainedParents(destinationRoot, logicalPath);
    const outputPath = resolve(destinationRoot, logicalPath);
    if (!contained(destinationRoot, outputPath)) throw new Error(`PATH_OUTSIDE_ROOT:${logicalPath}`);
    const handle = await open(outputPath, 'wx', 0o600);
    try {
      await handle.writeFile(member.data);
      await handle.sync();
    } finally {
      await handle.close();
    }
  }
  const restored = await walkRegularFiles(destinationRoot, {
    sourceSetId: archive.source_set_id,
    capturedAt,
  });
  assertSameInventory(inventory, restored);
  return {
    source_set_id: archive.source_set_id,
    archive_sha256: source.sha256,
    archive_size: source.size,
    file_count: restored.file_count,
    total_size: restored.total_size,
    inventory_sha256: restored.snapshot_sha256,
    comparison: 'FILE_BY_FILE_IDENTICAL',
    inventory: restored,
  };
}

function parseRefs(output) {
  return output.trim().split('\n').filter(Boolean).map((line) => {
    const separator = line.indexOf(' ');
    return { oid: line.slice(0, separator), ref: line.slice(separator + 1) };
  }).sort((left, right) => left.ref.localeCompare(right.ref, 'en'));
}

export function assertCompleteBundleVerification({ stdout = '', stderr = '' }) {
  if (!`${stdout}\n${stderr}`.includes('complete history')) throw new Error('GIT_BUNDLE_INCOMPLETE');
}

export function validateBundleRestorePlan({ expectedRefs, bundleRefs, expectedHead }) {
  const actual = new Map(bundleRefs.map((entry) => [entry.ref, entry.oid]));
  for (const expected of expectedRefs) {
    if (actual.get(expected.ref) !== expected.oid) throw new Error(`GIT_BUNDLE_REF_MISMATCH:${expected.ref}`);
  }
  if (actual.get('HEAD') !== expectedHead || !expectedRefs.some((entry) => entry.ref === 'refs/heads/main' && entry.oid === expectedHead)) {
    throw new Error('GIT_BUNDLE_HEAD_MISMATCH');
  }
  return { expected_ref_count: expectedRefs.length, advertised_ref_count: bundleRefs.length };
}

export function assertSourceUnchanged(before, after) {
  try {
    assertSameInventory(before, after);
  } catch {
    throw new Error(`REDOWNLOAD_MODIFIED_DURING_OPERATION:${before.source_set_id}`);
  }
}

async function restoreBundle({ bundlePath, bundleArchive, checkoutRoot, destinationRoot, source, inventory, expectedHead, capturedAt }) {
  const bundle = await readStableFile(bundlePath);
  assertArtifactBinding(bundle, bundleArchive);
  const verify = await runCommand('git', ['-C', checkoutRoot, 'bundle', 'verify', bundlePath], { env: { GIT_OPTIONAL_LOCKS: '0' } });
  assertCompleteBundleVerification(verify);
  const listed = await runCommand('git', ['bundle', 'list-heads', bundlePath], { env: { GIT_OPTIONAL_LOCKS: '0' } });
  const bundleRefs = parseRefs(listed.stdout);
  validateBundleRestorePlan({ expectedRefs: source.git.refs, bundleRefs, expectedHead });
  await ensureNoSymlinkAncestry(destinationRoot);
  if (await pathMetadata(destinationRoot)) throw new Error(`RESTORE_DESTINATION_PREEXISTING:${destinationRoot}`);
  await runCommand('git', ['clone', '--no-local', '--no-tags', '--branch', 'main', bundlePath, destinationRoot], { env: { GIT_OPTIONAL_LOCKS: '0' } });
  await chmod(destinationRoot, 0o700);
  await runCommand('git', ['-C', destinationRoot, 'remote', 'remove', 'origin'], { env: { GIT_OPTIONAL_LOCKS: '0' } });
  await runCommand('git', ['-C', destinationRoot, 'update-ref', 'refs/remotes/origin/main', expectedHead], { env: { GIT_OPTIONAL_LOCKS: '0' } });
  await runCommand('git', ['-C', destinationRoot, 'symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/main'], { env: { GIT_OPTIONAL_LOCKS: '0' } });
  const [head, refsOutput, status, fsck, remotes, branches, commits, objects] = await Promise.all([
    runCommand('git', ['-C', destinationRoot, 'rev-parse', 'HEAD'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', destinationRoot, 'for-each-ref', '--format=%(objectname) %(refname)'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', destinationRoot, 'status', '--porcelain=v1', '--untracked-files=all'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', destinationRoot, 'fsck', '--full', '--strict'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', destinationRoot, 'remote'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', destinationRoot, 'branch', '--format=%(refname:short)'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', destinationRoot, 'rev-list', '--count', '--all'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', destinationRoot, 'rev-list', '--objects', '--all'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
  ]);
  if (head.stdout.trim() !== expectedHead) throw new Error('RESTORED_GIT_HEAD_MISMATCH');
  if (status.stdout !== '') throw new Error('RESTORED_GIT_DIRTY');
  if (remotes.stdout !== '') throw new Error('RESTORED_GIT_REMOTE_PRESENT');
  if (branches.stdout.trim() !== 'main') throw new Error('RESTORED_GIT_BRANCH_SET_MISMATCH');
  const restoredRefs = parseRefs(refsOutput.stdout);
  for (const expected of source.git.refs) {
    const actual = restoredRefs.find((entry) => entry.ref === expected.ref);
    if (!actual || actual.oid !== expected.oid) throw new Error(`RESTORED_GIT_REF_MISMATCH:${expected.ref}`);
  }
  const expectedWorktree = inventoryFromFiles(
    source.id,
    inventory.files.filter((file) => !file.path.startsWith('.git/')),
    capturedAt,
  );
  const worktree = await walkRegularFiles(destinationRoot, {
    sourceSetId: source.id,
    capturedAt,
    excludeRootNames: ['.git'],
  });
  assertSameInventory(expectedWorktree, worktree);
  return {
    result: 'PASS',
    source_set_id: source.id,
    bundle_sha256: bundle.sha256,
    bundle_size: bundle.size,
    verify: 'PASS_COMPLETE_HISTORY',
    head: expectedHead,
    branch: 'main',
    refs: restoredRefs,
    remote_configuration: 'NONE',
    origin_head_nature: 'RESTORED_SYMBOLIC_REF_WITHOUT_CONFIGURED_REMOTE',
    fsck: 'PASS',
    status_clean: true,
    commit_count: Number(commits.stdout.trim()),
    reachable_object_entries: objects.stdout.trim().split('\n').filter(Boolean).length,
    worktree_file_count: worktree.file_count,
    worktree_total_size: worktree.total_size,
    worktree_inventory_sha256: worktree.snapshot_sha256,
    worktree_comparison: 'FILE_BY_FILE_IDENTICAL',
    github_remote_required: false,
    inventory: worktree,
  };
}

function payloadPathForArchive(payloadRoot, archive) {
  return join(payloadRoot, 'artifacts', basename(archive.name));
}

async function verifyRemoteInventory(checkoutRoot, payloadRoot, expectedInventorySha256, capturedAt) {
  const inventoryPath = join(payloadRoot, 'manifests', 'remote-content-inventory.json');
  const inventorySourceFile = await readStableFile(inventoryPath);
  if (inventorySourceFile.sha256 !== expectedInventorySha256) throw new Error('REMOTE_CONTENT_INVENTORY_HASH_MISMATCH');
  const declared = JSON.parse(inventorySourceFile.bytes.toString('utf8'));
  if (declared.file_count_excluding_self !== EXPECTED_PAYLOAD_FILES - 1 || declared.files.length !== EXPECTED_PAYLOAD_FILES - 1) throw new Error('REMOTE_CONTENT_INVENTORY_COUNT_MISMATCH');
  const actual = await walkRegularFiles(join(checkoutRoot, 'archives'), {
    sourceSetId: 'redownload-payload',
    capturedAt,
  });
  if (actual.file_count !== EXPECTED_PAYLOAD_FILES) throw new Error('REDOWNLOAD_FILE_COUNT_MISMATCH');
  const actualMap = new Map(actual.files.map((file) => [`archives/${file.path}`, file]));
  for (const file of declared.files) {
    validateLogicalPath(file.path);
    const observed = actualMap.get(file.path);
    if (!observed || observed.sha256 !== file.sha256 || observed.size !== file.size) throw new Error(`REMOTE_CONTENT_INVENTORY_MISMATCH:${file.path}`);
    actualMap.delete(file.path);
  }
  const selfPath = relative(checkoutRoot, inventoryPath).split(sep).join('/');
  const self = actualMap.get(selfPath);
  if (!self || self.sha256 !== expectedInventorySha256 || self.size !== inventorySourceFile.size || actualMap.size !== 1) throw new Error('REMOTE_CONTENT_INVENTORY_SELF_BINDING_MISMATCH');
  return { declared, actual };
}

async function verifyCheckout({ checkoutRoot, expectedCommit, expectedTree }) {
  const [status, head, tree, count, branch, modes, fsck] = await Promise.all([
    runCommand('git', ['-C', checkoutRoot, 'status', '--porcelain=v1', '--untracked-files=all'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', checkoutRoot, 'rev-parse', 'HEAD'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', checkoutRoot, 'rev-parse', 'HEAD^{tree}'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', checkoutRoot, 'ls-tree', '-r', '--name-only', 'HEAD'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', checkoutRoot, 'rev-parse', '--abbrev-ref', 'HEAD'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', checkoutRoot, 'ls-tree', '-r', 'HEAD'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
    runCommand('git', ['-C', checkoutRoot, 'fsck', '--full', '--strict'], { env: { GIT_OPTIONAL_LOCKS: '0' } }),
  ]);
  if (status.stdout !== '' || head.stdout.trim() !== expectedCommit || tree.stdout.trim() !== expectedTree || branch.stdout.trim() !== 'HEAD') throw new Error('REDOWNLOAD_CHECKOUT_BINDING_MISMATCH');
  if (count.stdout.trim().split('\n').filter(Boolean).length !== EXPECTED_PAYLOAD_FILES) throw new Error('REDOWNLOAD_COMMIT_FILE_COUNT_MISMATCH');
  if (modes.stdout.trim().split('\n').filter(Boolean).some((line) => !line.startsWith('100644 '))) throw new Error('REDOWNLOAD_COMMIT_TYPE_MISMATCH');
  return { commit: expectedCommit, tree: expectedTree, detached: true, file_count: EXPECTED_PAYLOAD_FILES, fsck: 'PASS' };
}

async function scanRestoredContent(root) {
  const inventories = [];
  for (const path of [join(root, 'bundle', 'kiro-v2-3'), join(root, 'snapshots')]) {
    const inventory = await walkRegularFiles(path, {
      sourceSetId: 'restored-scan',
      capturedAt: 'scan',
      excludeRootNames: path.endsWith('kiro-v2-3') ? ['.git'] : [],
    });
    inventories.push(inventory);
    for (const file of inventory.files) {
      const bytes = await readFile(join(path, file.path));
      if (bytes.includes(0)) continue;
      const text = bytes.toString('utf8');
      if (text.includes('/home/villas/')) throw new Error(`RESTORED_ABSOLUTE_LOCAL_PATH:${file.path}`);
      if (HIGH_CONFIDENCE_SECRET_PATTERN.test(text)) throw new Error(`RESTORED_SECRET_PATTERN:${file.path}`);
    }
  }
  return { absolute_local_path_scan: 'PASS', high_confidence_secret_scan: 'PASS', scanned_files: inventories.reduce((sum, item) => sum + item.file_count, 0) };
}

export async function executeArchiveRestore({
  redownloadRoot,
  payloadRelative,
  restoreRoot,
  operationId,
  expectedCommit,
  expectedTree,
  expectedHistoricalHead,
  expectedInventorySha256,
  forbiddenRoots = [],
  capturedAt = new Date().toISOString(),
}) {
  validateLogicalPath(payloadRelative);
  const redownload = await realpath(resolve(redownloadRoot));
  const checkoutRoot = await realpath(join(redownload, 'checkout'));
  const payloadRoot = await realpath(join(checkoutRoot, payloadRelative));
  if (!contained(checkoutRoot, payloadRoot)) throw new Error('PAYLOAD_OUTSIDE_REDOWNLOAD_CHECKOUT');
  const checkout = await verifyCheckout({ checkoutRoot, expectedCommit, expectedTree });
  const remoteInventory = await verifyRemoteInventory(checkoutRoot, payloadRoot, expectedInventorySha256, capturedAt);
  const beforePayload = remoteInventory.actual;
  const manifestSource = await readStableFile(join(payloadRoot, 'manifests', 'archive-provenance-manifest.json'));
  const manifest = assertM3Manifest(JSON.parse(manifestSource.bytes.toString('utf8')));
  const source = manifest.source_sets.find((entry) => entry.id === 'kiro-v2-3');
  if (source?.git?.head_oid !== expectedHistoricalHead) throw new Error('HISTORICAL_HEAD_BINDING_MISMATCH');

  const archiveBindings = new Map();
  for (const archive of manifest.archives) {
    const path = payloadPathForArchive(payloadRoot, archive);
    const observed = await readStableFile(path);
    assertArtifactBinding(observed, archive);
    archiveBindings.set(archive.source_set_id === 'kiro-v2-3' && archive.kind === 'GIT_BUNDLE' ? 'kiro-v2-3-bundle' : archive.source_set_id, { archive, path, observed });
    if (archive.kind === 'SNAPSHOT') {
      const inventory = inventoryFromManifest(manifest, archive.source_set_id, capturedAt);
      validateRestoreMembers({ members: parseTarGzip(observed.bytes), sourceSetId: archive.source_set_id, inventory });
    } else if (archive.kind === 'HISTORICAL_OPAQUE') {
      if (archive.trust_label !== TRUST_HISTORICAL) throw new Error('HISTORICAL_TRUST_LABEL_MISMATCH');
    }
  }

  const root = await createExclusiveRestoreRoot(restoreRoot, { forbiddenRoots: [redownload, ...forbiddenRoots] });
  for (const directory of ['bundle', 'snapshots', 'opaque', 'reports', 'manifests', 'evidence']) await mkdir(join(root, directory), { mode: 0o700 });

  const bundleBinding = archiveBindings.get('kiro-v2-3-bundle');
  const v23Inventory = inventoryFromManifest(manifest, 'kiro-v2-3', capturedAt);
  const bundle = await restoreBundle({
    bundlePath: bundleBinding.path,
    bundleArchive: bundleBinding.archive,
    checkoutRoot,
    destinationRoot: join(root, 'bundle', 'kiro-v2-3'),
    source,
    inventory: v23Inventory,
    expectedHead: expectedHistoricalHead,
    capturedAt,
  });

  const snapshots = [];
  for (const sourceSetId of ['kiro-v2-3', 'kiro-v2-4', 'analysis-v3']) {
    const binding = archiveBindings.get(sourceSetId);
    const inventory = inventoryFromManifest(manifest, sourceSetId, capturedAt);
    snapshots.push(await extractSnapshotArchive({
      archivePath: binding.path,
      archive: binding.archive,
      destinationRoot: join(root, 'snapshots', sourceSetId),
      inventory,
      capturedAt,
    }));
  }

  const opaqueBinding = archiveBindings.get('historical-tgz');
  const opaquePath = join(root, 'opaque', basename(opaqueBinding.path));
  const opaque = await copyOpaqueFile(opaqueBinding.path, opaquePath);
  assertArtifactBinding(opaque, opaqueBinding.archive);
  const opaqueResult = {
    result: 'PASS',
    artifact: basename(opaquePath),
    trust_label: TRUST_HISTORICAL,
    sha256: opaque.sha256,
    size: opaque.size,
    byte_identical: true,
    extracted: false,
    executed: false,
    recompressed: false,
  };

  const afterPayload = await walkRegularFiles(join(checkoutRoot, 'archives'), {
    sourceSetId: 'redownload-payload',
    capturedAt,
  });
  assertSourceUnchanged(beforePayload, afterPayload);
  await verifyCheckout({ checkoutRoot, expectedCommit, expectedTree });
  const scans = await scanRestoredContent(root);
  const restoredInventory = {
    schema_version: 1,
    operation_id: operationId,
    bundle_worktree: bundle.inventory.files,
    snapshots: Object.fromEntries(snapshots.map((entry) => [entry.source_set_id, entry.inventory.files])),
    opaque: [{ path: `opaque/${opaqueResult.artifact}`, sha256: opaqueResult.sha256, size: opaqueResult.size, trust_label: TRUST_HISTORICAL }],
  };
  delete bundle.inventory;
  for (const snapshot of snapshots) delete snapshot.inventory;

  const reportHashes = {};
  reportHashes.bundle = await writeCanonicalJsonExclusive(join(root, 'reports', 'bundle-restore.json'), bundle);
  reportHashes.snapshots = await writeCanonicalJsonExclusive(join(root, 'reports', 'snapshot-comparison.json'), { operation_id: operationId, result: 'PASS', snapshots });
  reportHashes.opaque = await writeCanonicalJsonExclusive(join(root, 'reports', 'opaque-restore.json'), opaqueResult);
  reportHashes.immutability = await writeCanonicalJsonExclusive(join(root, 'reports', 'redownload-immutability.json'), {
    operation_id: operationId,
    result: 'PASS',
    before_sha256: beforePayload.snapshot_sha256,
    after_sha256: afterPayload.snapshot_sha256,
    file_count: afterPayload.file_count,
    total_size: afterPayload.total_size,
    match: true,
    checkout,
  });
  reportHashes.inventory = await writeCanonicalJsonExclusive(join(root, 'manifests', 'restore-inventory.json'), restoredInventory);
  const summary = {
    operation_id: operationId,
    result: 'PASS',
    checkpoint: 'ARCHIVE-RESTORE',
    source: 'EXACT_COMMIT_REDOWNLOAD_ONLY',
    remote_commit: expectedCommit,
    remote_tree: expectedTree,
    historical_head: expectedHistoricalHead,
    payload_file_count: afterPayload.file_count,
    artifacts: [...archiveBindings.values()].map(({ archive }) => ({ name: basename(archive.name), sha256: archive.sha256, size: archive.size, trust_label: archive.trust_label })),
    bundle: { head: bundle.head, refs: bundle.refs, fsck: bundle.fsck, remote_configuration: bundle.remote_configuration, github_remote_required: false },
    snapshots: snapshots.map(({ source_set_id, file_count, total_size, inventory_sha256, comparison }) => ({ source_set_id, file_count, total_size, inventory_sha256, comparison })),
    opaque: opaqueResult,
    scans,
    remote_write_performed: false,
    original_historical_sources_used_for_restore: false,
    m3_9_performed: false,
  };
  reportHashes.summary = await writeCanonicalJsonExclusive(join(root, 'reports', 'restore-summary.json'), summary);
  const operations = {
    operation_id: operationId,
    checkpoint: 'ARCHIVE-RESTORE',
    operations_not_authorized: [
      'M3.9',
      'REMOTE_WRITE',
      'SOURCE_MOVE_OR_DELETE',
      'STAGING_OR_RESTORE_CLEANUP',
      'M4_THROUGH_M15',
      'PROJECT_OR_FRAMEWORK_GIT_OPERATION',
      'CANONICAL_REPOSITORY_CREATION',
      'SIGNING_TAG_OR_RELEASE',
      'GLOBAL_INSTALLATION',
      'PROJECT_UPDATE',
      'REAL_ROLLBACK_OR_UNINSTALL',
      'SIBLING_CHECKOUT',
      'DELIVERY_VALIDATION',
    ],
  };
  reportHashes.operations = await writeCanonicalJsonExclusive(join(root, 'operations-not-authorized.json'), operations);
  const evidence = {
    schema_version: 1,
    evidence_id: `${operationId}-evidence`,
    operation_id: operationId,
    result: 'PASS',
    entries: Object.entries(reportHashes).map(([id, hash]) => ({ id, algorithm: 'sha256', sha256: hash.sha256, size: hash.size })),
    sanitized: true,
  };
  reportHashes.evidence = await writeCanonicalJsonExclusive(join(root, 'evidence', 'evidence-index.json'), evidence);
  return {
    status: 'CHECKPOINT_ARCHIVE_RESTORE',
    operation_id: operationId,
    restore_root: root,
    restore_root_mode: '0700',
    checkout,
    bundle: { head: bundle.head, refs: bundle.refs, fsck: bundle.fsck, worktree_file_count: bundle.worktree_file_count, github_remote_required: false },
    snapshots,
    opaque: opaqueResult,
    scans,
    redownload_immutability: 'PASS',
    report_hashes: reportHashes,
    remote_write_performed: false,
    m3_9_performed: false,
  };
}

export function sha256Inventory(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
