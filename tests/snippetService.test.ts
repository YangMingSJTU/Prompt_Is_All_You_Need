import { describe, expect, it } from 'vitest';
import { createSnippetService } from '../desktop/main/services/snippetService';
import { createTestDatabase } from '../desktop/main/services/database';

describe('snippet service', () => {
  it('seeds starter snippets and searches by tag and body', async () => {
    const db = await createTestDatabase();
    const service = createSnippetService(db);
    await service.seedStarterSnippets();

    const results = await service.searchSnippets('review');

    expect(results.some((snippet) => snippet.slug === 'review-diff')).toBe(true);
  });

  it('records usage and returns analytics', async () => {
    const db = await createTestDatabase();
    const service = createSnippetService(db);
    await service.seedStarterSnippets();
    const [snippet] = await service.searchSnippets('commit');

    await service.copySnippet(snippet.id);
    const analytics = await service.getAnalytics();

    expect(analytics.totalCopies).toBe(1);
    expect(analytics.skillCount).toBe(0);
  });

  it('returns most used snippets first for the floating panel defaults', async () => {
    const db = await createTestDatabase();
    const service = createSnippetService(db);
    await service.seedStarterSnippets();
    const [review] = await service.searchSnippets('review');
    const [commit] = await service.searchSnippets('commit');

    await service.copySnippet(commit.id);
    await service.copySnippet(commit.id);
    await service.copySnippet(review.id);

    const popular = await service.listPopularSnippets(2);

    expect(popular.map((snippet) => snippet.slug)).toEqual(['commit-message', 'review-diff']);
  });

  it('copies the raw snippet body without title slug or frontmatter', async () => {
    const db = await createTestDatabase();
    const service = createSnippetService(db);
    const body = '# Role\n\nAct as a concise reviewer.';
    db.run(
      `INSERT INTO snippets
        (id, slug, title, body, description, tags, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'snippet-1',
        'reviewer-role',
        'Reviewer role',
        body,
        'A raw text snippet',
        JSON.stringify(['review']),
        'manual',
        '2026-07-07T00:00:00.000Z',
        '2026-07-07T00:00:00.000Z'
      ]
    );

    const copied = await service.copySnippet('snippet-1');

    expect(copied.body).toBe(body);
    expect(copied.body).not.toContain('slug: reviewer-role');
    expect(copied.body).not.toContain('title: Reviewer role');
  });
});
