import { describe, expect, it } from 'vitest';
import type { Candidate, Spell } from '../desktop/shared/types';
import { deriveSpellName, getCandidateDisplayText, getSpellDisplayText } from '../desktop/renderer/spellDisplay';

describe('spell display text', () => {
  it('uses the raw spell body as the library display text', () => {
    const spell: Spell = {
      id: 'spell-1',
      name: 'Reviewer',
      body: '# Role\n\nAct as a concise reviewer.',
      tags: ['review'],
      source: 'manual',
      createdAt: '2026-07-07T00:00:00.000Z',
      updatedAt: '2026-07-07T00:00:00.000Z'
    };

    expect(getSpellDisplayText(spell)).toBe(spell.body);
  });

  it('derives a compact spell name from body when name is blank', () => {
    expect(deriveSpellName('', 'Untitled spell')).toBe('Untitled spell');
    expect(deriveSpellName('  First line   title  ', 'Untitled spell')).toBe('First line title');
    expect(deriveSpellName('abcdefghijklmnopqrstuvwxyz1234567890', 'Untitled spell')).toBe(
      'abcdefghijklmnopqrstuvwxyz12...'
    );
  });

  it('uses the raw candidate template as the candidate spell display text', () => {
    const candidate: Candidate = {
      id: 'candidate-1',
      slug: 'review-diff',
      title: 'Review diff',
      description: 'Candidate metadata',
      template: 'Review the current git diff.\n\nReturn prioritized findings.',
      candidateType: 'spell',
      sourceCount: 2,
      score: 0.9,
      status: 'pending',
      examples: [],
      createdAt: '2026-07-07T00:00:00.000Z',
      updatedAt: '2026-07-07T00:00:00.000Z'
    };

    expect(getCandidateDisplayText(candidate)).toBe(candidate.template);
    expect(getCandidateDisplayText(candidate)).not.toContain(candidate.title);
    expect(getCandidateDisplayText(candidate)).not.toContain(candidate.description);
  });
});
