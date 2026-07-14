import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTestDatabase, openAppDatabase } from '../desktop/main/services/database';

describe('spell schema', () => {
  it('stores spells as raw text assets with lightweight management metadata', async () => {
    const db = await createTestDatabase();

    const columns = db
      .all<{ name: string }>('PRAGMA table_info(spells)')
      .map((column) => column.name);

    expect(columns).toEqual([
      'id',
      'name',
      'body',
      'tags',
      'source',
      'is_favorite',
      'created_at',
      'updated_at'
    ]);
    expect(columns).not.toContain('slug');
    expect(columns).not.toContain('title');
    expect(columns).not.toContain('description');

    const candidateColumns = db
      .all<{ name: string }>('PRAGMA table_info(candidates)')
      .map((column) => column.name);

    expect(candidateColumns).toEqual([
      'id',
      'slug',
      'title',
      'description',
      'template',
      'candidate_type',
      'source_count',
      'status',
      'examples',
      'created_at',
      'updated_at'
    ]);
    expect(candidateColumns).not.toContain('score');
  });

  it('removes the legacy state column without discarding spells', async () => {
    const legacyDb = await createTestDatabase();
    legacyDb.run('ALTER TABLE spells ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0');
    legacyDb.run(
      `INSERT INTO spells
        (id, name, body, tags, source, is_favorite, is_blocked, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'legacy-spell',
        'Legacy spell',
        'Preserve this spell.',
        JSON.stringify(['legacy']),
        'manual',
        1,
        1,
        '2026-07-01T00:00:00.000Z',
        '2026-07-02T00:00:00.000Z'
      ]
    );
    legacyDb.run('PRAGMA user_version = 8');

    const tempDirectory = await mkdtemp(join(tmpdir(), 'spellbook-schema-'));
    const databasePath = join(tempDirectory, 'spellbook.db');

    try {
      await writeFile(databasePath, legacyDb.exportBytes());
      const migratedDb = await openAppDatabase(databasePath);
      const columns = migratedDb
        .all<{ name: string }>('PRAGMA table_info(spells)')
        .map((column) => column.name);

      expect(columns).not.toContain('is_blocked');
      expect(migratedDb.get('SELECT * FROM spells WHERE id = ?', ['legacy-spell'])).toMatchObject({
        id: 'legacy-spell',
        name: 'Legacy spell',
        body: 'Preserve this spell.',
        tags: JSON.stringify(['legacy']),
        source: 'manual',
        is_favorite: 1,
        created_at: '2026-07-01T00:00:00.000Z',
        updated_at: '2026-07-02T00:00:00.000Z'
      });
      expect(migratedDb.get<{ user_version: number }>('PRAGMA user_version')).toEqual({
        user_version: 9
      });
    } finally {
      await rm(tempDirectory, { recursive: true, force: true });
    }
  });
});
