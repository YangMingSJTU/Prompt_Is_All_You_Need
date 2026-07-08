import { createHash, randomUUID } from 'node:crypto';
import type { Candidate, ExtractedPrompt } from '../../shared/types';

interface CandidateGroup {
  body: string;
  prompts: ExtractedPrompt[];
}

export function generateCandidates(prompts: ExtractedPrompt[]): Candidate[] {
  const groups = new Map<string, CandidateGroup>();

  for (const prompt of prompts) {
    if (!prompt.rawText) {
      continue;
    }
    const key = hashRawPrompt(prompt.rawText);
    const existing = groups.get(key);
    if (existing) {
      existing.prompts.push(prompt);
    } else {
      groups.set(key, { body: prompt.rawText, prompts: [prompt] });
    }
  }

  return Array.from(groups.entries())
    .map(([hash, group]) => buildCandidate(hash, group))
    .sort((left, right) => right.sourceCount - left.sourceCount || right.score - left.score || left.title.localeCompare(right.title));
}

function buildCandidate(hash: string, group: CandidateGroup): Candidate {
  const now = new Date().toISOString();
  const sourceTools = new Set(group.prompts.map((prompt) => prompt.sourceTool));
  const sourceFiles = new Set(group.prompts.map((prompt) => prompt.sourceFile));
  const score = Math.min(1, group.prompts.length * 0.12 + sourceTools.size * 0.08 + sourceFiles.size * 0.05 + 0.35);

  return {
    id: randomUUID(),
    slug: `spell-${hash.slice(0, 16)}`,
    title: deriveCandidateTitle(group.body),
    description: '',
    template: group.body,
    candidateType: 'spell',
    sourceCount: group.prompts.length,
    score: Number(score.toFixed(2)),
    status: 'pending',
    examples: [group.body],
    createdAt: now,
    updatedAt: now
  };
}

function deriveCandidateTitle(body: string): string {
  const firstLine = body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) {
    return 'Untitled spell';
  }
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

function hashRawPrompt(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}
