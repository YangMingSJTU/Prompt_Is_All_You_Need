import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('app chrome defaults', () => {
  it('does not expose retired Prompt Miner title or tray placeholder icon', () => {
    const html = readFileSync('index.html', 'utf8');
    const mainProcess = readFileSync('desktop/main/index.ts', 'utf8');

    expect(html).not.toContain('Prompt Miner');
    expect(html).toContain('<title>魔法书</title>');
    expect(mainProcess).not.toContain('createFromDataURL');
    expect(mainProcess).not.toContain('iVBORw0KGgo');
  });
});
