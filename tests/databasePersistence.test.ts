import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  openAppDatabase,
  type DatabaseFileOperations
} from '../desktop/main/services/database';
import { createSettingsService } from '../desktop/main/services/settingsService';
import { createPlatformPathContext } from '../desktop/main/services/platformPaths';

const temporaryDirectories: string[] = [];
const SETTINGS_OPTIONS = {
  defaultScanSources: [],
  pathContext: createPlatformPathContext('win32')
};

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { force: true, recursive: true })
    )
  );
});

describe('database persistence', () => {
  it('writes through a same-directory temporary file before replacing the database', async () => {
    const directory = await createTemporaryDirectory();
    const databasePath = join(directory, 'spellbook.db');
    const calls: string[] = [];
    const operations = createTrackedOperations(calls);
    const db = await openAppDatabase(databasePath, { fileOperations: operations });

    await db.transaction(() => {
      db.run('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [
        'language',
        'en',
        '2026-07-19T00:00:00.000Z'
      ]);
    });

    expect(calls[0]).toBe('mkdir');
    expect(calls[1]).toMatch(/^write:spellbook\.db\..+\.tmp$/);
    expect(calls[2]).toMatch(/^replace:spellbook\.db\..+\.tmp->spellbook\.db$/);
    expect(calls[3]).toMatch(/^remove:spellbook\.db\..+\.tmp$/);
    expect(await readdir(directory)).toEqual(['spellbook.db']);
  });

  it('keeps the prior database and cleans the temporary file when replacement fails', async () => {
    const directory = await createTemporaryDirectory();
    const databasePath = join(directory, 'spellbook.db');
    const initial = await openAppDatabase(databasePath);
    await initial.transaction(() => {
      initial.run('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [
        'language',
        'en',
        '2026-07-19T00:00:00.000Z'
      ]);
    });
    const originalBytes = await readFile(databasePath);

    const operations = createTrackedOperations([], 'replace');
    const db = await openAppDatabase(databasePath, { fileOperations: operations });
    await expect(
      db.transaction(() => {
        db.run('UPDATE app_settings SET value = ? WHERE key = ?', ['zh', 'language']);
      })
    ).rejects.toThrow('injected replace failure');
    expect(await readFile(databasePath)).toEqual(originalBytes);
    expect(
      db.get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', ['language'])
        ?.value
    ).toBe('en');
    expect(await readdir(directory)).toEqual(['spellbook.db']);
  });

  it('keeps the prior database and cleans partial output when temporary writing fails', async () => {
    const directory = await createTemporaryDirectory();
    const databasePath = join(directory, 'spellbook.db');
    const initial = await openAppDatabase(databasePath);
    await initial.transaction(() => undefined);
    const originalBytes = await readFile(databasePath);

    const operations = createTrackedOperations([], 'write');
    const db = await openAppDatabase(databasePath, { fileOperations: operations });

    await expect(db.transaction(() => undefined)).rejects.toThrow('injected write failure');
    expect(await readFile(databasePath)).toEqual(originalBytes);
    expect(await readdir(directory)).toEqual(['spellbook.db']);
  });

  it('atomically replaces an existing database on subsequent saves', async () => {
    const directory = await createTemporaryDirectory();
    const databasePath = join(directory, 'spellbook.db');
    const db = await openAppDatabase(databasePath);
    await db.transaction(() => {
      db.run('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [
        'language',
        'en',
        '2026-07-19T00:00:00.000Z'
      ]);
    });
    await db.transaction(() => {
      db.run('UPDATE app_settings SET value = ? WHERE key = ?', ['zh', 'language']);
    });

    const reopened = await openAppDatabase(databasePath);
    expect(
      reopened.get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [
        'language'
      ])?.value
    ).toBe('zh');
    expect(await readdir(directory)).toEqual(['spellbook.db']);
  });

  it('rolls back a failed shortcut write before allowing another service write to persist', async () => {
    const directory = await createTemporaryDirectory();
    const databasePath = join(directory, 'spellbook.db');
    const initial = await openAppDatabase(databasePath);
    const initialSettings = createSettingsService(initial, SETTINGS_OPTIONS);
    await initialSettings.updateQuickPanelShortcut('Alt+Space');

    const deferred = createDeferredReplaceOperations({ failFirst: true });
    const db = await openAppDatabase(databasePath, { fileOperations: deferred.operations });
    const settings = createSettingsService(db, SETTINGS_OPTIONS);
    const shortcutWrite = settings.updateQuickPanelShortcut('Control+Space');
    await deferred.firstReplaceStarted;
    const languageWrite = settings.updateSettings({ language: 'zh' });

    deferred.releaseFirstReplace();
    await expect(shortcutWrite).rejects.toThrow('injected deferred replace failure');
    await languageWrite;

    expect(settings.getSettings().quickPanelShortcut).toBe('Alt+Space');
    expect(settings.getSettings().language).toBe('zh');
    const reopened = createSettingsService(
      await openAppDatabase(databasePath),
      SETTINGS_OPTIONS
    );
    expect(reopened.getSettings().quickPanelShortcut).toBe('Alt+Space');
    expect(reopened.getSettings().language).toBe('zh');
  });

  it('serializes successful replacements so a later snapshot cannot finish first', async () => {
    const directory = await createTemporaryDirectory();
    const databasePath = join(directory, 'spellbook.db');
    const initial = await openAppDatabase(databasePath);
    await initial.transaction(() => undefined);

    const deferred = createDeferredReplaceOperations({ failFirst: false });
    const db = await openAppDatabase(databasePath, { fileOperations: deferred.operations });
    const settings = createSettingsService(db, SETTINGS_OPTIONS);
    const firstWrite = settings.updateSettings({ language: 'zh' });
    await deferred.firstReplaceStarted;
    const secondWrite = settings.updateSettings({ quickPanelPlacement: 'mouse' });

    await Promise.resolve();
    expect(deferred.replaceCount()).toBe(1);
    deferred.releaseFirstReplace();
    await Promise.all([firstWrite, secondWrite]);

    const reopened = createSettingsService(
      await openAppDatabase(databasePath),
      SETTINGS_OPTIONS
    );
    expect(reopened.getSettings().language).toBe('zh');
    expect(reopened.getSettings().quickPanelPlacement).toBe('mouse');
    expect(deferred.replaceCount()).toBe(2);
  });
});

