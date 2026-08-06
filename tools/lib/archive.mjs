import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants as fsConstants, createReadStream } from 'node:fs';
import {
  copyFile,
  lstat,
  open,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { canonicalJsonBytes, canonicalSha256 } from './canonical-json.mjs';

export const TRUST_VERIFIED = 'VERIFIED_SOURCE';
export const TRUST_HISTORICAL = 'HISTORICAL_UNTRUSTED_EVIDENCE';
export const ARCHIVE_KINDS = new Set(['SNAPSHOT', 'GIT_BUNDLE', 'HISTORICAL_OPAQUE']);
export const ARCHIVE_FORMATS = new Set(['TAR_GZIP', 'GIT_BUNDLE', 'OPAQUE_TGZ']);
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/u;

export function sha256Bytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function sha256File(path) {
  const hash = createHash('sha256');
  let size = 0;
  for await (const chunk of createReadStream(path)) {
    hash.update(chunk);
    size += chunk.length;
  }
  return { sha256: hash.digest('hex'), size };
}

export function validateLogicalPath(path) {
  if (typeof path !== 'string' || path.length === 0) throw new Error('PATH_EMPTY');
  if (path.startsWith('/') || path.startsWith('\\')) throw new Error(`PATH_ABSOLUTE:${path}`);
  if (path.includes('\\')) throw new Error(`PATH_BACKSLASH:${path}`);
  if (CONTROL_PATTERN.test(path)) throw new Error(`PATH_CONTROL_CHARACTER:${JSON.stringify(path)}`);
  const segments = path.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) throw new Error(`PATH_TRAVERSAL:${path}`);
  return path;
}

function assertSafeId(id) {
  if (!ID_PATTERN.test(id)) throw new Error(`INVALID_SOURCE_SET_ID:${id}`);
}

function sameMetadata(before, after) {
  return before.dev === after.dev
    && before.ino === after.ino
    && before.size === after.size
    && before.mtimeNs === after.mtimeNs
    && before.ctimeNs === after.ctimeNs;
}

async function readStableRegularFile(path) {
  const before = await lstat(path, { bigint: true });
  if (!before.isFile()) throw new Error(`TYPE_CONFLICT:${path}`);
  const bytes = await readFile(path);
  const after = await lstat(path, { bigint: true });
  if (!sameMetadata(before, after) || BigInt(bytes.length) !== after.size) throw new Error(`SOURCE_MODIFIED_DURING_READ:${path}`);
  if (after.size > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`FILE_TOO_LARGE:${path}`);
  return { sha256: sha256Bytes(bytes), size: Number(after.size) };
}

export async function inventorySource({ id, root, sourceKind, trustLabel, capturedAt, logicalName }) {
  assertSafeId(id);
  if (!['DIRECTORY', 'FILE'].includes(sourceKind)) throw new Error(`INVALID_SOURCE_KIND:${sourceKind}`);
  if (![TRUST_VERIFIED, TRUST_HISTORICAL].includes(trustLabel)) throw new Error(`INVALID_TRUST_LABEL:${trustLabel}`);
  const absoluteRoot = resolve(root);
  const rootMetadata = await lstat(absoluteRoot);
  if (rootMetadata.isSymbolicLink()) throw new Error(`SYMLINK_UNEXPECTED:${absoluteRoot}`);
  if (sourceKind === 'DIRECTORY' && !rootMetadata.isDirectory()) throw new Error(`TYPE_CONFLICT:${absoluteRoot}`);
  if (sourceKind === 'FILE' && !rootMetadata.isFile()) throw new Error(`TYPE_CONFLICT:${absoluteRoot}`);

  const files = [];
  const folded = new Map();
  const register = (logicalPath) => {
    validateLogicalPath(logicalPath);
    const key = logicalPath.normalize('NFC').toLocaleLowerCase('en-US');
    if (folded.has(key) && folded.get(key) !== logicalPath) throw new Error(`CASE_FOLD_COLLISION:${folded.get(key)}:${logicalPath}`);
    folded.set(key, logicalPath);
  };

  const visit = async (directory) => {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => Buffer.from(left.name).compare(Buffer.from(right.name)));
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      const logicalPath = relative(absoluteRoot, path).split(sep).join('/');
      register(logicalPath);
      const metadata = await lstat(path);
      if (metadata.isSymbolicLink()) throw new Error(`SYMLINK_UNEXPECTED:${logicalPath}`);
      if (metadata.isDirectory()) await visit(path);
      else if (metadata.isFile()) files.push({ source_set_id: id, path: logicalPath, ...await readStableRegularFile(path) });
      else throw new Error(`TYPE_CONFLICT:${logicalPath}`);
    }
  };

  if (sourceKind === 'DIRECTORY') await visit(absoluteRoot);
  else {
    const path = logicalName ?? basename(absoluteRoot);
    register(path);
    files.push({ source_set_id: id, path, ...await readStableRegularFile(absoluteRoot) });
  }
  files.sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  return {
    schema_version: 1,
    source_set_id: id,
    captured_at: capturedAt,
    source_kind: sourceKind,
    trust_label: trustLabel,
    file_count: files.length,
    total_size: totalSize,
    snapshot_sha256: canonicalSha256(files),
    files,
  };
}

