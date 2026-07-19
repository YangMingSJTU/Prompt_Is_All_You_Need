import type {
  InstallSkillRequest,
  InstallSkillResult,
  PackageSkillRequest,
  PackageSkillResult,
  SkillInstallation,
  SkillLibraryItem,
  SkillLibraryState,
  SkillOperationError,
  SkillPlatform,
  SkillScanResult
} from '../../shared/skillTypes';
import { getBundledSkill, listBundledSkills } from './bundledSkillCatalog';
import {
  nodeSkillFileSystem,
  type SkillFileSystem
} from './skillFileSystem';
import {
  installSkillContent,
  packageSkillContent,
  probeSkillInstallation,
  SkillSourceError,
  type SkillContentSource
} from './skillOperations';
import { resolveInside } from './skillPath';
import { createSkillRepository, type SkillRepository } from './skillRepository';
import {
  scanSkillRoot,
  type LocalSkillSnapshot,
  type SkillRoot
} from './skillScanner';
import type { AppDatabase } from './database';

import {
  nativePlatformPathContext,
  type PlatformPathContext,
  type PlatformPaths
} from './platformPaths';
export type { SkillRoot } from './skillScanner';

export interface SkillServiceOptions {
  roots: SkillRoot[];
  packageDirectory: string;
  fs?: SkillFileSystem;
  pathContext?: PlatformPathContext;
}

export interface SkillService {
  getLibraryState(): Promise<SkillLibraryState>;
  scanSkills(): Promise<SkillScanResult>;
  installSkill(request: InstallSkillRequest): Promise<InstallSkillResult>;
  packageSkill(request: PackageSkillRequest): Promise<PackageSkillResult>;
}

export function defaultSkillRoots(paths: Pick<PlatformPaths, 'skillRoots'>): SkillRoot[] {
  return paths.skillRoots;
}

export function createSkillService(
  db: AppDatabase,
  options: SkillServiceOptions
): SkillService {
  const roots = options.roots;
  const packageDirectory = options.packageDirectory;
  const fs = options.fs ?? nodeSkillFileSystem;
  const pathContext = options.pathContext ?? nativePlatformPathContext;
  const repository = createSkillRepository(db);
  let scanInFlight: Promise<SkillScanResult> | null = null;
  const operationKeys = new Set<string>();

  async function getLibraryState(): Promise<SkillLibraryState> {
    return composeLibraryState(repository, roots, fs, pathContext);
  }

  async function runScan(): Promise<SkillScanResult> {
    const scanResults = await Promise.all(
      roots.map((root) => scanSkillRoot(root, fs, pathContext))
    );
    const sources = await repository.commitScan(scanResults);
    const successfulSources = sources.filter((source) => source.refreshed);
    const outcome =
      successfulSources.length === sources.length
        ? 'success'
        : successfulSources.length > 0
          ? 'partial'
          : 'failed';
    return {
      outcome,
      freshSkillCount: successfulSources.reduce(
        (total, source) => total + source.skillCount,
        0
      ),
      sources,
      library: await getLibraryState()
    };
  }

  return {
    getLibraryState,

    scanSkills() {
      if (scanInFlight) {
        return scanInFlight;
      }
      scanInFlight = runScan().finally(() => {
        scanInFlight = null;
      });
      return scanInFlight;
    },

    async installSkill(request) {
      if (!isValidSkillId(request?.skillId) || !isSkillPlatform(request?.platform)) {
        return operationFailure(
          typeof request?.skillId === 'string' ? request.skillId : '',
          { code: 'invalid_request', retryable: false },
          isSkillPlatform(request?.platform) ? request.platform : undefined
        );
      }
      const operationKey = `skill:${request.skillId}`;
      if (operationKeys.has(operationKey)) {
        return operationFailure(
          request.skillId,
          { code: 'operation_in_progress', retryable: true },
          request.platform
        );
      }
      operationKeys.add(operationKey);
      try {
        const source = resolveContentSource(request.skillId, repository, fs, pathContext);
        if (!source) {
          return operationFailure(
            request.skillId,
            { code: 'skill_not_found', retryable: false },
            request.platform
          );
        }
        const targetRoot = rootForPlatform(roots, request.platform);
        const result = await installSkillContent({
          source,
          platform: request.platform,
          targetRoot,
          fs,
          pathContext
        });
        if (!result.ok) {
          return {
            ...operationFailure(request.skillId, result.error, request.platform),
            item: await findLibraryItem(request.skillId)
          };
        }
        const item = await findLibraryItem(request.skillId);
        if (!item) {
          return operationFailure(
            request.skillId,
            { code: 'skill_not_found', retryable: false },
            request.platform
          );
        }
        return {
          ok: true,
          skillId: request.skillId,
          platform: request.platform,
          targetPath: result.targetPath,
          item
        };
      } finally {
        operationKeys.delete(operationKey);
      }
    },

    async packageSkill(request) {
      if (!isValidSkillId(request?.skillId)) {
        return {
          ok: false,
          skillId: typeof request?.skillId === 'string' ? request.skillId : '',
          error: { code: 'invalid_request', retryable: false }
        };
      }
      const operationKey = `skill:${request.skillId}`;
      if (operationKeys.has(operationKey)) {
        return {
          ok: false,
          skillId: request.skillId,
          error: { code: 'operation_in_progress', retryable: true }
        };
      }
      operationKeys.add(operationKey);
      try {
        const source = resolveContentSource(request.skillId, repository, fs, pathContext);
        if (!source) {
          return {
            ok: false,
            skillId: request.skillId,
            error: { code: 'skill_not_found', retryable: false }
          };
        }
        const result = await packageSkillContent({
          source,
          packageDirectory,
          fs,
          pathContext
        });
        return result.ok
          ? { ok: true, skillId: request.skillId, outputPath: result.outputPath }
          : { ok: false, skillId: request.skillId, error: result.error };
      } finally {
        operationKeys.delete(operationKey);
      }
    }
  };

  async function findLibraryItem(skillId: string): Promise<SkillLibraryItem | undefined> {
    return (await getLibraryState()).items.find((item) => item.id === skillId);
  }
}

