import type { Candidate, Spell } from '../shared/types';

export function getSpellDisplayText(spell: Pick<Spell, 'body'>): string {
  return spell.body;
}

export function getCandidateDisplayText(candidate: Pick<Candidate, 'template'>): string {
  return candidate.template;
}