export function assertSameInventory(before, after) {
  if (before.source_set_id !== after.source_set_id
      || before.file_count !== after.file_count
      || before.total_size !== after.total_size
      || before.snapshot_sha256 !== after.snapshot_sha256
      || canonicalSha256(before.files) !== canonicalSha256(after.files)) {
    throw new Error(`SOURCE_MODIFIED_DURING_OPERATION:${before.source_set_id}`);
  }
}

export function validateM3Manifest(manifest) {
  const errors = [];
  const add = (condition, code) => { if (!condition) errors.push(code); };
  add(manifest?.schema_version === 1, 'MANIFEST_SCHEMA_VERSION');
  add(Array.isArray(manifest?.source_sets) && manifest.source_sets.length > 0, 'SOURCE_SETS_REQUIRED');
  add(Array.isArray(manifest?.files) && manifest.files.length > 0, 'FILES_REQUIRED');
  add(Array.isArray(manifest?.archives) && manifest.archives.length > 0, 'ARCHIVES_REQUIRED');
  if (errors.length > 0) return { ok: false, errors };

  const sourceIds = new Set();
  for (const source of manifest.source_sets) {
    add(ID_PATTERN.test(source.id ?? ''), `SOURCE_ID_INVALID:${source.id}`);
    add(!sourceIds.has(source.id), `SOURCE_ID_DUPLICATE:${source.id}`);
    sourceIds.add(source.id);
    add(['DIRECTORY', 'FILE'].includes(source.source_kind), `SOURCE_KIND_REQUIRED:${source.id}`);
    add([TRUST_VERIFIED, TRUST_HISTORICAL].includes(source.trust_label), `SOURCE_TRUST_REQUIRED:${source.id}`);
    if (source.trust_label === TRUST_HISTORICAL) add(source.id === 'historical-tgz', `HISTORICAL_TRUST_SCOPE:${source.id}`);
  }

  const fileKeys = new Set();
  let previousFileKey = null;
  for (const file of manifest.files) {
    try { validateLogicalPath(file.path); } catch (error) { errors.push(error.message); }
    add(sourceIds.has(file.source_set_id), `FILE_SOURCE_UNKNOWN:${file.source_set_id}`);
    add(SHA256_PATTERN.test(file.sha256 ?? ''), `FILE_HASH_INVALID:${file.source_set_id}:${file.path}`);
    add(Number.isSafeInteger(file.size) && file.size >= 0, `FILE_SIZE_INVALID:${file.source_set_id}:${file.path}`);
    const key = `${file.source_set_id}\u0000${file.path}`;
    add(!fileKeys.has(key), `FILE_DUPLICATE:${file.source_set_id}:${file.path}`);
    add(previousFileKey === null || Buffer.from(previousFileKey).compare(Buffer.from(key)) < 0, `FILES_NOT_CANONICAL:${file.source_set_id}:${file.path}`);
    fileKeys.add(key);
    previousFileKey = key;
  }

  const archiveNames = new Set();
  let previousArchiveName = null;
  const archiveCounts = new Map();
  for (const archive of manifest.archives) {
    add(sourceIds.has(archive.source_set_id), `ARCHIVE_SOURCE_REQUIRED:${archive.name}`);
    add(ARCHIVE_KINDS.has(archive.kind), `ARCHIVE_KIND_REQUIRED:${archive.name}`);
    add(ARCHIVE_FORMATS.has(archive.format), `ARCHIVE_FORMAT_REQUIRED:${archive.name}`);
    add([TRUST_VERIFIED, TRUST_HISTORICAL].includes(archive.trust_label), `ARCHIVE_TRUST_REQUIRED:${archive.name}`);
    try { validateLogicalPath(archive.name); } catch (error) { errors.push(error.message); }
    add(!archiveNames.has(archive.name), `ARCHIVE_DUPLICATE:${archive.name}`);
    add(previousArchiveName === null || Buffer.from(previousArchiveName).compare(Buffer.from(archive.name)) < 0, `ARCHIVES_NOT_CANONICAL:${archive.name}`);
    add(archive.algorithm === 'sha256' && SHA256_PATTERN.test(archive.sha256 ?? ''), `ARCHIVE_HASH_INVALID:${archive.name}`);
    add(Number.isSafeInteger(archive.size) && archive.size >= 0, `ARCHIVE_SIZE_INVALID:${archive.name}`);
    archiveNames.add(archive.name);
    previousArchiveName = archive.name;
    archiveCounts.set(archive.source_set_id, (archiveCounts.get(archive.source_set_id) ?? 0) + 1);
    const source = manifest.source_sets.find((candidate) => candidate.id === archive.source_set_id);
    if (source) add(archive.trust_label === source.trust_label, `ARCHIVE_TRUST_MISMATCH:${archive.name}`);
    if (archive.kind === 'SNAPSHOT') {
      add(archive.format === 'TAR_GZIP', `SNAPSHOT_FORMAT_INVALID:${archive.name}`);
      add(archive.reproducible === true, `SNAPSHOT_REPRODUCIBILITY_REQUIRED:${archive.name}`);
      add(archive.logical_root === archive.source_set_id, `SNAPSHOT_ROOT_INVALID:${archive.name}`);
      add(archive.normalization?.mtime_epoch === 0
        && archive.normalization?.owner === 0
        && archive.normalization?.group === 0
        && archive.normalization?.mode === '0644'
        && archive.normalization?.gzip_name_and_time === false, `SNAPSHOT_NORMALIZATION_REQUIRED:${archive.name}`);
    }
    if (archive.kind === 'GIT_BUNDLE') add(archive.format === 'GIT_BUNDLE' && source?.git_bundle === true, `BUNDLE_BINDING_INVALID:${archive.name}`);
    if (archive.kind === 'HISTORICAL_OPAQUE') add(archive.format === 'OPAQUE_TGZ' && archive.trust_label === TRUST_HISTORICAL && archive.reproducible === false, `HISTORICAL_OPAQUE_INVALID:${archive.name}`);
  }
  for (const source of manifest.source_sets) add((archiveCounts.get(source.id) ?? 0) > 0, `SOURCE_ARCHIVE_MISSING:${source.id}`);
  return { ok: errors.length === 0, errors };
}

