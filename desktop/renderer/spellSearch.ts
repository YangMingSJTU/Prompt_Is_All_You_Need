import type { Spell } from '../shared/types';

export type SearchScope = 'title-content' | 'title' | 'content';
export type SpellStatusFilter = 'active' | 'favorite';

export interface SpellFilters {
  query: string;
  searchScope: SearchScope;
  selectedTags: string[];
  statusFilter: SpellStatusFilter;
}

interface SearchableSpell {
  name: string;
  body: string;
}

export function matchesSpellSearch(spell: SearchableSpell, query: string, scope: SearchScope): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const name = spell.name.toLowerCase();
  const body = spell.body.toLowerCase();

  if (scope === 'title') {
    return name.includes(normalizedQuery);
  }
  if (scope === 'content') {
    return body.includes(normalizedQuery);
  }
  return name.includes(normalizedQuery) || body.includes(normalizedQuery);
}

export function filterSpells(
  spells: Spell[],
  filters: SpellFilters,
  getName: (spell: Spell) => string
): Spell[] {
  return spells.filter((spell) => {
    const matchesStatus = filters.statusFilter !== 'favorite' || spell.isFavorite;
    const matchesQuery = matchesSpellSearch(
      { name: getName(spell), body: spell.body },
      filters.query,
      filters.searchScope
    );
    const matchesTags =
      filters.selectedTags.length === 0 ||
      filters.selectedTags.every((tag) => spell.tags.includes(tag));
    return matchesStatus && matchesQuery && matchesTags;
  });
}

export function getSpellFilterTags(
  spells: Spell[],
  statusFilter: SpellStatusFilter
): string[] {
  const tags = new Set<string>();
  for (const spell of spells) {
    if (statusFilter === 'favorite' && !spell.isFavorite) {
      continue;
    }
    for (const tag of spell.tags) {
      tags.add(tag);
    }
  }
  return [...tags].sort((left, right) => left.localeCompare(right));
}
