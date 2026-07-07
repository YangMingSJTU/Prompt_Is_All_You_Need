import { join } from 'node:path';

export function getAppIconPath(appRoot = process.cwd()): string {
  return join(appRoot, 'assets', 'icons', 'app-icon.png');
}