export function assertM3Manifest(manifest) {
  const result = validateM3Manifest(manifest);
  if (!result.ok) throw new Error(`ARCHIVE_MANIFEST_INVALID:\n${result.errors.join('\n')}`);
  return manifest;
}

export async function runCommand(command, args, { cwd, env = {}, stdoutPath } = {}) {
  let outputHandle;
  const stderr = [];
  const stdout = [];
  try {
    if (stdoutPath) outputHandle = await open(stdoutPath, 'wx', 0o600);
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, LC_ALL: 'C', TZ: 'UTC', ...env },
      stdio: ['ignore', outputHandle ? outputHandle.fd : 'pipe', 'pipe'],
    });
    if (child.stdout) child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    const result = await new Promise((resolveResult, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolveResult({ code, signal }));
    });
    if (outputHandle) await outputHandle.sync();
    const stdoutText = Buffer.concat(stdout).toString('utf8');
    const stderrText = Buffer.concat(stderr).toString('utf8');
    if (result.code !== 0) throw new Error(`COMMAND_FAILED:${command}:${result.code}:${stderrText.trim()}`);
    return { ...result, stdout: stdoutText, stderr: stderrText };
  } finally {
    await outputHandle?.close();
  }
}

async function buildOneSnapshot({ source, inventory, outputPath, workPath, sourceDateEpoch }) {
  const listPath = `${workPath}.files`;
  const tarPath = `${workPath}.tar`;
  const base = source.sourceKind === 'DIRECTORY' ? resolve(source.root) : dirname(resolve(source.root));
  const diskPaths = inventory.files.map((file) => source.sourceKind === 'DIRECTORY' ? file.path : basename(resolve(source.root)));
  await writeFile(listPath, Buffer.concat(diskPaths.map((path) => Buffer.from(`${path}\u0000`, 'utf8'))), { flag: 'wx', mode: 0o600 });
  await runCommand('tar', [
    '--create', `--file=${tarPath}`, `--directory=${base}`, '--no-recursion', '--verbatim-files-from',
    '--sort=name', '--format=posix', '--pax-option=delete=atime,delete=ctime', `--mtime=@${sourceDateEpoch}`,
    '--owner=0', '--group=0', '--numeric-owner', '--mode=0644', `--transform=s,^,${source.id}/,`,
    '--null', `--files-from=${listPath}`,
  ]);
  await runCommand('gzip', ['-n', '-9', '-c', tarPath], { stdoutPath: outputPath });
  await rm(listPath);
  await rm(tarPath);
  return sha256File(outputPath);
}

