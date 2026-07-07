import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scanJsonlFiles } from '../desktop/main/services/scanner';

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
    await rm(dir, { recursive: true, force: true });
  });
});
