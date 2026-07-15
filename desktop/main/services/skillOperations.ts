import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import type {
  SkillInstallation,
  SkillOperationError,
  SkillPlatform
} from '../../shared/skillTypes';
import type { SkillFileSystem } from './skillFileSystem';
import {
  isPortableRelativePath,
  isSafeDirectoryName,
  resolveDirectoryInside,
  resolveInside
} from './skillPath';
import { writeZipFile } from './zipWriter';

export interface SkillContentSource {
  id: string;
  directoryName: string;
  files: string[];
  readFile(portablePath: string): Promise<Buffer>;
}

export class SkillSourceError extends Error {
  constructor(
    readonly operationCode: 'source_missing' | 'source_unreadable' | 'unsupported_entry',
    readonly path?: string
  ) {
    super(operationCode);
  }
}

export async function probeSkillInstallation(
  directoryName: string,
  targetRoot: string,
  fs: SkillFileSystem
): Promise<SkillInstallation> {
  const targetPath = resolveDirectoryInside(targetRoot, directoryName);
  if (!targetPath) {
    return { state: 'failed', targetPath: targetRoot, errorCode: 'io_error' };
  }
  try {
    await assertSafeTargetRoot(targetRoot, fs);
  } catch (error) {
    return {
      state: 'failed',
      targetPath,
      errorCode:
        nodeErrorCode(error) === 'EACCES' || nodeErrorCode(error) === 'EPERM'
          ? 'permission_denied'
          : 'target_unreadable'
    };
  }
  let targetExists = false;
  try {
    const targetStats = await fs.lstat(targetPath);
    targetExists = true;
    if (targetStats.isSymbolicLink() || !targetStats.isDirectory()) {
      return { state: 'conflict', targetPath, errorCode: 'target_conflict' };
    }
    const entryPath = join(targetPath, 'SKILL.md');
    const entryStats = await fs.lstat(entryPath);
    if (entryStats.isSymbolicLink() || !entryStats.isFile()) {
      return { state: 'conflict', targetPath, errorCode: 'target_conflict' };
    }
    await fs.readFile(entryPath);
    return { state: 'installed', targetPath };
  } catch (error) {
    const code = nodeErrorCode(error);
    if (code === 'ENOENT') {
      return targetExists
        ? { state: 'conflict', targetPath, errorCode: 'target_conflict' }
        : { state: 'missing', targetPath };
    }
    if (code === 'EACCES' || code === 'EPERM') {
      return { state: 'failed', targetPath, errorCode: 'permission_denied' };
    }
    if (code === 'ENOTDIR') {
      return { state: 'conflict', targetPath, errorCode: 'target_conflict' };
    }
    return { state: 'failed', targetPath, errorCode: 'target_unreadable' };
  }
}

