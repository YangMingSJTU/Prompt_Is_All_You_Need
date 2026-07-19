import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  discoverJsonlFiles,
  hasSuccessfulSourceScan,
  scanJsonlFiles
} from '../desktop/main/services/scanner';

describe('scanner', () => {
  it('scans jsonl files and ignores tool results', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'apm-scan-'));
    const file = join(dir, 'history.jsonl');
    await writeFile(
      file,
      [
        JSON.stringify({ role: 'user', content: 'review current diff' }),
        JSON.stringify({ role: 'assistant', content: 'assistant content' }),
        JSON.stringify({ type: 'tool_result', content: 'secret tool output' })
      ].join('\n')
    );

    const result = await scanJsonlFiles([file], 'codex');

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0].rawText).toBe('review current diff');
    expect(hasSuccessfulSourceScan(result.sourceFiles)).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  it('does not treat unreadable history files as a successful refresh', async () => {
    const result = await scanJsonlFiles(
      [join(tmpdir(), 'missing-spell-history.jsonl')],
      'codex'
    );

    expect(result.sourceFiles).toHaveLength(1);
    expect(result.sourceFiles[0].status).toBe('skipped');
    expect(hasSuccessfulSourceScan(result.sourceFiles)).toBe(false);
  });

  it('distinguishes missing roots from successful empty scans', async () => {
    const root = await mkdtemp(join(tmpdir(), 'spellbook-discovery-'));
    try {
      await expect(discoverJsonlFiles(join(root, 'missing'))).resolves.toEqual({
        status: 'missing',
        files: []
      });
      await expect(discoverJsonlFiles(root)).resolves.toEqual({
        status: 'success',
        files: []
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reports I/O failures instead of an empty success', async () => {
    await expect(discoverJsonlFiles('\u0000')).resolves.toMatchObject({
      status: 'failed',
      files: [],
      error: { code: 'io_error' }
    });
  });
});
