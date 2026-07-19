import { homedir } from 'node:os';
import { join } from 'node:path';

export interface SpellbookPaths {
  homeDirectory: string;
  databasePath: string;
  packageDirectory: string;
  electronUserDataDirectory: string;
  electronSessionDataDirectory: string;
}

export function createSpellbookPaths(home = homedir()): SpellbookPaths {
  const homeDirectory = join(home, '.spellbook');
  const electronUserDataDirectory = join(homeDirectory, 'electron');
  return {
    homeDirectory,
    databasePath: join(homeDirectory, 'index.sqlite'),
    packageDirectory: join(homeDirectory, 'packages'),
    electronUserDataDirectory,
    electronSessionDataDirectory: join(electronUserDataDirectory, 'session')
  };
}
