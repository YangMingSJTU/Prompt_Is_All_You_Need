import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { previewExport, writeExport } from '../desktop/main/services/exporter';

describe('exporter', () => {
  it('previews a codex skill without writing', () => {
    const preview = previewExport(
      {
        slug: 'review-diff',
        title: 'Review diff',
        description: 'Review changes',
        body: 'Review the current diff.'
      },
      'codex-skill',
      'C:/tmp'
    );

    expect(preview.path).toContain('review-diff');
    expect(preview.content).toContain('name: review-diff');
  });

  it('writes a snippet only after confirmation', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'apm-export-'));
    const result = await writeExport(
      {
        slug: 'commit-message',
        title: 'Commit message',
        description: 'Generate commit message',
        body: 'Generate a commit message.'
      },
      'snippet',
      dir
    );
    const content = await readFile(result.path, 'utf8');

    expect(content).toContain('slug: commit-message');
    await rm(dir, { recursive: true, force: true });
  });
});
