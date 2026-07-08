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

  it('starts sidebar navigation at the top after removing the brand header', () => {
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const navList = styles.match(/\.nav-list\s*\{[^}]+\}/)?.[0] ?? '';

    expect(navList).toContain('margin-top: 0;');
    expect(navList).not.toContain('margin-top: 42px;');
  });

  it('uses a Multica-style hidden native title bar with a custom drag strip', () => {
    const mainProcess = readFileSync('desktop/main/index.ts', 'utf8');
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(mainProcess).toContain("titleBarStyle: 'hidden'");
    expect(mainProcess).toContain('titleBarOverlay');
    expect(mainProcess).toContain("color: '#0f1115'");
    expect(mainProcess).toContain("symbolColor: '#f5f0df'");
    expect(mainProcess).toContain('height: 40');

    expect(app).toContain('app-titlebar');
    expect(app).toContain('titlebar-brand');
    expect(app).toContain('titlebar-window-controls');

    expect(styles.match(/\.app-titlebar\s*\{[^}]+-webkit-app-region: drag;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.titlebar-window-controls\s*\{[^}]+-webkit-app-region: no-drag;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.app-shell\s*\{[^}]+height: calc\(100vh - 40px\);[^}]+\}/s)?.[0]).toBeTruthy();
  });

  it('lets workspace content layouts use the remaining grid height instead of viewport math', () => {
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const contentSelectors = ['panel-grid', 'stack', 'spell-library-grid', 'settings-layout'];

    for (const selector of contentSelectors) {
      const block = styles.match(new RegExp(`\\.${selector}\\s*\\{[^}]+\\}`, 's'))?.[0] ?? '';
      expect(block).toContain('height: 100%;');
      expect(block).toContain('min-height: 0;');
      expect(block).not.toContain('calc(100vh - 53px)');
    }
  });
});
