import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type {
  SkillInstallation,
  SkillOperationError,
  SkillPlatform
} from '../../shared/skillTypes';
import type { SkillFileSystem } from './skillFileSystem';
import {
  hasPortablePathCollision,
  isPortableRelativePath,
  isSafeDirectoryName,
  resolveDirectoryInside,
  resolveInside
} from './skillPath';
import {
  nativePlatformPathContext,
  type PlatformPathContext
} from './platformPaths';
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
  fs: SkillFileSystem,
  pathContext: PlatformPathContext = nativePlatformPathContext
): Promise<SkillInstallation> {
  const targetPath = resolveDirectoryInside(targetRoot, directoryName, pathContext);
  if (!targetPath) {
    return { state: 'failed', targetPath: targetRoot, errorCode: 'io_error' };
  }
  try {
    await assertSafeTargetRoot(targetRoot, fs, pathContext);
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
    const entryPath = pathContext.path.join(targetPath, 'SKILL.md');
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
  pathContext?: PlatformPathContext;
}): Promise<{ ok: true; targetPath: string } | { ok: false; error: SkillOperationError }> {
  const { source, targetRoot, fs } = options;
  const pathContext = options.pathContext ?? nativePlatformPathContext;
  const targetPath = resolveDirectoryInside(targetRoot, source.directoryName, pathContext);
  if (
    !targetPath ||
    !isSafeDirectoryName(source.directoryName) ||
    !source.files.every(isPortableRelativePath) || hasPortablePathCollision(source.files)
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

  let safeTargetBoundary: string;
  try {
    safeTargetBoundary = await assertSafeTargetRoot(targetRoot, fs, pathContext);
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
    await assertSafeTargetRoot(targetRoot, fs, pathContext, safeTargetBoundary);
  } catch (error) {
    return {
      ok: false,
      error: mapTargetWriteError(error, targetRoot, 'copy_failed')
    };
  }

  let stagingPath: string | null = null;
  let targetReserved = false;
  try {
    stagingPath = await createStagingDirectory(
      targetRoot,
      source.directoryName,
      fs,
      randomUUID,
      pathContext
    );
    let writtenCount = 0;
    for (const portablePath of source.files) {
      const stagingFile = resolveInside(stagingPath, portablePath, pathContext);
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
        await fs.mkdir(pathContext.path.dirname(stagingFile), { recursive: true });
        await fs.writeFile(stagingFile, data);
        writtenCount += 1;
      } catch (error) {
        throw new InstallFailure(mapTargetWriteError(error, stagingFile, 'copy_failed'));
      }
    }

    const stagedEntry = resolveInside(stagingPath, 'SKILL.md', pathContext);
    if (!stagedEntry || writtenCount !== source.files.length) {
      throw new InstallFailure({ code: 'copy_failed', path: stagingPath, retryable: true });
    }
    const stagedEntryStats = await fs.lstat(stagedEntry);
    if (stagedEntryStats.isSymbolicLink() || !stagedEntryStats.isFile()) {
      throw new InstallFailure({ code: 'copy_failed', path: stagedEntry, retryable: true });
    }

    await assertSafeTargetRoot(targetRoot, fs, pathContext, safeTargetBoundary);
    // POSIX rename replaces an empty directory, so an exclusive reservation closes the
    // no-replace race there. Windows directory rename already refuses an existing target.
    // Do not create and immediately remove a Windows reservation: the deleted directory can
    // remain pending briefly and make the following rename fail with EACCES/EPERM.
    if (pathContext.platform !== 'win32') {
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
    }
    await commitStagingDirectory(stagingPath, targetPath, fs, pathContext);
    targetReserved = false;
    return { ok: true, targetPath };
  } catch (error) {
    if (stagingPath) {
      await fs.rm(stagingPath, { recursive: true, force: true }).catch(() => undefined);
    }
    if (targetReserved) {
      await fs.rmdir(targetPath).catch(() => undefined);
    }
    return {
      ok: false,
      error:
        error instanceof InstallFailure
          ? error.operationError
          : mapTargetWriteError(error, stagingPath ?? targetRoot, 'copy_failed')
    };
  }
}

const WINDOWS_COMMIT_RETRY_DELAYS_MS = [25, 50, 100, 200, 400, 800];

async function commitStagingDirectory(
  stagingPath: string,
  targetPath: string,
  fs: SkillFileSystem,
  pathContext: PlatformPathContext
): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await fs.rename(stagingPath, targetPath);
      return;
    } catch (error) {
      const code = nodeErrorCode(error);
      if (code === 'EEXIST' || code === 'ENOTEMPTY' || code === 'EISDIR') {
        throw new InstallFailure({
          code: 'target_conflict',
          path: targetPath,
          retryable: true
        });
      }
      if (pathContext.platform === 'win32' && (code === 'EACCES' || code === 'EPERM')) {
        const existing = await inspectExistingTarget(targetPath, fs);
        if (existing) {
          throw new InstallFailure(existing.error);
        }
        const retryDelay = WINDOWS_COMMIT_RETRY_DELAYS_MS[attempt];
        if (retryDelay !== undefined) {
          await delay(retryDelay);
          continue;
        }
      }
      throw new InstallFailure(mapTargetWriteError(error, targetPath, 'commit_failed'));
    }
  }
}

