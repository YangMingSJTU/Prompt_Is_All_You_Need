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
  it('sorts by copy count and then recently updated for usage-first views', () => {
    const spells = [
      spell({ id: 'a', name: 'Alpha', copyCount: 1, updatedAt: '2026-01-01T00:00:00.000Z' }),
      spell({ id: 'b', name: 'Beta', copyCount: 3, updatedAt: '2026-01-01T00:00:00.000Z' }),
      spell({ id: 'c', name: 'Gamma', copyCount: 3, updatedAt: '2026-02-01T00:00:00.000Z' })
    ];

    expect(sortSpells(spells, 'usage', (item) => item.name).map((item) => item.id)).toEqual([
      'c',
      'b',
      'a'
    ]);
  });

  it('sorts by created updated name and name length without mutating input', () => {
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

    expect(sortSpells(spells, 'created', (item) => item.name).map((item) => item.id)).toEqual([
      'beta',
      'alpha',
      'long'
    ]);
    expect(sortSpells(spells, 'updated', (item) => item.name).map((item) => item.id)).toEqual([
      'long',
      'alpha',
      'beta'
    ]);
    expect(sortSpells(spells, 'name', (item) => item.name).map((item) => item.id)).toEqual([
      'alpha',
      'beta',
      'long'
    ]);
    expect(sortSpells(spells, 'nameLength', (item) => item.name).map((item) => item.id)).toEqual([
      'beta',
      'alpha',
      'long'
    ]);
    expect(spells.map((item) => item.id)).toEqual(['long', 'beta', 'alpha']);
  });
});
