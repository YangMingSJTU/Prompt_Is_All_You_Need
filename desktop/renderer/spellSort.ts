import type { Spell } from '../shared/types';

export type SpellSortDirection = 'asc' | 'desc';
export type SpellTableSortMode = 'usage' | 'updated' | 'name';
export type SpellTableSortState =
  | { mode: null; direction: null }
  | { mode: SpellTableSortMode; direction: SpellSortDirection };

export const DEFAULT_SPELL_TABLE_SORT_STATE: SpellTableSortState = {
  mode: null,
  direction: null
};

export const DEFAULT_SORT_DIRECTIONS: Record<SpellTableSortMode, SpellSortDirection> = {
  usage: 'desc',
  updated: 'desc',
  name: 'asc'
};

export function getNextSpellTableSortState(
  current: SpellTableSortState,
  nextMode: SpellTableSortMode
): SpellTableSortState {
  const defaultDirection = DEFAULT_SORT_DIRECTIONS[nextMode];
  if (current.mode !== nextMode) {
    return { mode: nextMode, direction: defaultDirection };
  }
  if (current.direction === defaultDirection) {
    return {
      mode: nextMode,
      direction: defaultDirection === 'asc' ? 'desc' : 'asc'
    };
  }
  return DEFAULT_SPELL_TABLE_SORT_STATE;
}

export function sortSpellsByTableState(
  spells: Spell[],
  state: SpellTableSortState,
  getName: (spell: Spell) => string
): Spell[] {
  if (!state.mode || !state.direction) {
    return spells;
  }
  return sortSpells(spells, state.mode, state.direction, getName);
}

export function sortSpells(
  spells: Spell[],
  sortMode: SpellTableSortMode,
  sortDirection: SpellSortDirection,
  getName: (spell: Spell) => string
): Spell[] {
  return [...spells].sort((left, right) => {
    const primary = comparePrimary(left, right, sortMode, getName);
    const directedPrimary = sortDirection === 'asc' ? primary : -primary;
    return directedPrimary || compareName(left, right, getName);
  });
}

function comparePrimary(
  left: Spell,
  right: Spell,
  sortMode: SpellTableSortMode,
  getName: (spell: Spell) => string
): number {
  if (sortMode === 'usage') {
    return left.copyCount - right.copyCount;
  }
  if (sortMode === 'updated') {
    return compareDateAsc(left.updatedAt, right.updatedAt);
  }
  return compareName(left, right, getName);
}

function compareDateAsc(left: string, right: string): number {
  return Date.parse(left) - Date.parse(right);
}

function compareName(left: Spell, right: Spell, getName: (spell: Spell) => string): number {
  return getName(left).localeCompare(getName(right), undefined, {
    sensitivity: 'base'
  });
}
