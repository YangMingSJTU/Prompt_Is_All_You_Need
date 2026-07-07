import { describe, expect, it } from 'vitest';
import { generateCandidates } from '../desktop/main/services/ranker';

describe('ranker', () => {
  it('groups review diff prompts into a review-diff spell candidate', () => {
    const candidates = generateCandidates([
      {
        id: '1',
        rawText: '帮我 review 当前 diff',
        normalizedText: 'review diff',
        sourceTool: 'codex',
        sourceFile: 'codex.jsonl',
        sessionId: null,
        projectPath: 'app',
        timestamp: '2026-07-01T00:00:00.000Z',
        turnIndex: 0,
        hash: 'hash-1'
      },
      {
        id: '2',
        rawText: 'review current changes for edge cases',
        normalizedText: 'review current changes',
        sourceTool: 'claude',
        sourceFile: 'claude.jsonl',
        sessionId: null,
        projectPath: 'api',
        timestamp: '2026-07-02T00:00:00.000Z',
        turnIndex: 1,
        hash: 'hash-2'
      }
    ]);

    expect(candidates[0].slug).toBe('review-diff');
    expect(candidates[0].candidateType).toBe('spell');
    expect(candidates[0].sourceCount).toBe(2);
  });
});