async function composeLibraryState(
  repository: SkillRepository,
  roots: SkillRoot[],
  fs: SkillFileSystem,
  pathContext: PlatformPathContext
): Promise<SkillLibraryState> {
  let localSkills: LocalSkillSnapshot[] = [];
  let sourceStates;
  let localLoadError: SkillLibraryState['localLoadError'];
  try {
    localSkills = repository.listLocalSkills();
    sourceStates = repository.listSourceStates(roots);
  } catch {
    localLoadError = 'io_error';
    sourceStates = roots.map((root) => ({
      platform: root.platform,
      path: root.path,
      status: 'never_scanned' as const,
      stale: false
    }));
  }
  const stalePlatforms = new Set(
    sourceStates.filter((source) => source.stale).map((source) => source.platform)
  );
  const baseItems: Array<Omit<SkillLibraryItem, 'installation'>> = [
    ...listBundledSkills().map((skill) => ({
      id: skill.id,
      source: 'bundled' as const,
      directoryName: skill.directoryName,
      name: skill.name,
      description: skill.description,
      bundledKey: skill.key,
      compatiblePlatforms: ['claude', 'codex'] as SkillPlatform[],
      entryFilePath: 'SKILL.md',
      files: Object.keys(skill.files).sort((left, right) => left.localeCompare(right)),
      fileCount: Object.keys(skill.files).length,
      packageable: Object.keys(skill.files).length > 0
    })),
    ...localSkills.map((skill) => ({
      id: skill.id,
      source: 'local' as const,
      directoryName: skill.directoryName,
      name: skill.name,
      description: skill.description,
      compatiblePlatforms: ['claude', 'codex'] as SkillPlatform[],
      discoveredPlatform: skill.platform,
      rootPath: skill.rootPath,
      entryFilePath: skill.entryFilePath,
      files: skill.files,
      fileCount: skill.files.length,
      updatedAt: skill.updatedAt,
      packageable: skill.packageable,
      packageUnavailableReason: skill.packageable ? undefined : ('empty' as const),
      stale: stalePlatforms.has(skill.platform)
    }))
  ];
  const items = await Promise.all(
    baseItems.map(async (item): Promise<SkillLibraryItem> => ({
      ...item,
      installation: await probeInstallationMatrix(item.directoryName, roots, fs, pathContext)
    }))
  );
  return {
    items,
    sources: sourceStates,
    ...(localLoadError ? { localLoadError } : {})
  };
}

