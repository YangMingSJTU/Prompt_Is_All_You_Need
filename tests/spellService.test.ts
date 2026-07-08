import { describe, expect, it } from 'vitest';
import { createSpellService } from '../desktop/main/services/spellService';
import { createTestDatabase } from '../desktop/main/services/database';

describe('spell service', () => {
  it('seeds starter spells and searches by tag and body', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    await service.seedStarterSpells();

    const results = await service.searchSpells('review');

    expect(results.some((spell) => spell.body.includes('Review the current git diff.'))).toBe(true);
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

    expect(popular.map((spell) => spell.body.split('\n')[0])).toEqual([
      'Generate a concise commit message for the current changes.',
      'Review the current git diff.'
    ]);
    expect(popular.map((spell) => spell.copyCount)).toEqual([2, 1]);
  });

  it('returns copy counts for searched spells so the quick panel can sort search results by usage', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    await service.seedStarterSpells();
    const [commit] = await service.searchSpells('commit');

    await service.copySpell(commit.id);
    await service.copySpell(commit.id);

    const [result] = await service.searchSpells('commit');

    expect(result.copyCount).toBe(2);
  });

  it('copies the raw spell body without title slug or frontmatter', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    const body = '# Role\n\nAct as a concise reviewer.';
    db.run(
      `INSERT INTO spells
        (id, name, body, tags, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'spell-1',
        'Reviewer',
        body,
        JSON.stringify(['review', 'code']),
        'manual',
        '2026-07-07T00:00:00.000Z',
        '2026-07-07T00:00:00.000Z'
      ]
    );

    const copied = await service.copySpell('spell-1');

    expect(copied.body).toBe(body);
    expect(copied.name).toBe('Reviewer');
    expect(copied.tags).toEqual(['review', 'code']);
  });

  it('creates a manual spell and preserves raw body copy semantics', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    const body = '# Role\n\nUse short, direct answers.';

    const created = await service.createSpell({
      name: 'Short answer',
      body,
      tags: [' writing ', 'writing', 'daily']
    });
    const copied = await service.copySpell(created.id);

    expect(created.source).toBe('manual');
    expect(created.name).toBe('Short answer');
    expect(created.body).toBe(body);
    expect(created.tags).toEqual(['writing', 'daily']);
    expect(copied.body).toBe(body);
  });

  it('rejects creating a spell with an empty body', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);

    await expect(
      service.createSpell({
        name: 'Empty',
        body: '   ',
        tags: []
      })
    ).rejects.toThrow('Spell body cannot be empty');
    expect(await service.listSpells()).toEqual([]);
  });

  it('updates spell name body and tags without changing copy semantics', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    await service.seedStarterSpells();
    const [spell] = await service.searchSpells('commit');

    const updated = await service.updateSpell(spell.id, {
      name: 'Commit helper',
      body: 'Write a concise commit message.',
      tags: ['git', 'release notes']
    });
    const copied = await service.copySpell(spell.id);

    expect(updated.name).toBe('Commit helper');
    expect(updated.tags).toEqual(['git', 'release notes']);
    expect(copied.body).toBe('Write a concise commit message.');
  });

  it('searches spells by name body and tags', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    await service.seedStarterSpells();
    const [spell] = await service.searchSpells('review');
    await service.updateSpell(spell.id, {
      name: 'Diff guardian',
      tags: ['audit']
    });

    const nameResults = await service.searchSpells('guardian');
    const tagResults = await service.searchSpells('audit');

    expect(nameResults.map((result) => result.id)).toContain(spell.id);
    expect(tagResults.map((result) => result.id)).toContain(spell.id);
  });

  it('falls back to empty tags when stored tags are invalid', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    db.run(
      `INSERT INTO spells
        (id, name, body, tags, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'spell-invalid-tags',
        '',
        'Body',
        'not-json',
        'manual',
        '2026-07-07T00:00:00.000Z',
        '2026-07-07T00:00:00.000Z'
      ]
    );

    const [spell] = await service.searchSpells('Body');

    expect(spell.tags).toEqual([]);
  });

  it('deletes a spell and its usage events', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    await service.seedStarterSpells();
    const [spell] = await service.searchSpells('commit');
    await service.copySpell(spell.id);

    await service.deleteSpell(spell.id);

    await expect(service.copySpell(spell.id)).rejects.toThrow('Spell not found');
    expect((await service.listSpells()).map((item) => item.id)).not.toContain(spell.id);
    expect((await service.getAnalytics()).totalCopies).toBe(0);
  });

  it('promotes selected candidates in bulk and skips duplicate spell bodies', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    await service.createSpell({
      name: 'Existing review',
      body: 'Review the current git diff.',
      tags: []
    });
    await service.saveCandidates([
      {
        id: 'candidate-duplicate',
        slug: 'duplicate-review',
        title: 'Review current diff',
        description: '',
        template: ' Review   the current git diff. ',
        candidateType: 'spell',
        sourceCount: 3,
        score: 0.9,
        status: 'pending',
        examples: [],
        createdAt: '2026-07-08T00:00:00.000Z',
        updatedAt: '2026-07-08T00:00:00.000Z'
      },
      {
        id: 'candidate-new',
        slug: 'new-debug',
        title: 'Debug failing tests',
        description: '',
        template: 'Investigate failing tests and propose a fix.',
        candidateType: 'spell',
        sourceCount: 2,
        score: 0.8,
        status: 'pending',
        examples: [],
        createdAt: '2026-07-08T00:00:00.000Z',
        updatedAt: '2026-07-08T00:00:00.000Z'
      }
    ]);

    const result = await service.promoteCandidates(['candidate-duplicate', 'candidate-new']);
    const spells = await service.listSpells();
    const candidates = await service.listCandidates();

    expect(result.created.map((spell) => spell.body)).toEqual(['Investigate failing tests and propose a fix.']);
    expect(result.skipped).toEqual([{ candidateId: 'candidate-duplicate', reason: 'duplicate' }]);
    expect(spells.filter((spell) => spell.body.includes('Review the current git diff')).length).toBe(1);
    expect(candidates.find((candidate) => candidate.id === 'candidate-duplicate')?.status).toBe('saved');
    expect(candidates.find((candidate) => candidate.id === 'candidate-new')?.status).toBe('saved');
  });

  it('promotes candidate spells without trimming or wrapping the raw body', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    const rawBody = '  Keep this prompt spacing exactly.  \n\n# Heading';
    await service.saveCandidates([
      {
        id: 'candidate-raw',
        slug: 'raw-spacing',
        title: 'Keep this prompt spacing exactly.',
        description: '',
        template: rawBody,
        candidateType: 'spell',
        sourceCount: 1,
        score: 0.5,
        status: 'pending',
        examples: [rawBody],
        createdAt: '2026-07-08T00:00:00.000Z',
        updatedAt: '2026-07-08T00:00:00.000Z'
      }
    ]);

    const result = await service.promoteCandidates(['candidate-raw']);
    const copied = await service.copySpell(result.created[0].id);

    expect(result.created[0].body).toBe(rawBody);
    expect(copied.body).toBe(rawBody);
  });

  it('replaces stale scan candidates with the latest raw candidates', async () => {
    const db = await createTestDatabase();
    const service = createSpellService(db);
    await service.saveCandidates([
      {
        id: 'old-template',
        slug: 'spell-old-template',
        title: 'Review current diff',
        description: '',
        template: 'Review the current git diff. Focus on correctness bugs.',
        candidateType: 'spell',
        sourceCount: 1,
        score: 0.5,
        status: 'pending',
        examples: [],
        createdAt: '2026-07-08T00:00:00.000Z',
        updatedAt: '2026-07-08T00:00:00.000Z'
      }
    ]);

    await service.replaceCandidates([
      {
        id: 'new-raw',
        slug: 'spell-new-raw',
        title: '这是我的中文提示词',
        description: '',
        template: '这是我的中文提示词，不要加工。',
        candidateType: 'spell',
        sourceCount: 1,
        score: 0.5,
        status: 'pending',
        examples: ['这是我的中文提示词，不要加工。'],
        createdAt: '2026-07-08T00:00:00.000Z',
        updatedAt: '2026-07-08T00:00:00.000Z'
      }
    ]);

    const candidates = await service.listCandidates();

    expect(candidates.map((candidate) => candidate.template)).toEqual(['这是我的中文提示词，不要加工。']);
  });
});
