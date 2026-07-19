import { mkdirSync } from 'node:fs';
import type { SpellbookPaths } from './spellbookPaths';

export interface ElectronStorageApp {
  setPath(name: 'userData' | 'sessionData', path: string): void;
}

export type CreateDirectory = (
  path: string,
  options: { recursive: true }
) => unknown;

export function configureElectronStorage(
  app: ElectronStorageApp,
  paths: SpellbookPaths,
  createDirectory: CreateDirectory = mkdirSync
): void {
  createDirectory(paths.electronUserDataDirectory, { recursive: true });
  createDirectory(paths.electronSessionDataDirectory, { recursive: true });

  app.setPath('userData', paths.electronUserDataDirectory);
  app.setPath('sessionData', paths.electronSessionDataDirectory);
}
