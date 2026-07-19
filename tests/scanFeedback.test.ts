import { describe, expect, it } from 'vitest';
import { summarizeScanFeedback } from '../desktop/renderer/scanFeedback';
import type { SourceFileSummary } from '../desktop/shared/types';

function source(
  status: string,
  path: string,
  error?: SourceFileSummary['error']
): SourceFileSummary {
  return {
    id: path,
    sourceTool: 'codex',
    path,
    status,
    lineCount: 0,
    promptCount: 0,
    warningCount: error ? 1 : 0,
    scannedAt: '2026-07-19T00:00:00.000Z',
    error
  };
}

describe('scan feedback', () => {
  it('surfaces exact failed paths as a partial warning when another file was scanned', () => {
    expect(
      summarizeScanFeedback([
        source('scanned', '/Users/Ada/.codex/readable/history.jsonl'),
        source('unreadable', '/Users/Ada/.codex/denied', {
          code: 'permission_denied',
          path: '/Users/Ada/.codex/denied',
          retryable: true
        })
      ])
    ).toEqual({
      kind: 'partial',
      paths: ['/Users/Ada/.codex/denied']
    });
  });

  it('uses failed feedback when no source was readable', () => {
    expect(
      summarizeScanFeedback([
        source('failed', 'C:\\Users\\Ada\\.codex', {
          code: 'io_error',
          path: 'C:\\Users\\Ada\\.codex',
          retryable: true
        })
      ])
    ).toEqual({
      kind: 'failed',
      paths: ['C:\\Users\\Ada\\.codex']
    });
  });
});