export async function installSkillContent(options: {
  source: SkillContentSource;
  platform: SkillPlatform;
  targetRoot: string;
  fs: SkillFileSystem;
}): Promise<{ ok: true; targetPath: string } | { ok: false; error: SkillOperationError }> {
  const { source, targetRoot, fs } = options;
  const targetPath = resolveDirectoryInside(targetRoot, source.directoryName);
  if (
    !targetPath ||
    !isSafeDirectoryName(source.directoryName) ||
    !source.files.every(isPortableRelativePath)
  ) {
    return {
      ok: false,
      error: { code: 'invalid_request', path: targetPath ?? targetRoot, retryable: false }
    };
  }
  if (!source.files.includes('SKILL.md')) {
    return {
      ok: false,
      error: { code: 'source_missing', retryable: true }
    };
  }

  try {
    await assertSafeTargetRoot(targetRoot, fs);
  } catch (error) {
    return {
      ok: false,
      error: mapUnsafeTargetError(error, targetRoot)
    };
  }

  const existing = await inspectExistingTarget(targetPath, fs);
  if (existing) {
    return existing;
  }

  try {
    await fs.mkdir(targetRoot, { recursive: true });
    await assertSafeTargetRoot(targetRoot, fs);
  } catch (error) {
    return {
      ok: false,
      error: mapTargetWriteError(error, targetRoot, 'copy_failed')
    };
  }

  const stagingPath = join(targetRoot, `.spellbook-install-${randomUUID()}`);
  let targetReserved = false;
  try {
    await fs.mkdir(stagingPath);
    let writtenCount = 0;
    for (const portablePath of source.files) {
      const stagingFile = resolveInside(stagingPath, portablePath);
      if (!stagingFile) {
        throw new InstallFailure({
          code: 'invalid_request',
          path: portablePath,
          retryable: false
        });
      }
      let data: Buffer;
      try {
        data = await source.readFile(portablePath);
      } catch (error) {
        throw new InstallFailure(mapSourceError(error));
      }
      try {
        await fs.mkdir(dirname(stagingFile), { recursive: true });
        await fs.writeFile(stagingFile, data);
        writtenCount += 1;
      } catch (error) {
        throw new InstallFailure(mapTargetWriteError(error, stagingFile, 'copy_failed'));
      }
    }

    const stagedEntry = resolveInside(stagingPath, 'SKILL.md');
    if (!stagedEntry || writtenCount !== source.files.length) {
      throw new InstallFailure({ code: 'copy_failed', path: stagingPath, retryable: true });
    }
    const stagedEntryStats = await fs.lstat(stagedEntry);
    if (stagedEntryStats.isSymbolicLink() || !stagedEntryStats.isFile()) {
      throw new InstallFailure({ code: 'copy_failed', path: stagedEntry, retryable: true });
    }

    await assertSafeTargetRoot(targetRoot, fs);
    try {
      await fs.mkdir(targetPath);
      targetReserved = true;
    } catch (error) {
      const code = nodeErrorCode(error);
      if (code === 'EEXIST' || code === 'ENOTEMPTY' || code === 'EISDIR') {
        throw new InstallFailure({
          code: 'target_conflict',
          path: targetPath,
          retryable: true
        });
      }
      throw new InstallFailure(mapTargetWriteError(error, targetPath, 'commit_failed'));
    }

    // POSIX rename replaces an empty directory, so keeping our exclusive reservation in
    // place closes the no-replace race. Windows rename already refuses an existing target;
    // remove only our empty reservation there, then rely on that native no-replace behavior.
    if (process.platform === 'win32') {
      try {
        await fs.rmdir(targetPath);
        targetReserved = false;
      } catch (error) {
        if (nodeErrorCode(error) === 'ENOTEMPTY' || nodeErrorCode(error) === 'EEXIST') {
          throw new InstallFailure({
            code: 'target_conflict',
            path: targetPath,
            retryable: true
          });
        }
        throw new InstallFailure(mapTargetWriteError(error, targetPath, 'commit_failed'));
      }
    }
    try {
      await fs.rename(stagingPath, targetPath);
    } catch (error) {
      const code = nodeErrorCode(error);
      if (
        code === 'EEXIST' ||
        code === 'ENOTEMPTY' ||
        (process.platform === 'win32' &&
          (code === 'EACCES' || code === 'EPERM') &&
          (await inspectExistingTarget(targetPath, fs)) !== null)
      ) {
        throw new InstallFailure({
          code: 'target_conflict',
          path: targetPath,
          retryable: true
        });
      }
      throw new InstallFailure(mapTargetWriteError(error, targetPath, 'commit_failed'));
    }
    targetReserved = false;
    return { ok: true, targetPath };
  } catch (error) {
    await fs.rm(stagingPath, { recursive: true, force: true }).catch(() => undefined);
    if (targetReserved) {
      await fs.rmdir(targetPath).catch(() => undefined);
    }
    return {
      ok: false,
      error:
        error instanceof InstallFailure
          ? error.operationError
          : mapTargetWriteError(error, stagingPath, 'copy_failed')
    };
  }
}