export async function createDeterministicSnapshot({ source, inventory, outputPath, workDirectory, sourceDateEpoch = 0 }) {
  const first = `${workDirectory}/${source.id}.first.tgz`;
  const second = `${workDirectory}/${source.id}.second.tgz`;
  const firstHash = await buildOneSnapshot({ source, inventory, outputPath: first, workPath: `${workDirectory}/${source.id}.first`, sourceDateEpoch });
  const secondHash = await buildOneSnapshot({ source, inventory, outputPath: second, workPath: `${workDirectory}/${source.id}.second`, sourceDateEpoch });
  if (firstHash.sha256 !== secondHash.sha256 || firstHash.size !== secondHash.size) throw new Error(`SNAPSHOT_NOT_REPRODUCIBLE:${source.id}`);
  await rename(first, outputPath);
  await rm(second);
  return { ...firstHash, dual_build_match: true };
}

function parseOctal(field, label) {
  const text = field.toString('ascii').replace(/\0/g, '').trim();
  if (text === '') return 0;
  if (!/^[0-7]+$/.test(text)) throw new Error(`TAR_INVALID_OCTAL:${label}`);
  return Number.parseInt(text, 8);
}

function parsePax(bytes) {
  const values = {};
  let offset = 0;
  while (offset < bytes.length) {
    const space = bytes.indexOf(0x20, offset);
    if (space < 0) throw new Error('TAR_INVALID_PAX_LENGTH');
    const length = Number.parseInt(bytes.subarray(offset, space).toString('ascii'), 10);
    if (!Number.isSafeInteger(length) || length <= 0 || offset + length > bytes.length) throw new Error('TAR_INVALID_PAX_RECORD');
    const record = bytes.subarray(space + 1, offset + length - 1).toString('utf8');
    const equals = record.indexOf('=');
    if (equals < 1) throw new Error('TAR_INVALID_PAX_VALUE');
    values[record.slice(0, equals)] = record.slice(equals + 1);
    offset += length;
  }
  return values;
}

function tarChecksum(header) {
  let sum = 0;
  for (let index = 0; index < 512; index += 1) sum += index >= 148 && index < 156 ? 0x20 : header[index];
  return sum;
}

export function inspectGzipHeader(bytes) {
  if (bytes.length < 10 || bytes[0] !== 0x1f || bytes[1] !== 0x8b || bytes[2] !== 8) throw new Error('GZIP_HEADER_INVALID');
  const flags = bytes[3];
  const mtime = bytes.readUInt32LE(4);
  if (mtime !== 0 || (flags & 0x18) !== 0) throw new Error('GZIP_HEADER_NONDETERMINISTIC');
  return { mtime, has_name: (flags & 0x08) !== 0, has_comment: (flags & 0x10) !== 0 };
}

