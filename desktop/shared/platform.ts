export type DesktopPlatform = 'win32' | 'darwin';

export function isDesktopPlatform(value: unknown): value is DesktopPlatform {
  return value === 'win32' || value === 'darwin';
}
