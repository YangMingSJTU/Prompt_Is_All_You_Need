import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSpellbookPaths } from '../desktop/main/services/spellbookPaths';

describe('spellbook paths', () => {
  it('keeps local data under the Spellbook home directory', () => {
    const paths = createSpellbookPaths('C:\\Users\\Ada');

    expect(paths.homeDirectory).toBe(join('C:\\Users\\Ada', '.spellbook'));
    expect(paths.databasePath).toBe(join('C:\\Users\\Ada', '.spellbook', 'index.sqlite'));
    expect(paths.packageDirectory).toBe(join('C:\\Users\\Ada', '.spellbook', 'packages'));
  });
});
