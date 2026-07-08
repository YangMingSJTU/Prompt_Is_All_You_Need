import type { Spell } from '../shared/types';
import type { I18nKey } from './i18n';

export type SpellSortMode = 'usage' | 'created' | 'updated' | 'name' | 'nameLength';

export const SPELL_SORT_OPTIONS: Array<{ value: SpellSortMode; labelKey: I18nKey }> = [
  { value: 'usage', labelKey: 'floating.sort.usage' },
  { value: 'created', labelKey: 'floating.sort.created' },
  { value: 'updated', labelKey: 'floating.sort.updated' },
  { value: 'name', labelKey: 'floating.sort.name' },
  { value: 'nameLength', labelKey: 'floating.sort.nameLength' }
];

export function sortSpells(
  spells: Spell[],
  sortMode: SpellSortMode,
  getName: (spell: Spell) => string
): Spell[] {
  return [...spells].sort((left, right) => {
    if (sortMode === 'usage') {
      return (
        right.copyCount - left.copyCount ||
        compareDateDesc(left.updatedAt, right.updatedAt) ||
        compareName(left, right, getName)
      );
    }
    if (sortMode === 'created') {
      return compareDateDesc(left.createdAt, right.createdAt) || compareName(left, right, getName);
    }
    if (sortMode === 'updated') {
      return compareDateDesc(left.updatedAt, right.updatedAt) || compareName(left, right, getName);
    }
    if (sortMode === 'nameLength') {
      return getName(left).length - getName(right).length || compareName(left, right, getName);
    }
    return compareName(left, right, getName);
  });
}

function compareDateDesc(left: string, right: string): number {
  return Date.parse(right) - Date.parse(left);
}

function compareName(left: Spell, right: Spell, getName: (spell: Spell) => string): number {
  return getName(left).localeCompare(getName(right), undefined, {
    sensitivity: 'base'
  });
}
