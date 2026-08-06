import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto';
import { canonicalJson, canonicalSha256 } from './canonical-json.mjs';

const HASH_RE = /^[a-f0-9]{64}$/;
const COMMIT_RE = /^[a-f0-9]{40}$/;
const SEMVER_RE = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const MUTABLE_REFERENCE_RE = /(?:^|\/)(?:refs\/heads|heads)\/|raw\.githubusercontent\.com|[?&](?:ref|branch)=/i;

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function compareUtf8(left, right) {
  return Buffer.compare(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
}

function asBytes(value, code = 'BYTES_REQUIRED') {
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) fail(code);
  return Buffer.from(value);
}

export function sha256Bytes(value) {
  return createHash('sha256').update(asBytes(value)).digest('hex');
}

export function validateReleaseAssetName(name) {
  if (typeof name !== 'string' || name.length === 0 || Buffer.byteLength(name, 'utf8') > 1024) fail('INVALID_ASSET_NAME');
  if (name.startsWith('/') || name.startsWith('\\') || name.includes('\\') || name.includes('\0') || /[\x00-\x1f\x7f]/.test(name)) fail('UNSAFE_ASSET_NAME', name);
  const segments = name.split('/');
  if (segments.some((segment) => segment.length === 0 || segment === '.' || segment === '..')) fail('UNSAFE_ASSET_NAME', name);
  return name;
}

function normalizeAssetInput(asset) {
  if (!asset || typeof asset !== 'object' || Array.isArray(asset)) fail('INVALID_ASSET');
  const name = validateReleaseAssetName(asset.name);
  const bytes = asBytes(asset.bytes, `ASSET_BYTES_REQUIRED:${name}`);
  const mediaType = asset.media_type ?? 'application/octet-stream';
  const assetClass = asset.class ?? 'RUNTIME';
  if (typeof mediaType !== 'string' || mediaType.length === 0) fail('INVALID_MEDIA_TYPE', name);
  if (!['RUNTIME', 'MANIFEST', 'METADATA', 'CHECKSUMS', 'SIGNATURE', 'SBOM', 'TRUST', 'ATTESTATION'].includes(assetClass)) fail('INVALID_ASSET_CLASS', name);
  return { name, bytes, media_type: mediaType, class: assetClass };
}

export function buildAssetInventory(assets) {
  if (!Array.isArray(assets) || assets.length === 0) fail('ASSETS_REQUIRED');
  const seen = new Set();
  return assets.map(normalizeAssetInput).sort((a, b) => compareUtf8(a.name, b.name)).map((asset) => {
    if (seen.has(asset.name)) fail('DUPLICATE_ASSET', asset.name);
    seen.add(asset.name);
    return {
      name: asset.name,
      sha256: sha256Bytes(asset.bytes),
      size: asset.bytes.length,
      media_type: asset.media_type,
      class: asset.class,
    };
  });
}

export function serializeChecksums(inventory) {
  assertCanonicalInventory(inventory);
  return Buffer.from(inventory.map((asset) => `${asset.sha256}  ${asset.name}\n`).join(''), 'utf8');
}

export function parseChecksums(value) {
  const bytes = asBytes(value);
  const text = bytes.toString('utf8');
  if (!Buffer.from(text, 'utf8').equals(bytes)) fail('CHECKSUMS_NOT_UTF8');
  if (text.includes('\r') || !text.endsWith('\n') || text.length === 0) fail('CHECKSUMS_NON_CANONICAL_LINE_ENDING');
  const records = text.slice(0, -1).split('\n').map((line) => {
    const match = /^([a-f0-9]{64})  (.+)$/.exec(line);
    if (!match) fail('MALFORMED_CHECKSUM_LINE', line);
    return { sha256: match[1], name: validateReleaseAssetName(match[2]) };
  });
  const ordered = [...records].sort((a, b) => compareUtf8(a.name, b.name));
  if (ordered.some((record, index) => record.name !== records[index].name)) fail('CHECKSUMS_NOT_SORTED');
  if (new Set(records.map((record) => record.name)).size !== records.length) fail('DUPLICATE_CHECKSUM_ASSET');
  if (!serializeChecksums(records.map((record) => ({ ...record, size: 0 }))).equals(bytes)) fail('CHECKSUMS_NON_CANONICAL');
  return records;
}