async function probeInstallationMatrix(
  directoryName: string,
  roots: SkillRoot[],
  fs: SkillFileSystem,
  pathContext: PlatformPathContext
): Promise<Record<SkillPlatform, SkillInstallation>> {
  const [claude, codex] = await Promise.all([
    probeSkillInstallation(directoryName, rootForPlatform(roots, 'claude'), fs, pathContext),
    probeSkillInstallation(directoryName, rootForPlatform(roots, 'codex'), fs, pathContext)
  ]);
  return { claude, codex };
}

function resolveContentSource(
  skillId: string,
  repository: SkillRepository,
  fs: SkillFileSystem,
  pathContext: PlatformPathContext = nativePlatformPathContext
): SkillContentSource | null {
  const bundled = getBundledSkill(skillId);
  if (bundled) {
    return {
      id: bundled.id,
      directoryName: bundled.directoryName,
      files: Object.keys(bundled.files).sort((left, right) => left.localeCompare(right)),
      async readFile(portablePath) {
        const content = bundled.files[portablePath];
        if (content === undefined) {
          throw new SkillSourceError('source_missing', portablePath);
        }
        return Buffer.from(content, 'utf8');
      }
    };
  }

  const local = repository.getLocalSkill(skillId);
  if (!local) {
    return null;
  }
  return {
    id: local.id,
    directoryName: local.directoryName,
    files: local.files,
    async readFile(portablePath) {
      if (!local.files.includes(portablePath)) {
        throw new SkillSourceError('source_missing', portablePath);
      }
      const sourcePath = resolveInside(local.rootPath, portablePath, pathContext);
      if (!sourcePath) {
        throw new SkillSourceError('unsupported_entry', portablePath);
      }
      try {
        const rootStats = await fs.lstat(local.rootPath);
        if (rootStats.isSymbolicLink() || !rootStats.isDirectory()) {
          throw new SkillSourceError('unsupported_entry', local.rootPath);
        }
        let currentPath = local.rootPath;
        for (const segment of portablePath.split('/').slice(0, -1)) {
          currentPath = pathContext.path.join(currentPath, segment);
          const directoryStats = await fs.lstat(currentPath);
          if (directoryStats.isSymbolicLink() || !directoryStats.isDirectory()) {
            throw new SkillSourceError('unsupported_entry', currentPath);
          }
        }
        const stats = await fs.lstat(sourcePath);
        if (stats.isSymbolicLink() || !stats.isFile()) {
          throw new SkillSourceError('unsupported_entry', sourcePath);
        }
        return await fs.readFile(sourcePath);
      } catch (error) {
        if (error instanceof SkillSourceError) {
          throw error;
        }
        const code = nodeErrorCode(error);
        if (code === 'ENOENT') {
          throw new SkillSourceError('source_missing', sourcePath);
        }
        if (code === 'EACCES' || code === 'EPERM') {
          throw new SkillSourceError('source_unreadable', sourcePath);
        }
        throw new SkillSourceError('source_unreadable', sourcePath);
      }
    }
  };
}

function rootForPlatform(roots: SkillRoot[], platform: SkillPlatform): string {
  const root = roots.find((candidate) => candidate.platform === platform);
  if (!root) {
    throw new Error(`Missing skill root for ${platform}`);
  }
  return root.path;
}

function operationFailure(
  skillId: string,
  error: SkillOperationError,
  platform?: SkillPlatform
): Extract<InstallSkillResult, { ok: false }> {
  return { ok: false, skillId, ...(platform ? { platform } : {}), error };
}

function isSkillPlatform(value: unknown): value is SkillPlatform {
  return value === 'claude' || value === 'codex';
}

function isValidSkillId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

function nodeErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}
