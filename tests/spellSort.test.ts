import { describe, expect, it } from 'vitest';
import type { Spell } from '../desktop/shared/types';
import { sortSpells } from '../desktop/renderer/spellSort';

const baseSpell: Omit<Spell, 'id' | 'name' | 'body' | 'createdAt' | 'updatedAt' | 'copyCount'> = {
  tags: [],
  source: 'manual'
};

function spell(input: Partial<Spell> & Pick<Spell, 'id' | 'name'>): Spell {
  return {
    ...baseSpell,
    body: input.body ?? input.name,
    createdAt: input.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: input.updatedAt ?? '2026-01-01T00:00:00.000Z',
    copyCount: input.copyCount ?? 0,
    ...input
  };
}

describe('spell sorting', () => {
  it('sorts by copy count in both directions without mutating input', () => {
    const spells = [
      spell({ id: 'a', name: 'Alpha', copyCount: 1, updatedAt: '2026-01-01T00:00:00.000Z' }),
      spell({ id: 'b', name: 'Beta', copyCount: 3, updatedAt: '2026-01-01T00:00:00.000Z' }),
      spell({ id: 'c', name: 'Gamma', copyCount: 3, updatedAt: '2026-02-01T00:00:00.000Z' })
    ];

    expect(sortSpells(spells, 'usage', 'desc', (item) => item.name).map((item) => item.id)).toEqual([
      'b',
      'c',
      'a'
    ]);
    expect(sortSpells(spells, 'usage', 'asc', (item) => item.name).map((item) => item.id)).toEqual([
      'a',
      'b',
      'c'
    ]);
    expect(spells.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by created updated and name with explicit direction', () => {
    const spells = [
      spell({
        id: 'long',
        name: 'Long spell name',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-04-01T00:00:00.000Z'
      }),
      spell({
        id: 'beta',
        name: 'Beta',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z'
      }),
      spell({
        id: 'alpha',
        name: 'Alpha',
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z'
      })
    ];

    expect(sortSpells(spells, 'created', 'desc', (item) => item.name).map((item) => item.id)).toEqual([
      'beta',
      'alpha',
      'long'
    ]);
    expect(sortSpells(spells, 'created', 'asc', (item) => item.name).map((item) => item.id)).toEqual([
      'long',
      'alpha',
      'beta'
    ]);
    expect(sortSpells(spells, 'updated', 'desc', (item) => item.name).map((item) => item.id)).toEqual([
      'long',
      'alpha',
      'beta'
    ]);
    expect(sortSpells(spells, 'name', 'asc', (item) => item.name).map((item) => item.id)).toEqual([
      'alpha',
      'beta',
      'long'
    ]);
    expect(sortSpells(spells, 'name', 'desc', (item) => item.name).map((item) => item.id)).toEqual([
      'long',
      'beta',
      'alpha'
    ]);
    expect(spells.map((item) => item.id)).toEqual(['long', 'beta', 'alpha']);
  });
});
