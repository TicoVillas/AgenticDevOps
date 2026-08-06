import { chmod, lstat, mkdir, open, readFile, realpath } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { validateLogicalPath, sha256Bytes } from '../archive.mjs';
import { ensureNoSymlinkAncestry } from '../archive-restore.mjs';
import { canonicalSha256 } from '../canonical-json.mjs';
import { isWithin } from '../lifecycle/paths.mjs';
import {
  assertExactReleaseIdentity,
  canonicalManifestBytes,
  parseChecksums,
  sha256Bytes as releaseSha256Bytes,
  validateReleaseManifestBindings,
  verifyAssetInventory,
} from '../release.mjs';
import { verifyTrustedSignature } from '../release-trust.mjs';
import { scanSensitiveEntries } from '../release-security.mjs';

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

async function metadata(path) {
  try { return await lstat(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function contained(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !rel.startsWith('/'));
}

export async function validateInstallerStaging(stagingRoot) {
  const root = resolve(stagingRoot);
  if (root !== stagingRoot) fail('STAGING_ROOT_NOT_NORMALIZED');
  const resolvedRoot = await realpath(root);
  if (resolvedRoot !== root) fail('STAGING_ROOT_INVALID');
  const observed = await lstat(root);
  if (!observed.isDirectory() || observed.isSymbolicLink()) fail('STAGING_ROOT_INVALID');
  if (typeof process.getuid === 'function' && observed.uid !== process.getuid()) fail('STAGING_ROOT_NOT_OWNED');
  if ((observed.mode & 0o777) !== 0o700) fail('STAGING_ROOT_MODE_INVALID');
  return resolvedRoot;
}

export async function createInstallerStaging({ stagingRoot, forbiddenRoots = [] }) {
  const root = resolve(stagingRoot);
  if (root !== stagingRoot) fail('STAGING_ROOT_NOT_NORMALIZED');
  if (await metadata(root)) fail('STAGING_ROOT_PREEXISTING');
  for (const forbidden of forbiddenRoots) {
    const boundary = resolve(forbidden);
    if (isWithin(boundary, root) || isWithin(root, boundary)) fail('STAGING_ROOT_NOT_DISJOINT');
  }
  const parent = dirname(root);
  if (!await metadata(parent)) fail('STAGING_PARENT_MISSING');
  await ensureNoSymlinkAncestry(parent);
  await mkdir(root, { mode: 0o700 });
  await chmod(root, 0o700);
  return validateInstallerStaging(root);
}

function artifactMap(download) {
  return new Map(download.artifacts.map((asset) => [asset.name, Buffer.from(asset.bytes)]));
}

function parseJson(bytes, code) {
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { fail(code); }
}

function assertChecksumBindings(records, inventory) {
  if (records.length !== inventory.length) fail('CHECKSUM_INVENTORY_MISMATCH');
  for (let index = 0; index < records.length; index += 1) {
    if (records[index].name !== inventory[index].name || records[index].sha256 !== inventory[index].sha256) fail('CHECKSUM_INVENTORY_MISMATCH');
  }
}

function validateMembers(document) {
  if (document?.schema_version !== 1 || !Array.isArray(document.members) || document.members.length === 0) fail('PAYLOAD_ARCHIVE_INVALID');
  const seen = new Map();
  const folded = new Map();
  const members = [];
  for (const member of document.members) {
    const path = validateLogicalPath(member?.path);
    const type = member?.type;
    if (seen.has(path)) fail(seen.get(path) === type ? 'ARCHIVE_DUPLICATE_MEMBER' : 'TYPE_CONFLICT', path);
    seen.set(path, type);
    const caseKey = path.normalize('NFC').toLocaleLowerCase('en-US');
    if (folded.has(caseKey) && folded.get(caseKey) !== path) fail('CASE_FOLD_COLLISION', `${folded.get(caseKey)}:${path}`);
    folded.set(caseKey, path);
    if (type === 'SYMLINK') fail('SYMLINK_UNEXPECTED', path);
    if (type === 'HARDLINK') fail('HARDLINK_UNEXPECTED', path);
    if (type !== 'FILE') fail('SPECIAL_TYPE_UNEXPECTED', path);
    if (typeof member.data_base64 !== 'string') fail('ARCHIVE_MEMBER_DATA_INVALID', path);
    const data = Buffer.from(member.data_base64, 'base64');
    if (data.toString('base64') !== member.data_base64) fail('ARCHIVE_MEMBER_DATA_INVALID', path);
    if (!Number.isSafeInteger(member.size) || member.size !== data.length || member.sha256 !== sha256Bytes(data)) fail('ARCHIVE_MEMBER_DATA_INVALID', path);
    members.push(Object.freeze({ path, data, size: data.length, sha256: member.sha256 }));
  }
  return Object.freeze(members);
}

export function verifyDownloadedRelease({ download, expectedIdentity, at }) {
  const roles = download.artifact_roles;
  const artifacts = artifactMap(download);
  const required = Object.values(roles);
  for (const name of required) if (!artifacts.has(name)) fail('REQUIRED_ARTIFACT_MISSING', name);
  const manifestBytes = artifacts.get(roles.manifest);
  const manifest = parseJson(manifestBytes, 'RELEASE_MANIFEST_INVALID_JSON');
  assertExactReleaseIdentity(download.identity, expectedIdentity);
  validateReleaseManifestBindings(manifest);
  assertExactReleaseIdentity(manifest, expectedIdentity);
  if (roles.checksums !== manifest.checksums.name
      || roles.manifest_signature !== manifest.signing.manifest_signature.name
      || roles.checksums_signature !== manifest.signing.checksums_signature.name) fail('RELEASE_ARTIFACT_ROLE_MISMATCH');
  if (!canonicalManifestBytes(manifest).equals(manifestBytes)) fail('RELEASE_MANIFEST_NON_CANONICAL');
  const trustStore = parseJson(artifacts.get(roles.trust_store), 'TRUST_STORE_INVALID_JSON');
  const manifestEnvelope = parseJson(artifacts.get(roles.manifest_signature), 'MANIFEST_SIGNATURE_INVALID_JSON');
  const checksumsBytes = artifacts.get(roles.checksums);
  const checksumsEnvelope = parseJson(artifacts.get(roles.checksums_signature), 'CHECKSUMS_SIGNATURE_INVALID_JSON');
  verifyTrustedSignature({ trustStore, envelope: manifestEnvelope, bytes: manifestBytes, at });
  verifyTrustedSignature({ trustStore, envelope: checksumsEnvelope, bytes: checksumsBytes, at });
  if (manifest.checksums.sha256 !== releaseSha256Bytes(checksumsBytes)) fail('CHECKSUMS_HASH_MISMATCH');
  assertChecksumBindings(parseChecksums(checksumsBytes), manifest.assets);
  const payloadAssets = manifest.assets.map((binding) => ({
    name: binding.name,
    bytes: artifacts.get(binding.name),
    media_type: binding.media_type,
    class: binding.class,
  }));
  if (payloadAssets.some((asset) => !asset.bytes)) fail('MISSING_ASSET');
  verifyAssetInventory(payloadAssets, manifest.assets);
  const archiveBinding = manifest.assets.find((asset) => asset.name === roles.payload_archive);
  if (!archiveBinding || archiveBinding.class !== 'RUNTIME') fail('PAYLOAD_ARCHIVE_BINDING_MISSING');
  const members = validateMembers(parseJson(artifacts.get(roles.payload_archive), 'PAYLOAD_ARCHIVE_INVALID'));
  const sensitiveScan = scanSensitiveEntries(members.map((member) => ({ path: member.path, bytes: member.data })));
  if (!sensitiveScan.ok) fail('SENSITIVE_PAYLOAD_REJECTED', sensitiveScan.findings.map((finding) => finding.code).join(','));
  return Object.freeze({ manifest, members });
}

async function ensureParents(root, logicalPath) {
  const parts = logicalPath.split('/');
  let current = root;
  for (const part of parts.slice(0, -1)) {
    current = resolve(current, part);
    if (!contained(root, current)) fail('PATH_OUTSIDE_ROOT', logicalPath);
    try { await mkdir(current, { mode: 0o700 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const observed = await lstat(current);
    if (!observed.isDirectory() || observed.isSymbolicLink()) fail('TYPE_CONFLICT', logicalPath);
  }
}

async function extractVerifiedMembers({ stagingRoot, members }) {
  const payloadRoot = resolve(stagingRoot, 'payload');
  if (!contained(stagingRoot, payloadRoot) || await metadata(payloadRoot)) fail('PAYLOAD_ROOT_INVALID');
  await mkdir(payloadRoot, { mode: 0o700 });
  for (const member of members) {
    await ensureParents(payloadRoot, member.path);
    const output = resolve(payloadRoot, ...member.path.split('/'));
    if (!contained(payloadRoot, output)) fail('PATH_OUTSIDE_ROOT', member.path);
    const handle = await open(output, 'wx', 0o600);
    try { await handle.writeFile(member.data); await handle.sync(); }
    finally { await handle.close(); }
    const reread = await readFile(output);
    const observed = await lstat(output);
    if (!observed.isFile() || observed.isSymbolicLink() || reread.length !== member.size || sha256Bytes(reread) !== member.sha256) fail('EXTRACTED_FILE_MISMATCH', member.path);
  }
  const payloadRealpath = await realpath(payloadRoot);
  if (!contained(stagingRoot, payloadRealpath)) fail('PAYLOAD_ROOT_INVALID');
  return Object.freeze({ payload_root: payloadRealpath, file_count: members.length, verification: 'REREAD_HASH_SIZE_MATCH' });
}

export async function verifyBeforeExtract({ download, expectedIdentity, stagingRoot, at }) {
  const root = await validateInstallerStaging(stagingRoot);
  const verified = verifyDownloadedRelease({ download, expectedIdentity, at });
  const extracted = await extractVerifiedMembers({ stagingRoot: root, members: verified.members });
  const verificationBinding = Object.freeze({
    method: 'VERIFY_BEFORE_EXTRACT',
    release_identity_sha256: canonicalSha256(expectedIdentity),
    manifest_sha256: releaseSha256Bytes(canonicalManifestBytes(verified.manifest)),
    payload_root: extracted.payload_root,
    file_count: extracted.file_count,
    staging_root: root,
  });
  return Object.freeze({
    ...extracted,
    release_id: verified.manifest.release_id,
    release_identity_sha256: verificationBinding.release_identity_sha256,
    manifest_sha256: verificationBinding.manifest_sha256,
    staging_root: root,
    verification_binding: verificationBinding,
  });
}
