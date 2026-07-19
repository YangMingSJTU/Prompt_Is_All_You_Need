import type { Dirent, Stats } from 'node:fs';
import type {
  SkillPlatform,
  SkillScanError,
  SkillScanErrorCode
} from '../../shared/skillTypes';
import type { SkillFileSystem } from './skillFileSystem';
import {
  createLocalSkillId,
  hasPortablePathCollision,
  isPortableRelativePath,
  isSafeDirectoryName,
  nativePathToPortableRelative
} from './skillPath';
import {
  nativePlatformPathContext,
  type PlatformPathContext
} from './platformPaths';

export interface SkillRoot {
  platform: SkillPlatform;
  path: string;
}

export interface LocalSkillSnapshot {
  id: string;
  platform: SkillPlatform;
  directoryName: string;
  name: string;
  description: string;
  rootPath: string;
  entryFilePath: string;
  files: string[];
  updatedAt: string;
  packageable: boolean;
}

export type SkillRootScanResult =
  | {
      platform: SkillPlatform;
      path: string;
      status: 'success' | 'missing_directory';
      skills: LocalSkillSnapshot[];
    }
  | {
      platform: SkillPlatform;
      path: string;
      status: 'unreadable' | 'failed';
      error: SkillScanError;
    };

export async function scanSkillRoot(
  root: SkillRoot,
  fs: SkillFileSystem,
  pathContext: PlatformPathContext = nativePlatformPathContext
): Promise<SkillRootScanResult> {
  let rootStats: Stats;
  try {
    rootStats = await fs.lstat(root.path);
  } catch (error) {
    if (nodeErrorCode(error) === 'ENOENT') {
      return {
        platform: root.platform,
        path: root.path,
        status: 'missing_directory',
        skills: []
      };
    }
    const mapped = mapScanError(error, root.path);
    return {
      platform: root.platform,
      path: root.path,
      status: mapped.code === 'permission_denied' ? 'unreadable' : 'failed',
      error: mapped
    };
  }

  try {
    if (rootStats.isSymbolicLink()) {
      throw new ScanFailure('unsupported_entry', root.path);
    }
    if (!rootStats.isDirectory()) {
      throw new ScanFailure('not_directory', root.path);
    }

    const entries = await fs.readdir(root.path);
    const skills: LocalSkillSnapshot[] = [];
    for (const entry of sortEntries(entries)) {
      const entryPath = pathContext.path.join(root.path, entry.name);
      if (!isSafeDirectoryName(entry.name)) {
        throw new ScanFailure('unsupported_entry', entryPath);
      }
      if (entry.isSymbolicLink()) {
        throw new ScanFailure('unsupported_entry', entryPath);
      }
      if (!entry.isDirectory()) {
        if (!entry.isFile()) {
          throw new ScanFailure('unsupported_entry', entryPath);
        }
        continue;
      }

      const entryFilePath = pathContext.path.join(entryPath, 'SKILL.md');
      let entryStats: Stats;
      try {
        entryStats = await fs.lstat(entryFilePath);
      } catch (error) {
        if (nodeErrorCode(error) === 'ENOENT') {
          continue;
        }
        throw error;
      }
      if (entryStats.isSymbolicLink() || !entryStats.isFile()) {
        throw new ScanFailure('unsupported_entry', entryFilePath);
      }

      const fileEntries = await collectFiles(entryPath, fs, pathContext);
      if (hasPortablePathCollision(fileEntries.map((file) => file.path))) {
        throw new ScanFailure('unsupported_entry', entryPath);
      }
      const manifest = readSkillManifest(
        (await fs.readFile(entryFilePath)).toString('utf8')
      );
      const latestMtime = fileEntries.reduce(
        (latest, file) => Math.max(latest, file.stats.mtimeMs),
        entryStats.mtimeMs
      );
      const files = fileEntries.map((file) => file.path);
      skills.push({
        id: createLocalSkillId(root.platform, entryPath, pathContext),
        platform: root.platform,
        directoryName: pathContext.path.basename(entryPath),
        name: manifest.name ?? entry.name,
        description: manifest.description ?? '',
        rootPath: pathContext.path.resolve(entryPath),
        entryFilePath: pathContext.path.resolve(entryFilePath),
        files,
        updatedAt: new Date(latestMtime || Date.now()).toISOString(),
        packageable: files.length > 0
      });
    }
    return {
      platform: root.platform,
      path: root.path,
      status: 'success',
      skills
    };
  } catch (error) {
    const mapped = mapScanError(error, root.path);
    return {
      platform: root.platform,
      path: root.path,
      status: mapped.code === 'permission_denied' ? 'unreadable' : 'failed',
      error: mapped
    };
  }
}

async function collectFiles(
  rootPath: string,
  fs: SkillFileSystem,
  pathContext: PlatformPathContext
): Promise<Array<{ path: string; stats: Stats }>> {
  const result: Array<{ path: string; stats: Stats }> = [];

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath);
    for (const entry of sortEntries(entries)) {
      const absolutePath = pathContext.path.join(currentPath, entry.name);
      if (entry.isSymbolicLink()) {
        throw new ScanFailure('unsupported_entry', absolutePath);
      }
      const stats = await fs.lstat(absolutePath);
      if (stats.isSymbolicLink()) {
        throw new ScanFailure('unsupported_entry', absolutePath);
      }
      if (stats.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (!stats.isFile()) {
        throw new ScanFailure('unsupported_entry', absolutePath);
      }
      const portablePath = nativePathToPortableRelative(
        rootPath,
        absolutePath,
        pathContext
      );
      if (!portablePath || !isPortableRelativePath(portablePath)) {
        throw new ScanFailure('path_escape', absolutePath);
      }
      result.push({ path: portablePath, stats });
    }
  }

  await walk(rootPath);
  return result.sort((left, right) => left.path.localeCompare(right.path));
}

function readSkillManifest(content: string): { name: string | null; description: string | null } {
  if (!content.startsWith('---')) {
    return { name: null, description: null };
  }
  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { name: null, description: null };
  }
  const values = new Map<string, string>();
  for (const line of content.slice(3, endIndex).split(/\r?\n/)) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (match) {
      values.set(match[1].toLowerCase(), match[2].trim().replace(/^["']|["']$/g, ''));
    }
  }
  return {
    name: values.get('name') ?? null,
    description: values.get('description') ?? null
  };
}

function mapScanError(error: unknown, fallbackPath: string): SkillScanError {
  if (error instanceof ScanFailure) {
    return {
      code: error.scanCode,
      path: error.path,
      retryable: error.scanCode !== 'unsupported_entry' && error.scanCode !== 'path_escape'
    };
  }
  const code = nodeErrorCode(error);
  const errorPath = nodeErrorPath(error) ?? fallbackPath;
  if (code === 'EACCES' || code === 'EPERM') {
    return { code: 'permission_denied', path: errorPath, retryable: true };
  }
  if (code === 'ENOTDIR') {
    return { code: 'not_directory', path: errorPath, retryable: false };
  }
  if (code === 'ENOENT') {
    return { code: 'source_changed', path: errorPath, retryable: true };
  }
  return { code: 'io_error', path: errorPath, retryable: true };
}

class ScanFailure extends Error {
  constructor(
    readonly scanCode: SkillScanErrorCode,
    readonly path: string
  ) {
    super(scanCode);
  }
}

function sortEntries(entries: Dirent[]): Dirent[] {
  return [...entries].sort((left, right) => left.name.localeCompare(right.name));
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
