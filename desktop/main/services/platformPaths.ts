import path, { posix, win32 } from 'node:path';
import type { DesktopPlatform } from '../../shared/platform';
import type { SkillPlatform } from '../../shared/skillTypes';
import type { ScanProvider } from '../../shared/types';

export type PlatformPathOperations = Pick<
  typeof posix,
  'basename' | 'dirname' | 'isAbsolute' | 'join' | 'normalize' | 'relative' | 'resolve' | 'sep'
>;

export interface PlatformPathContext {
  platform: DesktopPlatform;
  path: PlatformPathOperations;
  caseInsensitive: boolean;
}

export interface PlatformPaths {
  platform: DesktopPlatform;
  homeDirectory: string;
  userDataDirectory: string;
  dataDirectory: string;
  databasePath: string;
  packageDirectory: string;
  historyRoots: Array<{ sourceTool: ScanProvider; path: string }>;
  skillRoots: Array<{ platform: SkillPlatform; path: string }>;
}

export interface CreatePlatformPathsOptions {
  platform: DesktopPlatform;
  homeDirectory: string;
  userDataDirectory: string;
  env?: Readonly<Record<string, string | undefined>>;
  path?: PlatformPathOperations;
}

export function createPlatformPathContext(
  platform: DesktopPlatform,
  path: PlatformPathOperations = pathOperationsFor(platform)
): PlatformPathContext {
  return {
    platform,
    path,
    caseInsensitive: platform === 'win32'
  };
}

export const nativePlatformPathContext = createPlatformPathContext(
  path.sep === '\\' ? 'win32' : 'darwin',
  path
);

export function createPlatformPaths(options: CreatePlatformPathsOptions): PlatformPaths {
  const path = options.path ?? pathOperationsFor(options.platform);
  const context = createPlatformPathContext(options.platform, path);
  const env = options.env ?? {};
  const homeDirectory = requireAbsoluteRoot('home directory', options.homeDirectory, context);
  const userDataDirectory = requireAbsoluteRoot(
    'Electron userData directory',
    options.userDataDirectory,
    context
  );
  const dataDirectory = path.join(userDataDirectory, 'data');
  const claudeHome = environmentRoot(
    'CLAUDE_CONFIG_DIR',
    env.CLAUDE_CONFIG_DIR,
    path.join(homeDirectory, '.claude'),
    context
  );
  const codexHome = environmentRoot(
    'CODEX_HOME',
    env.CODEX_HOME,
    path.join(homeDirectory, '.codex'),
    context
  );

  return {
    platform: options.platform,
    homeDirectory,
    userDataDirectory,
    dataDirectory,
    databasePath: path.join(dataDirectory, 'index.sqlite'),
    packageDirectory: path.join(dataDirectory, 'packages'),
    historyRoots: [
      { sourceTool: 'claude', path: claudeHome },
      { sourceTool: 'codex', path: codexHome }
    ],
    skillRoots: [
      { platform: 'claude', path: path.join(homeDirectory, '.claude', 'skills') },
      { platform: 'codex', path: path.join(homeDirectory, '.agents', 'skills') }
    ]
  };
}

export function pathOperationsFor(platform: DesktopPlatform): PlatformPathOperations {
  return platform === 'win32' ? win32 : posix;
}

export function isAbsolutePlatformPath(
  value: string,
  context: PlatformPathContext
): boolean {
  const candidate = value.trim();
  if (context.platform === 'win32') {
    if (/^\\\\[?.](?:[\\/]|$)/.test(candidate)) {
      return false;
    }
    if (candidate.startsWith('\\\\')) {
      const [server, share] = candidate.slice(2).split(/[\\/]+/);
      return (
        Boolean(server && share) &&
        context.path.isAbsolute(candidate)
      );
    }
    return /^[A-Za-z]:[\\/]/.test(candidate) && context.path.isAbsolute(candidate);
  }
  return context.path.isAbsolute(candidate);
}

function environmentRoot(
  name: 'CLAUDE_CONFIG_DIR' | 'CODEX_HOME',
  value: string | undefined,
  fallback: string,
  context: PlatformPathContext
): string {
  return value === undefined || value.trim() === ''
    ? fallback
    : requireAbsoluteRoot(name, value, context);
}

function requireAbsoluteRoot(
  name: string,
  value: string,
  context: PlatformPathContext
): string {
  const candidate = value.trim();
  if (!isAbsolutePlatformPath(candidate, context)) {
    throw new Error(`${name} must be an absolute ${context.platform} path`);
  }
  return context.path.normalize(candidate);
}
