import { describe, expect, it } from 'vitest';
import { createSpellService } from '../desktop/main/services/spellService';
import { createTestDatabase } from '../desktop/main/services/database';

describe('spell service', () => {
  it('seeds starter spells and searches by tag and body', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    await service.seedStarterSpells();

    const results = await service.searchSpells('review');

    expect(results.some((spell) => spell.slug === 'review-diff')).toBe(true);
  });

  it('records usage and returns analytics', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    await service.seedStarterSpells();
    const [spell] = await service.searchSpells('commit');

    await service.copySpell(spell.id);
    const analytics = await service.getAnalytics();

    expect(analytics.totalCopies).toBe(1);
    expect(analytics.skillCount).toBe(0);
    expect(analytics.spellCount).toBeGreaterThan(0);
  });

  it('returns most used spells first for the floating panel defaults', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    await service.seedStarterSpells();
    const [review] = await service.searchSpells('review');
    const [commit] = await service.searchSpells('commit');

    await service.copySpell(commit.id);
    await service.copySpell(commit.id);
    await service.copySpell(review.id);

    const popular = await service.listPopularSpells(2);

    expect(popular.map((spell) => spell.slug)).toEqual(['commit-message', 'review-diff']);
  });

  it('copies the raw spell body without title slug or frontmatter', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    const body = '# Role\n\nAct as a concise reviewer.';
    db.run(
      `INSERT INTO spells
        (id, slug, title, body, description, tags, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'spell-1',
        'reviewer-role',
        'Reviewer role',
        body,
        'A raw text spell',
        JSON.stringify(['review']),
        'manual',
        '2026-07-07T00:00:00.000Z',
        '2026-07-07T00:00:00.000Z'
      ]
    );

    const copied = await service.copySpell('spell-1');

    expect(copied.body).toBe(body);
    expect(copied.body).not.toContain('slug: reviewer-role');
    expect(copied.body).not.toContain('title: Reviewer role');
  });
});
