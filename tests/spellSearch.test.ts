import { describe, expect, it } from 'vitest';
import type { Spell } from '../desktop/shared/types';
import {
  filterSpells,
  getSpellFilterTags,
  matchesSpellSearch
} from '../desktop/renderer/spellSearch';

describe('quick spell search scope', () => {
  const spell = {
    name: 'Generate commit message',
    body: 'Review the current diff and explain the risks.'
  };

  it('matches title and content by default scope', () => {
    expect(matchesSpellSearch(spell, 'commit', 'title-content')).toBe(true);
    expect(matchesSpellSearch(spell, 'risks', 'title-content')).toBe(true);
  });

  it('limits title scope to the spell name', () => {
    expect(matchesSpellSearch(spell, 'commit', 'title')).toBe(true);
    expect(matchesSpellSearch(spell, 'risks', 'title')).toBe(false);
  });

  it('limits content scope to the spell body', () => {
    expect(matchesSpellSearch(spell, 'risks', 'content')).toBe(true);
    expect(matchesSpellSearch(spell, 'commit', 'content')).toBe(false);
  });

  it('combines status search scope and AND trait filters while preserving order', () => {
    const spells = [
      createSpell('first', 'Release helper', 'Prepare a release checklist.', ['release', 'review'], true),
      createSpell('second', 'Review helper', 'Review the current diff.', ['review'], false),
      createSpell('third', 'Release notes', 'Summarize changes.', ['release'], true)
    ];

    expect(
      filterSpells(
        spells,
        {
          query: 'release',
          searchScope: 'title',
          selectedTags: ['release', 'review'],
          statusFilter: 'favorite'
        },
        (item) => item.name
      ).map((item) => item.id)
    ).toEqual(['first']);
    expect(
      filterSpells(
        spells,
        {
          query: '',
          searchScope: 'title-content',
          selectedTags: [],
          statusFilter: 'active'
        },
        (item) => item.name
      )
    ).toEqual(spells);
  });

  it('collects sorted traits from the spells available to the status filter', () => {
    const spells = [
      createSpell('first', 'Favorite', 'Body', ['review', 'release'], true),
      createSpell('second', 'Regular', 'Body', ['debug'], false)
    ];

    expect(getSpellFilterTags(spells, 'active')).toEqual(['debug', 'release', 'review']);
    expect(getSpellFilterTags(spells, 'favorite')).toEqual(['release', 'review']);
  });
});

function createSpell(
  id: string,
  name: string,
  body: string,
  tags: string[],
  isFavorite: boolean
): Spell {
  return {
    id,
    name,
    body,
    tags,
    source: 'manual',
    isFavorite,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    copyCount: 0
  };
}
