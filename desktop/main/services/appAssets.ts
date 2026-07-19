import { dirname, join } from 'node:path';

export interface AppRuntimeLocation {
  isPackaged: boolean;
  appPath: string;
  resourcesPath: string;
}

export function resolveAppRoot(location: AppRuntimeLocation): string {
  return location.isPackaged ? dirname(location.resourcesPath) : location.appPath;
}

export function getAppIconPath(appRoot: string, platform = process.platform): string {
  const iconFileName = platform === 'win32' ? 'app-icon.ico' : 'app-icon.png';
  return join(appRoot, 'assets', 'icons', iconFileName);
}

export function getTrayIconPath(appRoot: string): string {
  return join(appRoot, 'assets', 'icons', 'tray-icon.png');
}

export function getSqlWasmPath(appRoot: string): string {
  return join(appRoot, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
}
