import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openAppDatabase } from '../desktop/main/services/database';

describe('database open errors', () => {
  it('creates a database only when the file is absent', async () => {
    const root = await mkdtemp(join(tmpdir(), 'spellbook-db-missing-'));
    const databasePath = join(root, 'data', 'index.sqlite');

    try {
      const db = await openAppDatabase(databasePath);
      await db.transaction(() => {
        db.run(
          "INSERT INTO app_settings (key, value, updated_at) VALUES ('created', 'true', 'now')"
        );
      });
      expect(db.get('SELECT value FROM app_settings WHERE key = ?', ['created'])).toEqual({
        value: 'true'
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('does not replace corrupt or unreadable database inputs with an empty database', async () => {
    const root = await mkdtemp(join(tmpdir(), 'spellbook-db-invalid-'));
    const corruptPath = join(root, 'corrupt.sqlite');

    try {
      await writeFile(corruptPath, 'not a sqlite database', 'utf8');
      await expect(openAppDatabase(corruptPath)).rejects.toThrow();
      await expect(openAppDatabase(root)).rejects.toMatchObject({ code: expect.any(String) });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