async function createTemporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'spellbook-db-test-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createTrackedOperations(
  calls: string[],
  failure?: 'write' | 'replace'
): DatabaseFileOperations {
  return {
    async read(path) {
      return readFile(path);
    },
    async makeDirectory() {
      calls.push('mkdir');
    },
    async write(path, bytes) {
      const { writeFile } = await import('node:fs/promises');
      calls.push(`write:${path.split(/[\\/]/).at(-1)}`);
      await writeFile(path, bytes);
      if (failure === 'write') {
        throw new Error('injected write failure');
      }
    },
    async replace(sourcePath, targetPath) {
      const { rename } = await import('node:fs/promises');
      calls.push(
        `replace:${sourcePath.split(/[\\/]/).at(-1)}->${targetPath.split(/[\\/]/).at(-1)}`
      );
      if (failure === 'replace') {
        throw new Error('injected replace failure');
      }
      await rename(sourcePath, targetPath);
    },
    async remove(path) {
      calls.push(`remove:${path.split(/[\\/]/).at(-1)}`);
      await rm(path, { force: true });
    }
  };
}

function createDeferredReplaceOperations(options: { failFirst: boolean }): {
  operations: DatabaseFileOperations;
  firstReplaceStarted: Promise<void>;
  releaseFirstReplace(): void;
  replaceCount(): number;
} {
  let replaceCount = 0;
  let markStarted: () => void = () => undefined;
  let release: () => void = () => undefined;
  const firstReplaceStarted = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const firstReplaceReleased = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    operations: {
      async read(path) {
        return readFile(path);
      },
      async makeDirectory() {},
      async write(path, bytes) {
        await writeFile(path, bytes);
      },
      async replace(sourcePath, targetPath) {
        replaceCount += 1;
        if (replaceCount === 1) {
          markStarted();
          await firstReplaceReleased;
          if (options.failFirst) {
            throw new Error('injected deferred replace failure');
          }
        }
        await rename(sourcePath, targetPath);
      },
      async remove(path) {
        await rm(path, { force: true });
      }
    },
    firstReplaceStarted,
    releaseFirstReplace() {
      release();
    },
    replaceCount() {
      return replaceCount;
    }
  };
}
