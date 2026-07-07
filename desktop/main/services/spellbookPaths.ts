import { homedir } from 'node:os';
import { join } from 'node:path';

export interface SpellbookPaths {
  homeDirectory: string;
  databasePath: string;
  packageDirectory: string;
}

export function createSpellbookPaths(home = homedir()): SpellbookPaths {
  const homeDirectory = join(home, '.spellbook');
  return {
    homeDirectory,
    databasePath: join(homeDirectory, 'index.sqlite'),
    packageDirectory: join(homeDirectory, 'packages')
  };
}