export function assertCanonicalInventory(inventory) {
  if (!Array.isArray(inventory) || inventory.length === 0) fail('INVENTORY_REQUIRED');
  const names = new Set();
  let prior;
  for (const asset of inventory) {
    if (!asset || typeof asset !== 'object') fail('INVALID_INVENTORY_ASSET');
    validateReleaseAssetName(asset.name);
    if (!HASH_RE.test(asset.sha256 ?? '')) fail('INVALID_ASSET_SHA256', asset.name);
    if (!Number.isSafeInteger(asset.size) || asset.size < 0) fail('INVALID_ASSET_SIZE', asset.name);
    if (names.has(asset.name)) fail('DUPLICATE_ASSET', asset.name);
    if (prior !== undefined && compareUtf8(prior, asset.name) >= 0) fail('INVENTORY_NOT_SORTED');
    names.add(asset.name);
    prior = asset.name;
  }
  return true;
}

export function inventoryBinding(inventory) {
  assertCanonicalInventory(inventory);
  return canonicalSha256(inventory);
}

export function verifyAssetInventory(assets, expectedInventory) {
  const actual = buildAssetInventory(assets);
  assertCanonicalInventory(expectedInventory);
  const actualNames = new Set(actual.map((asset) => asset.name));
  const expectedNames = new Set(expectedInventory.map((asset) => asset.name));
  const missing = [...expectedNames].filter((name) => !actualNames.has(name)).sort(compareUtf8);
  const extra = [...actualNames].filter((name) => !expectedNames.has(name)).sort(compareUtf8);
  if (missing.length) fail('MISSING_ASSET', missing.join(','));
  if (extra.length) fail('UNEXPECTED_ASSET', extra.join(','));
  for (let index = 0; index < expectedInventory.length; index += 1) {
    const expected = expectedInventory[index];
    const observed = actual[index];
    if (observed.name !== expected.name) fail('ASSET_ORDER_MISMATCH', expected.name);
    if (observed.size !== expected.size) fail('ASSET_SIZE_MISMATCH', expected.name);
    if (observed.sha256 !== expected.sha256) fail('ASSET_HASH_MISMATCH', expected.name);
  }
  return { ok: true, assets: actual.length, inventory_sha256: inventoryBinding(expectedInventory) };
}

export function canonicalManifestBytes(manifest) {
  return Buffer.from(`${canonicalJson(manifest)}\n`, 'utf8');
}

function normalizePublicKey(publicKey) {
  try {
    if (publicKey?.type === 'public' && typeof publicKey.export === 'function') return publicKey;
    return createPublicKey(publicKey);
  } catch {
    fail('MALFORMED_PUBLIC_KEY');
  }
}

export function publicKeySpkiBytes(publicKey) {
  return Buffer.from(normalizePublicKey(publicKey).export({ type: 'spki', format: 'der' }));
}

export function publicKeyFingerprint(publicKey) {
  return sha256Bytes(publicKeySpkiBytes(publicKey));
}

export function publicKeySpkiBase64(publicKey) {
  return publicKeySpkiBytes(publicKey).toString('base64');
}

function validateSignatureMetadata({ target, targetName, keyId, fingerprintSha256 }) {
  if (!['MANIFEST', 'CHECKSUMS'].includes(target)) fail('INVALID_SIGNATURE_TARGET');
  validateReleaseAssetName(targetName);
  if (target === 'CHECKSUMS' && targetName !== 'SHA256SUMS') fail('CHECKSUMS_TARGET_NAME_MISMATCH');
  if (typeof keyId !== 'string' || !/^release-[a-z0-9][a-z0-9-]{2,63}$/.test(keyId)) fail('INVALID_KEY_ID');
  if (!HASH_RE.test(fingerprintSha256 ?? '')) fail('INVALID_KEY_FINGERPRINT');
}

export async function signDetached({ target, targetName, bytes, keyId, fingerprintSha256, signer }) {
  const targetBytes = asBytes(bytes);
  validateSignatureMetadata({ target, targetName, keyId, fingerprintSha256 });
  if (typeof signer !== 'function') fail('INJECTED_SIGNER_REQUIRED');
  const signature = asBytes(await signer(Buffer.from(targetBytes)), 'SIGNER_RESULT_INVALID');
  if (signature.length !== 64) fail('MALFORMED_ED25519_SIGNATURE');
  return {
    schema_version: 1,
    target,
    target_name: targetName,
    target_sha256: sha256Bytes(targetBytes),
    algorithm: 'Ed25519',
    key_id: keyId,
    fingerprint_sha256: fingerprintSha256,
    encoding: 'base64',
    signature: signature.toString('base64'),
  };
}

