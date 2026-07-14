import type { Spell } from '../shared/types';
import type { I18nKey } from './i18n';

export type SpellSortMode = 'usage' | 'created' | 'updated' | 'name';
export type SpellSortDirection = 'asc' | 'desc';
export type SpellTableSortMode = Exclude<SpellSortMode, 'created'>;
export type SpellTableSortState =
  | { mode: null; direction: null }
  | { mode: SpellTableSortMode; direction: SpellSortDirection };

export const DEFAULT_SPELL_TABLE_SORT_STATE: SpellTableSortState = {
  mode: null,
  direction: null
};

export const SPELL_SORT_OPTIONS: Array<{ value: SpellSortMode; labelKey: I18nKey }> = [
  { value: 'usage', labelKey: 'floating.sort.usage' },
  { value: 'created', labelKey: 'floating.sort.created' },
  { value: 'updated', labelKey: 'floating.sort.updated' },
  { value: 'name', labelKey: 'floating.sort.name' }
];

export const DEFAULT_SORT_DIRECTIONS: Record<SpellSortMode, SpellSortDirection> = {
  usage: 'desc',
  created: 'desc',
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
  sortMode: SpellSortMode,
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
  sortMode: SpellSortMode,
  getName: (spell: Spell) => string
): number {
  if (sortMode === 'usage') {
    return left.copyCount - right.copyCount;
  }
  if (sortMode === 'created') {
    return compareDateAsc(left.createdAt, right.createdAt);
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
