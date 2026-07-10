export type SearchScope = 'title-content' | 'title' | 'content';

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
