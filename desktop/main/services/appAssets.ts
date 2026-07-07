import { join } from 'node:path';

export function getAppIconPath(appRoot = process.cwd(), platform = process.platform): string {
  const iconFileName = platform === 'win32' ? 'app-icon.ico' : 'app-icon.png';
  return join(appRoot, 'assets', 'icons', iconFileName);
}

export function getTrayIconPath(appRoot = process.cwd()): string {
  return join(appRoot, 'assets', 'icons', 'app-icon.png');
}
