import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  openAppDatabase,
  type DatabaseFileOperations
} from '../desktop/main/services/database';

const temporaryDirectories: string[] = [];

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
    const db = await openAppDatabase(databasePath, operations);

    db.run('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [
      'language',
      'en',
      '2026-07-19T00:00:00.000Z'
    ]);
    await db.save();

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
    initial.run('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [
      'language',
      'en',
      '2026-07-19T00:00:00.000Z'
    ]);
    await initial.save();
    const originalBytes = await readFile(databasePath);

    const operations = createTrackedOperations([], 'replace');
    const db = await openAppDatabase(databasePath, operations);
    db.run('UPDATE app_settings SET value = ? WHERE key = ?', ['zh', 'language']);

    await expect(db.save()).rejects.toThrow('injected replace failure');
    expect(await readFile(databasePath)).toEqual(originalBytes);
    expect(await readdir(directory)).toEqual(['spellbook.db']);
  });

  it('keeps the prior database and cleans partial output when temporary writing fails', async () => {
    const directory = await createTemporaryDirectory();
    const databasePath = join(directory, 'spellbook.db');
    const initial = await openAppDatabase(databasePath);
    await initial.save();
    const originalBytes = await readFile(databasePath);

    const operations = createTrackedOperations([], 'write');
    const db = await openAppDatabase(databasePath, operations);

    await expect(db.save()).rejects.toThrow('injected write failure');
    expect(await readFile(databasePath)).toEqual(originalBytes);
    expect(await readdir(directory)).toEqual(['spellbook.db']);
  });

  it('atomically replaces an existing database on subsequent saves', async () => {
    const directory = await createTemporaryDirectory();
    const databasePath = join(directory, 'spellbook.db');
    const db = await openAppDatabase(databasePath);
    db.run('INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)', [
      'language',
      'en',
      '2026-07-19T00:00:00.000Z'
    ]);
    await db.save();
    db.run('UPDATE app_settings SET value = ? WHERE key = ?', ['zh', 'language']);
    await db.save();

    const reopened = await openAppDatabase(databasePath);
    expect(
      reopened.get<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [
        'language'
      ])?.value
    ).toBe('zh');
    expect(await readdir(directory)).toEqual(['spellbook.db']);
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
