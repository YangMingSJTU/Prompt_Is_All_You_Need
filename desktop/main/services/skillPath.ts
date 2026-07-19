import { createHash } from 'node:crypto';
import { isAbsolute, normalize, relative, resolve, sep } from 'node:path';
import type { SkillPlatform } from '../../shared/skillTypes';

export function createLocalSkillId(platform: SkillPlatform, rootPath: string): string {
  const normalizedPath = normalize(resolve(rootPath));
  const identityPath = process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath;
  return `local:${createHash('sha256')
    .update(`local\0${platform}\0${identityPath}`)
    .digest('hex')
    .slice(0, 20)}`;
}

export function isSafeDirectoryName(value: string): boolean {
  return (
    value.length > 0 &&
    value !== '.' &&
    value !== '..' &&
    !value.includes('/') &&
    !value.includes('\\') &&
    !value.includes('\0')
  );
}

export function isPortableRelativePath(value: string): boolean {
  if (!value || isAbsolute(value) || value.includes('\\')) {
    return false;
  }
  const segments = value.split('/');
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..');
}

export function resolveInside(root: string, portablePath: string): string | null {
  if (!isPortableRelativePath(portablePath)) {
    return null;
  }
  const target = resolve(root, ...portablePath.split('/'));
  return isPathInside(root, target) ? target : null;
}

export function resolveDirectoryInside(root: string, directoryName: string): string | null {
  if (!isSafeDirectoryName(directoryName)) {
    return null;
  }
  const target = resolve(root, directoryName);
  return isPathInside(root, target) ? target : null;
}

function isPathInside(root: string, target: string): boolean {
  const child = relative(resolve(root), resolve(target));
  return child.length > 0 && child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child);
}
