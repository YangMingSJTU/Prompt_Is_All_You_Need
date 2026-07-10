import { describe, expect, it } from 'vitest';
import { matchesSpellSearch } from '../desktop/renderer/spellSearch';

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
});