export async function packageSkillContent(options: {
  source: SkillContentSource;
  packageDirectory: string;
  fs: SkillFileSystem;
}): Promise<{ ok: true; outputPath: string } | { ok: false; error: SkillOperationError }> {
  const { source, packageDirectory, fs } = options;
  if (source.files.length === 0) {
    return { ok: false, error: { code: 'empty_skill', retryable: false } };
  }
  if (
    !isSafeDirectoryName(source.directoryName) ||
    !source.files.every(isPortableRelativePath)
  ) {
    return { ok: false, error: { code: 'invalid_request', retryable: false } };
  }

  const entries = [];
  try {
    for (const portablePath of source.files) {
      entries.push({
        name: `${source.directoryName}/${portablePath}`,
        data: await source.readFile(portablePath)
      });
    }
  } catch (error) {
    return { ok: false, error: mapSourceError(error) };
  }

  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const outputPath = join(
    packageDirectory,
    `${sanitizeFileName(source.directoryName)}-${suffix}.zip`
  );
  const temporaryPath = `${outputPath}.tmp`;
  try {
    await fs.mkdir(packageDirectory, { recursive: true });
    await writeZipFile(temporaryPath, entries);
    await fs.rename(temporaryPath, outputPath);
    return { ok: true, outputPath };
  } catch (error) {
    await fs.rm(temporaryPath, { recursive: false, force: true }).catch(() => undefined);
    return {
      ok: false,
      error: mapTargetWriteError(error, outputPath, 'write_failed')
    };
  }
}

async function assertSafeTargetRoot(targetRoot: string, fs: SkillFileSystem): Promise<void> {
  let existingPath = resolve(targetRoot);
  while (true) {
    try {
      const stats = await fs.lstat(existingPath);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw unsafeTargetError(existingPath);
      }
      const canonicalPath = await fs.realpath(existingPath);
      if (normalizeComparablePath(canonicalPath) !== normalizeComparablePath(existingPath)) {
        throw unsafeTargetError(existingPath);
      }
      return;
    } catch (error) {
      if (nodeErrorCode(error) !== 'ENOENT') {
        throw error;
      }
      const parent = dirname(existingPath);
      if (parent === existingPath) {
        throw error;
      }
      existingPath = parent;
    }
  }
}

function unsafeTargetError(path: string): Error {
  return Object.assign(new Error('Unsafe skill target root'), {
    code: 'ELOOP',
    path
  });
}

function normalizeComparablePath(path: string): string {
  const normalized = resolve(path);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function mapUnsafeTargetError(error: unknown, fallbackPath: string): SkillOperationError {
  const code = nodeErrorCode(error);
  return {
    code: code === 'EACCES' || code === 'EPERM' ? 'permission_denied' : 'unsupported_entry',
    path: nodeErrorPath(error) ?? fallbackPath,
    retryable: code === 'EACCES' || code === 'EPERM'
  };
}

async function inspectExistingTarget(
  targetPath: string,
  fs: SkillFileSystem
): Promise<{ ok: false; error: SkillOperationError } | null> {
  try {
    await fs.lstat(targetPath);
    return {
      ok: false,
      error: { code: 'target_conflict', path: targetPath, retryable: true }
    };
  } catch (error) {
    const code = nodeErrorCode(error);
    if (code === 'ENOENT') {
      return null;
    }
    return {
      ok: false,
      error: mapTargetWriteError(error, targetPath, 'io_error')
    };
  }
}

function mapSourceError(error: unknown): SkillOperationError {
  if (error instanceof SkillSourceError) {
    return {
      code: error.operationCode,
      path: error.path,
      retryable: error.operationCode !== 'unsupported_entry'
    };
  }
  const code = nodeErrorCode(error);
  if (code === 'ENOENT') {
    return { code: 'source_missing', path: nodeErrorPath(error), retryable: true };
  }
  if (code === 'EACCES' || code === 'EPERM') {
    return { code: 'source_unreadable', path: nodeErrorPath(error), retryable: true };
  }
  return { code: 'source_unreadable', path: nodeErrorPath(error), retryable: true };
}

function mapTargetWriteError(
  error: unknown,
  fallbackPath: string,
  fallbackCode: 'copy_failed' | 'commit_failed' | 'write_failed' | 'io_error'
): SkillOperationError {
  const code = nodeErrorCode(error);
  return {
    code: code === 'EACCES' || code === 'EPERM' ? 'permission_denied' : fallbackCode,
    path: nodeErrorPath(error) ?? fallbackPath,
    retryable: true
  };
}

class InstallFailure extends Error {
  constructor(readonly operationError: SkillOperationError) {
    super(operationError.code);
  }
}

function nodeErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function nodeErrorPath(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'path' in error
    ? String((error as { path?: unknown }).path)
    : undefined;
}

function sanitizeFileName(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'skill';
}
