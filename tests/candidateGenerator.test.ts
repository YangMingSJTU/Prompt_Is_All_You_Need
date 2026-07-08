import { describe, expect, it } from 'vitest';
import { generateCandidates } from '../desktop/main/services/candidateGenerator';

describe('candidate generator', () => {
  it('creates spell candidates from exact raw prompt text instead of canned templates', () => {
    const rawPrompt = [
      'Generate a concise commit message for the current changes.',
      '',
      'Use my team format exactly:',
      'change: <summary>',
      '',
      'Do not add testing notes.'
    ].join('\n');
    const candidates = generateCandidates([
      {
        id: '1',
        rawText: rawPrompt,
        normalizedText: 'generate a concise commit message for the current changes.',
        sourceTool: 'codex',
        sourceFile: 'codex.jsonl',
        sessionId: null,
        projectPath: 'app',
        timestamp: '2026-07-01T00:00:00.000Z',
        turnIndex: 0,
        hash: 'hash-1'
      }
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].template).toBe(rawPrompt);
    expect(candidates[0].template).not.toContain('Testing notes');
    expect(candidates[0].candidateType).toBe('spell');
    expect(candidates[0].sourceCount).toBe(1);
  });

  it('deduplicates repeated raw prompt bodies without changing the candidate body', () => {
    const candidates = generateCandidates([
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
      },
      {
        id: '3',
        rawText: 'review current changes for edge cases',
        normalizedText: 'review current changes',
        sourceTool: 'codex',
        sourceFile: 'codex-2.jsonl',
        sessionId: null,
        projectPath: 'api',
        timestamp: '2026-07-03T00:00:00.000Z',
        turnIndex: 2,
        hash: 'hash-2'
      }
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].template).toBe('review current changes for edge cases');
    expect(candidates[0].sourceCount).toBe(2);
  });
});