const STAGING_NAME_MAX_LENGTH = 12;
const STAGING_ALPHABET = '0123456789abcdef';

export function createStagingDirectoryName(
  targetDirectoryName: string,
  token: string
): string {
  const budget = Math.min(targetDirectoryName.length, STAGING_NAME_MAX_LENGTH);
  const normalizedToken = token.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (budget < 1 || normalizedToken.length < 1) {
    throw new Error('A target directory name and random token are required');
  }
  let candidate = normalizedToken.slice(0, budget);
  if (candidate.toLowerCase() === targetDirectoryName.toLowerCase()) {
    const finalIndex = candidate.length - 1;
    const currentIndex = STAGING_ALPHABET.indexOf(candidate[finalIndex]);
    const replacement =
      STAGING_ALPHABET[(currentIndex + 1) % STAGING_ALPHABET.length];
    candidate = `${candidate.slice(0, finalIndex)}${replacement}`;
  }
  return candidate;
}

export async function createStagingDirectory(
  targetRoot: string,
  targetDirectoryName: string,
  fs: SkillFileSystem,
  createToken: () => string = randomUUID,
  pathContext: PlatformPathContext = nativePlatformPathContext
): Promise<string> {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    // Keep the temporary path component no longer than the final directory name.
    // Otherwise a final path that fits on Windows can fail only while staging.
    const stagingName = createStagingDirectoryName(
      targetDirectoryName,
      createToken()
    );
    const candidate = pathContext.path.join(targetRoot, stagingName);
    try {
      await fs.mkdir(candidate);
      return candidate;
    } catch (error) {
      if (nodeErrorCode(error) !== 'EEXIST') {
        throw error;
      }
    }
  }
  throw Object.assign(new Error('Unable to reserve a staging directory'), {
    code: 'EEXIST',
    path: targetRoot
  });
}

export async function packageSkillContent(options: {
  source: SkillContentSource;
  packageDirectory: string;
  fs: SkillFileSystem;
  pathContext?: PlatformPathContext;
}): Promise<{ ok: true; outputPath: string } | { ok: false; error: SkillOperationError }> {
  const { source, packageDirectory, fs } = options;
  const pathContext = options.pathContext ?? nativePlatformPathContext;
  if (source.files.length === 0) {
    return { ok: false, error: { code: 'empty_skill', retryable: false } };
  }
  if (
    !isSafeDirectoryName(source.directoryName) ||
    !source.files.every(isPortableRelativePath) || hasPortablePathCollision(source.files)
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
  const outputPath = pathContext.path.join(
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

async function assertSafeTargetRoot(
  targetRoot: string,
  fs: SkillFileSystem,
  pathContext: PlatformPathContext,
  requiredBoundary?: string
): Promise<string> {
  let candidatePath = pathContext.path.resolve(targetRoot);
  const directParent = pathContext.path.dirname(candidatePath);
  const boundary = requiredBoundary
    ? pathContext.path.resolve(requiredBoundary)
    : directParent;
  if (
    requiredBoundary &&
    !isPathInsideOrEqual(candidatePath, boundary, pathContext)
  ) {
    throw unsafeTargetError(candidatePath);
  }
  let reachedDirectParent = pathsEqual(candidatePath, directParent, pathContext);
  while (true) {
    try {
      const stats = await fs.lstat(candidatePath);
      if (stats.isSymbolicLink() || !stats.isDirectory()) {
        throw unsafeTargetError(candidatePath);
      }
      if (
        (requiredBoundary && pathsEqual(candidatePath, boundary, pathContext)) ||
        (!requiredBoundary && reachedDirectParent)
      ) {
        return candidatePath;
      }
    } catch (error) {
      if (nodeErrorCode(error) !== 'ENOENT') {
        throw error;
      }
    }
    const parent = pathContext.path.dirname(candidatePath);
    if (parent === candidatePath) {
      throw unsafeTargetError(candidatePath);
    }
    candidatePath = parent;
    reachedDirectParent =
      reachedDirectParent || pathsEqual(candidatePath, directParent, pathContext);
  }
}

function isPathInsideOrEqual(
  path: string,
  root: string,
  pathContext: PlatformPathContext
): boolean {
  const relative = pathContext.path.relative(root, path);
  return (
    relative === '' ||
    (relative !== '..' &&
      !relative.startsWith(`..${pathContext.path.sep}`) &&
      !pathContext.path.isAbsolute(relative))
  );
}
function pathsEqual(left: string, right: string, pathContext: PlatformPathContext): boolean {
  const normalize = (value: string) => pathContext.path.resolve(value);
  return pathContext.caseInsensitive
    ? normalize(left).toLowerCase() === normalize(right).toLowerCase()
    : normalize(left) === normalize(right);
}

function unsafeTargetError(path: string): Error {
  return Object.assign(new Error('Unsafe skill target root'), {
    code: 'ELOOP',
    path
  });
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
