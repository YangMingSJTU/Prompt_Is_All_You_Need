import type { Candidate, Spell } from '../shared/types';

export function getSpellDisplayText(spell: Pick<Spell, 'body'>): string {
  return spell.body;
}

export function getCandidateDisplayText(candidate: Pick<Candidate, 'template'>): string {
  return candidate.template;
}

export function deriveSpellName(body: string, fallback: string): string {
  const normalized = body.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return fallback;
  }
  const maxLength = 28;
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}