export function parseTarGzip(bytes, { includeData = false } = {}) {
  inspectGzipHeader(bytes);
  const tar = gunzipSync(bytes);
  const members = [];
  let offset = 0;
  let pax = {};
  let longName = null;
  let zeroBlocks = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((byte) => byte === 0)) {
      zeroBlocks += 1;
      if (zeroBlocks >= 2) break;
      continue;
    }
    zeroBlocks = 0;
    const expectedChecksum = parseOctal(header.subarray(148, 156), 'checksum');
    if (expectedChecksum !== tarChecksum(header)) throw new Error('TAR_CHECKSUM_INVALID');
    const size = parseOctal(header.subarray(124, 136), 'size');
    const type = String.fromCharCode(header[156] || 0x30);
    const namePart = header.subarray(0, 100).toString('utf8').replace(/\0.*$/s, '');
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/s, '');
    const headerName = prefix ? `${prefix}/${namePart}` : namePart;
    if (!Number.isSafeInteger(size) || offset + size > tar.length) throw new Error('TAR_MEMBER_SIZE_INVALID');
    const data = tar.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;
    if (type === 'x' || type === 'g') {
      pax = { ...pax, ...parsePax(data) };
      continue;
    }
    if (type === 'L') {
      longName = data.toString('utf8').replace(/\0.*$/s, '');
      continue;
    }
    const name = pax.path ?? longName ?? headerName;
    members.push({ name, type, size, sha256: sha256Bytes(data), ...(includeData ? { data: Buffer.from(data) } : {}) });
    pax = {};
    longName = null;
  }
  if (zeroBlocks < 2) throw new Error('TAR_END_MARKER_MISSING');
  return members;
}

export function verifyBundleRefs(sourceRefs, bundleRefs, headOid) {
  const bundleMap = new Map(bundleRefs.map((entry) => [entry.ref, entry.oid]));
  for (const sourceRef of sourceRefs) {
    if (bundleMap.get(sourceRef.ref) !== sourceRef.oid) throw new Error(`GIT_BUNDLE_REF_MISMATCH:${sourceRef.ref}`);
  }
  if (!sourceRefs.some((entry) => entry.oid === headOid)) throw new Error('GIT_BUNDLE_HEAD_UNREACHABLE');
  return { source_ref_count: sourceRefs.length, bundle_ref_count: bundleRefs.length };
}

export function verifySnapshotMembers({ members, sourceSetId, inventory }) {
  const actual = [];
  const seen = new Set();
  for (const member of members) {
    if (member.type !== '0' && member.type !== '\0') throw new Error(`ARCHIVE_TYPE_CONFLICT:${member.name}:${member.type}`);
    const prefix = `${sourceSetId}/`;
    if (!member.name.startsWith(prefix)) throw new Error(`ARCHIVE_ROOT_MISMATCH:${member.name}`);
    const path = member.name.slice(prefix.length);
    validateLogicalPath(path);
    if (seen.has(path)) throw new Error(`ARCHIVE_DUPLICATE_MEMBER:${path}`);
    seen.add(path);
    actual.push({ source_set_id: sourceSetId, path, sha256: member.sha256, size: member.size });
  }
  actual.sort((left, right) => Buffer.from(left.path).compare(Buffer.from(right.path)));
  if (canonicalSha256(actual) !== canonicalSha256(inventory.files)) throw new Error(`ARCHIVE_INVENTORY_MISMATCH:${sourceSetId}`);
  return { ok: true, member_count: actual.length, inventory_sha256: canonicalSha256(actual) };
}

export async function verifySnapshotArchive({ archivePath, sourceSetId, inventory }) {
  const bytes = await readFile(archivePath);
  const result = verifySnapshotMembers({ members: parseTarGzip(bytes), sourceSetId, inventory });
  return { ...result, ...await sha256File(archivePath) };
}

export async function copyOpaqueFile(sourcePath, outputPath) {
  await copyFile(sourcePath, outputPath, fsConstants.COPYFILE_EXCL);
  const [source, copy] = await Promise.all([sha256File(sourcePath), sha256File(outputPath)]);
  if (source.sha256 !== copy.sha256 || source.size !== copy.size) throw new Error('OPAQUE_COPY_MISMATCH');
  return { ...copy, byte_identical: true };
}

export async function writeCanonicalJsonExclusive(path, value) {
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(Buffer.concat([canonicalJsonBytes(value), Buffer.from('\n')]));
    await handle.sync();
  } finally {
    await handle.close();
  }
  return sha256File(path);
}

export async function verifyArchiveRecord(root, archive) {
  validateLogicalPath(archive.name);
  const path = resolve(root, archive.name);
  const rel = relative(resolve(root), path);
  if (rel === '..' || rel.startsWith(`..${sep}`)) throw new Error(`PATH_OUTSIDE_ROOT:${archive.name}`);
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`TYPE_CONFLICT:${archive.name}`);
  const observed = await sha256File(path);
  if (observed.sha256 !== archive.sha256 || observed.size !== archive.size) throw new Error(`ARCHIVE_HASH_MISMATCH:${archive.name}`);
  return observed;
}
