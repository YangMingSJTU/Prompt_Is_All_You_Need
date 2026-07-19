import { createHash } from 'node:crypto';
import type { SkillPlatform } from '../../shared/skillTypes';
import {
  nativePlatformPathContext,
  type PlatformPathContext
} from './platformPaths';

const INVALID_PORTABLE_CHARACTERS = /[<>:"|?*\u0000-\u001f]/;
const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

export function createLocalSkillId(
  platform: SkillPlatform,
  rootPath: string,
  pathContext: PlatformPathContext = nativePlatformPathContext
): string {
  const normalizedPath = pathContext.path.normalize(pathContext.path.resolve(rootPath));
  const identityPath = pathContext.caseInsensitive
    ? normalizedPath.toLowerCase()
    : normalizedPath;
  return `local:${createHash('sha256')
    .update(`local\0${platform}\0${identityPath}`)
    .digest('hex')
    .slice(0, 20)}`;
}

export function isPortablePathSegment(value: string): boolean {
  return (
    value.length > 0 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !INVALID_PORTABLE_CHARACTERS.test(value) &&
    !/[. ]$/.test(value) &&
    !WINDOWS_RESERVED_NAME.test(value)
  );
}

export function isSafeDirectoryName(value: string): boolean {
  return isPortablePathSegment(value);
}

export function isPortableRelativePath(value: string): boolean {
  if (!value || value.startsWith('/') || value.includes('\\')) {
    return false;
  }
  return value.split('/').every(isPortablePathSegment);
}

export function portableCollisionKey(value: string): string {
  return value
    .split('/')
    .map((segment) => segment.normalize('NFC').toLowerCase())
    .join('/');
}

export function hasPortablePathCollision(values: string[]): boolean {
  const keys = new Set<string>();
  for (const value of values) {
    if (!isPortableRelativePath(value)) {
      return true;
    }
    const key = portableCollisionKey(value);
    if (keys.has(key)) {
      return true;
    }
    keys.add(key);
  }
  return false;
}

export function resolveInside(
  root: string,
  portablePath: string,
  pathContext: PlatformPathContext = nativePlatformPathContext
): string | null {
  if (!isPortableRelativePath(portablePath)) {
    return null;
  }
  const target = pathContext.path.resolve(root, ...portablePath.split('/'));
  return isPathInside(root, target, pathContext) ? target : null;
}

export function resolveDirectoryInside(
  root: string,
  directoryName: string,
  pathContext: PlatformPathContext = nativePlatformPathContext
): string | null {
  if (!isSafeDirectoryName(directoryName)) {
    return null;
  }
  const target = pathContext.path.resolve(root, directoryName);
  return isPathInside(root, target, pathContext) ? target : null;
}

export function nativePathToPortableRelative(
  root: string,
  target: string,
  pathContext: PlatformPathContext
): string | null {
  const nativeRelative = pathContext.path.relative(
    pathContext.path.resolve(root),
    pathContext.path.resolve(target)
  );
  if (
    !nativeRelative ||
    nativeRelative === '..' ||
    nativeRelative.startsWith(`..${pathContext.path.sep}`) ||
    pathContext.path.isAbsolute(nativeRelative)
  ) {
    return null;
  }
  const portablePath = nativeRelative.split(pathContext.path.sep).join('/');
  return isPortableRelativePath(portablePath) ? portablePath : null;
}

function isPathInside(
  root: string,
  target: string,
  pathContext: PlatformPathContext
): boolean {
  const child = pathContext.path.relative(
    pathContext.path.resolve(root),
    pathContext.path.resolve(target)
  );
  return (
    child.length > 0 &&
    child !== '..' &&
    !child.startsWith(`..${pathContext.path.sep}`) &&
    !pathContext.path.isAbsolute(child)
  );
}
