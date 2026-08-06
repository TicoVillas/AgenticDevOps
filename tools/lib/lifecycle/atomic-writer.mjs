import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { containedLifecyclePath } from './paths.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function fail(code, point = null) {
  const error = new Error(code);
  error.code = code;
  if (point) error.lifecyclePoint = point;
  throw error;
}

async function inject(faultInjector, point, context) {
  try { await faultInjector({ point, ...context }); }
  catch (error) { error.lifecyclePoint ??= point; throw error; }
}

async function safeParent(fs, root, relativePath) {
  const target = containedLifecyclePath(root, relativePath);
  const parts = relativePath.split('/').slice(0, -1);
  let cursor = root;
  const rootMetadata = await fs.lstat(root);
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) fail('DESTINATION_ROOT_UNSAFE');
  for (const part of parts) {
    cursor = containedLifecyclePath(cursor, part);
    try {
      const metadata = await fs.lstat(cursor);
      if (metadata.isSymbolicLink() || !metadata.isDirectory()) fail('DESTINATION_ANCESTOR_UNSAFE');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await fs.mkdir(cursor, { mode: 0o755 });
    }
  }
  try {
    const metadata = await fs.lstat(target);
    if (metadata.isSymbolicLink() || !metadata.isFile()) fail('DESTINATION_TYPE_UNSAFE');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return target;
}

export async function atomicReplaceFile({ fs, root, relativePath, bytes, expectedSha256, operationId, sequence, faultInjector = async () => {} }) {
  if (!fs?.atomicRenameSupported) fail('ATOMICITY_UNSUPPORTED', 'before-write');
  const destination = await safeParent(fs, root, relativePath);
  const stageName = `.${basename(destination)}.${operationId}.${String(sequence).padStart(6, '0')}.stage`;
  const stage = containedLifecyclePath(fs.dirname(destination), stageName);
  const context = { relativePath, sequence, operationId };
  await inject(faultInjector, 'before-write', context);
  await fs.writeFile(stage, bytes, { flag: 'wx', mode: 0o600 });
  await inject(faultInjector, 'after-stage-write', context);
  if (sha256(await fs.readFile(stage)) !== expectedSha256) fail('STAGE_HASH_MISMATCH', 'after-stage-write');
  await inject(faultInjector, 'before-sync', context);
  await fs.syncFile(stage);
  await inject(faultInjector, 'after-sync', context);
  await inject(faultInjector, 'before-rename', context);
  await fs.rename(stage, destination);
  await inject(faultInjector, 'after-rename', context);
  await fs.syncDirectory(fs.dirname(destination));
  if (sha256(await fs.readFile(destination)) !== expectedSha256) fail('DESTINATION_HASH_MISMATCH', 'after-rename');
  await inject(faultInjector, 'after-write', context);
  return Object.freeze({ sha256: expectedSha256, atomicity: 'ATOMIC_RENAME', file_synced: true, directory_sync_attempted: true });
}
