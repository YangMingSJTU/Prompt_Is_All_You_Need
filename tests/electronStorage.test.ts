import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { configureElectronStorage } from '../desktop/main/services/electronStorage';
import { createSpellbookPaths } from '../desktop/main/services/spellbookPaths';

describe('Electron storage', () => {
  it('configures Windows storage before Electron readiness', async () => {
    const mainSource = await readFile(
      join(process.cwd(), 'desktop', 'main', 'index.ts'),
      'utf8'
    );
    const configureAt = mainSource.indexOf(
      'configureElectronStorage(app, spellbookPaths)'
    );
    const readyAt = mainSource.indexOf('app.whenReady()');

    expect(mainSource).toContain("process.platform === 'win32'");
    expect(configureAt).toBeGreaterThan(-1);
    expect(readyAt).toBeGreaterThan(configureAt);
  });

  it('binds pre-ready user and session data to the isolated Spellbook home', async () => {
    const home = await mkdtemp(join(tmpdir(), 'spellbook-electron-storage-'));
    const paths = createSpellbookPaths(home);
    const calls: Array<[string, string]> = [];

    try {
      configureElectronStorage(
        {
          setPath(name, path) {
            calls.push([name, path]);
          }
        },
        paths
      );

      expect(calls).toEqual([
        ['userData', paths.electronUserDataDirectory],
        ['sessionData', paths.electronSessionDataDirectory]
      ]);
      expect(existsSync(paths.electronUserDataDirectory)).toBe(true);
      expect(existsSync(paths.electronSessionDataDirectory)).toBe(true);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  it('does not install partial path overrides when local storage cannot be created', async () => {
    const home = await mkdtemp(join(tmpdir(), 'spellbook-electron-storage-blocked-'));
    const paths = createSpellbookPaths(home);
    const calls: Array<[string, string]> = [];

    try {
      await writeFile(paths.homeDirectory, 'not a directory');

      expect(() =>
        configureElectronStorage(
          {
            setPath(name, path) {
              calls.push([name, path]);
            }
          },
          paths
        )
      ).toThrow();
      expect(calls).toEqual([]);
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });
});
