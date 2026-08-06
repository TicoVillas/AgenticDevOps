import { constants, createWriteStream } from 'node:fs';
import { access, lstat, mkdir, open, readFile, readdir, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export function createNodeFilesystemAdapter({ atomicRenameSupported = true } = {}) {
  return Object.freeze({
    platform: process.platform,
    atomicRenameSupported,
    access,
    lstat,
    mkdir,
    open,
    readFile,
    readdir,
    rename,
    rm,
    stat,
    unlink,
    writeFile,
    createWriteStream,
    constants,
    dirname,
    async syncFile(path) {
      const handle = await open(path, 'r');
      try { await handle.sync(); } finally { await handle.close(); }
    },
    async syncDirectory(path) {
      if (process.platform === 'win32') return Object.freeze({ supported: false, reason: 'DIRECTORY_FSYNC_UNAVAILABLE' });
      const handle = await open(path, 'r');
      try { await handle.sync(); return Object.freeze({ supported: true }); } finally { await handle.close(); }
    },
  });
}