export function verifyDetachedSignature({ bytes, envelope, publicKey }) {
  const targetBytes = asBytes(bytes);
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) fail('SIGNATURE_ENVELOPE_REQUIRED');
  validateSignatureMetadata({ target: envelope.target, targetName: envelope.target_name, keyId: envelope.key_id, fingerprintSha256: envelope.fingerprint_sha256 });
  if (envelope.algorithm !== 'Ed25519' || envelope.encoding !== 'base64') fail('UNSUPPORTED_SIGNATURE_FORMAT');
  if (envelope.target_sha256 !== sha256Bytes(targetBytes)) fail('SIGNED_TARGET_HASH_MISMATCH');
  let signature;
  try {
    signature = Buffer.from(envelope.signature, 'base64');
  } catch {
    fail('MALFORMED_SIGNATURE_ENCODING');
  }
  if (signature.length !== 64 || signature.toString('base64') !== envelope.signature) fail('MALFORMED_ED25519_SIGNATURE');
  const fingerprint = publicKeyFingerprint(publicKey);
  if (fingerprint !== envelope.fingerprint_sha256) fail('PUBLIC_KEY_FINGERPRINT_MISMATCH');
  let verified = false;
  try { verified = verifySignature(null, targetBytes, normalizePublicKey(publicKey), signature); } catch { fail('MALFORMED_PUBLIC_KEY'); }
  if (!verified) fail('SIGNATURE_INVALID');
  return { ok: true, target: envelope.target, key_id: envelope.key_id, target_sha256: envelope.target_sha256 };
}

export function assertExactReleaseIdentity(observed, expected) {
  if (!observed || !expected) fail('RELEASE_IDENTITY_REQUIRED');
  const fields = ['release_id', 'version', 'tag', 'commit_sha', 'repository'];
  for (const field of fields) if (observed[field] !== expected[field]) fail('RELEASE_IDENTITY_MISMATCH', field);
  if (!SEMVER_RE.test(observed.version ?? '') || observed.tag !== `v${observed.version}`) fail('SEMVER_TAG_MISMATCH');
  if (!COMMIT_RE.test(observed.commit_sha ?? '')) fail('INVALID_COMMIT_SHA');
  return true;
}

export function assertImmutableReleaseReference(reference) {
  if (typeof reference !== 'string' || reference.length === 0) fail('RELEASE_REFERENCE_REQUIRED');
  if (MUTABLE_REFERENCE_RE.test(reference) || /(?:^|\/)main(?:$|\/)|(?:^|\/)master(?:$|\/)/i.test(reference)) fail('MUTABLE_RELEASE_REFERENCE', reference);
  return reference;
}

export function validateReleaseManifestBindings(manifest) {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail('RELEASE_MANIFEST_REQUIRED');
  if (!SEMVER_RE.test(manifest.version ?? '') || manifest.tag !== `v${manifest.version}`) fail('SEMVER_TAG_MISMATCH');
  if (!COMMIT_RE.test(manifest.commit_sha ?? '')) fail('INVALID_COMMIT_SHA');
  assertCanonicalInventory(manifest.assets);
  if (manifest.asset_inventory_sha256 !== inventoryBinding(manifest.assets)) fail('ASSET_INVENTORY_BINDING_MISMATCH');
  if (manifest.checksums?.name !== 'SHA256SUMS' || manifest.checksums?.algorithm !== 'SHA-256' || manifest.checksums?.serialization !== 'LOWERCASE_HEX_TWO_SPACES_NAME_LF') fail('CHECKSUMS_BINDING_INVALID');
  if (manifest.signing?.algorithm !== 'Ed25519') fail('SIGNING_ALGORITHM_INVALID');
  if (manifest.signing?.manifest_signature?.name === manifest.signing?.checksums_signature?.name) fail('SIGNATURE_ASSETS_NOT_SEPARATE');
  const sbomAsset = manifest.assets.find((asset) => asset.name === manifest.sbom?.name && asset.class === 'SBOM');
  if (!sbomAsset || sbomAsset.sha256 !== manifest.sbom?.sha256) fail('SBOM_BINDING_MISMATCH');
  if (manifest.sbom_sha256 !== undefined && manifest.sbom_sha256 !== manifest.sbom.sha256) fail('SBOM_HASH_MISMATCH');
  return { ok: true, assets: manifest.assets.length, manifest_sha256: sha256Bytes(canonicalManifestBytes(manifest)) };
}
