import type { Candidate, Spell } from '../shared/types';
import { deriveSpellName } from '../shared/spellNaming';

export { deriveSpellName } from '../shared/spellNaming';

export function getSpellDisplayText(spell: Pick<Spell, 'body'>): string {
  return spell.body;
}

export function getCandidateDisplayText(candidate: Pick<Candidate, 'template'>): string {
  return candidate.template;
}

export function getSpellDisplayName(
  spell: Pick<Spell, 'name' | 'body'>,
  fallback: string
): string {
  return spell.name || deriveSpellName(spell.body, fallback);
}

export function formatSpellUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
}

export function formatSpellUpdatedAtTitle(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}
