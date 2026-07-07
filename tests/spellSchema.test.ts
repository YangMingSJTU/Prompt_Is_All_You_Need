import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../desktop/main/services/database';

describe('spell schema', () => {
  it('stores spells as raw text assets with lightweight management metadata', async () => {
    const db = await createTestDatabase();

    const columns = db
      .all<{ name: string }>('PRAGMA table_info(spells)')
      .map((column) => column.name);

    expect(columns).toEqual(['id', 'name', 'body', 'tags', 'source', 'created_at', 'updated_at']);
    expect(columns).not.toContain('slug');
    expect(columns).not.toContain('title');
    expect(columns).not.toContain('description');
  });
});
