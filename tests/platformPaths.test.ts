import { describe, expect, it } from 'vitest';
import {
  createPlatformPathContext,
  createPlatformPaths,
  isAbsolutePlatformPath
} from '../desktop/main/services/platformPaths';

describe('platform paths', () => {
  it('builds the Windows path matrix with explicit win32 semantics', () => {
    const paths = createPlatformPaths({
      platform: 'win32',
      homeDirectory: 'C:\\Users\\Ada Lovelace',
      userDataDirectory: 'C:\\Users\\Ada Lovelace\\AppData\\Roaming\\Spellbook',
      env: {
        CLAUDE_CONFIG_DIR: 'D:\\AI Data\\Claude',
        CODEX_HOME: '\\\\server\\profiles\\Ada\\codex'
      }
    });

    expect(paths.databasePath).toBe(
      'C:\\Users\\Ada Lovelace\\AppData\\Roaming\\Spellbook\\data\\index.sqlite'
    );
    expect(paths.packageDirectory).toBe(
      'C:\\Users\\Ada Lovelace\\AppData\\Roaming\\Spellbook\\data\\packages'
    );
    expect(paths.historyRoots).toEqual([
      { sourceTool: 'claude', path: 'D:\\AI Data\\Claude' },
      { sourceTool: 'codex', path: '\\\\server\\profiles\\Ada\\codex' }
    ]);
    expect(paths.skillRoots).toEqual([
      {
        platform: 'claude',
        path: 'C:\\Users\\Ada Lovelace\\.claude\\skills'
      },
      {
        platform: 'codex',
        path: 'C:\\Users\\Ada Lovelace\\.agents\\skills'
      }
    ]);
  });

  it('builds the macOS path matrix with explicit posix semantics', () => {
    const paths = createPlatformPaths({
      platform: 'darwin',
      homeDirectory: '/Users/艾达',
      userDataDirectory: '/Users/艾达/Library/Application Support/Spellbook'
    });

    expect(paths.databasePath).toBe(
      '/Users/艾达/Library/Application Support/Spellbook/data/index.sqlite'
    );
    expect(paths.packageDirectory).toBe(
      '/Users/艾达/Library/Application Support/Spellbook/data/packages'
    );
    expect(paths.historyRoots).toEqual([
      { sourceTool: 'claude', path: '/Users/艾达/.claude' },
      { sourceTool: 'codex', path: '/Users/艾达/.codex' }
    ]);
    expect(paths.skillRoots).toEqual([
      { platform: 'claude', path: '/Users/艾达/.claude/skills' },
      { platform: 'codex', path: '/Users/艾达/.agents/skills' }
    ]);
  });

  it('validates absolute paths against the target platform, not the host', () => {
    const windows = createPlatformPathContext('win32');
    const mac = createPlatformPathContext('darwin');

    expect(isAbsolutePlatformPath('C:\\Users\\Ada\\history', windows)).toBe(true);
    expect(isAbsolutePlatformPath('\\\\server\\share\\history', windows)).toBe(true);
    expect(isAbsolutePlatformPath('/Users/Ada/history', windows)).toBe(false);
    expect(isAbsolutePlatformPath('/Users/Ada/history', mac)).toBe(true);
    expect(isAbsolutePlatformPath('C:\\Users\\Ada\\history', mac)).toBe(false);
    expect(isAbsolutePlatformPath('../history', mac)).toBe(false);
  });

  it('rejects invalid environment roots before they can resolve against cwd', () => {
    expect(() =>
      createPlatformPaths({
        platform: 'win32',
        homeDirectory: 'C:\\Users\\Ada',
        userDataDirectory: 'C:\\Users\\Ada\\AppData\\Roaming\\Spellbook',
        env: { CLAUDE_CONFIG_DIR: '../claude' }
      })
    ).toThrow('CLAUDE_CONFIG_DIR must be an absolute win32 path');

    expect(() =>
      createPlatformPaths({
        platform: 'darwin',
        homeDirectory: '/Users/Ada',
        userDataDirectory: '/Users/Ada/Library/Application Support/Spellbook',
        env: { CODEX_HOME: 'C:\\Users\\Ada\\.codex' }
      })
    ).toThrow('CODEX_HOME must be an absolute darwin path');
  });
});
