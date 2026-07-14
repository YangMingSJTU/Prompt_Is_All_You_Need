import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  APP_SIDEBAR_WIDTH,
  MAIN_WINDOW_DEFAULT_HEIGHT,
  MAIN_WINDOW_DEFAULT_WIDTH,
  MAIN_WINDOW_MIN_HEIGHT,
  MAIN_WINDOW_MIN_WIDTH,
  QUICK_PANEL_MIN_DETAIL_WIDTH,
  QUICK_PANEL_MIN_LIST_WIDTH,
  QUICK_PANEL_MIN_WIDTH,
  QUICK_PANEL_SPLITTER_WIDTH,
  SPELL_LIBRARY_HORIZONTAL_PADDING,
  SPELL_LIBRARY_MIN_CANDIDATE_WIDTH,
  SPELL_LIBRARY_MIN_LIST_WIDTH,
  SPELL_LIBRARY_SPLITTER_WIDTH,
  SPELL_LIBRARY_MIN_WORKSPACE_WIDTH
} from '../desktop/shared/layout';

describe('window layout constraints', () => {
  it('keeps the minimum content width wider than the largest page layout', () => {
    expect(QUICK_PANEL_MIN_WIDTH).toBe(
      QUICK_PANEL_MIN_LIST_WIDTH + QUICK_PANEL_SPLITTER_WIDTH + QUICK_PANEL_MIN_DETAIL_WIDTH
    );
    expect(MAIN_WINDOW_MIN_WIDTH - APP_SIDEBAR_WIDTH).toBeGreaterThan(QUICK_PANEL_MIN_WIDTH);
    expect(MAIN_WINDOW_DEFAULT_WIDTH).toBeGreaterThanOrEqual(MAIN_WINDOW_MIN_WIDTH);
    expect(MAIN_WINDOW_DEFAULT_HEIGHT).toBeGreaterThanOrEqual(MAIN_WINDOW_MIN_HEIGHT);
  });

  it('guarantees the spell library can keep candidates beside the spell list', () => {
    expect(SPELL_LIBRARY_MIN_WORKSPACE_WIDTH).toBe(
        SPELL_LIBRARY_HORIZONTAL_PADDING +
        SPELL_LIBRARY_MIN_LIST_WIDTH +
        SPELL_LIBRARY_SPLITTER_WIDTH +
        SPELL_LIBRARY_MIN_CANDIDATE_WIDTH
    );
    expect(SPELL_LIBRARY_SPLITTER_WIDTH).toBe(8);
    expect(MAIN_WINDOW_MIN_WIDTH - APP_SIDEBAR_WIDTH).toBeGreaterThanOrEqual(
      SPELL_LIBRARY_MIN_WORKSPACE_WIDTH
    );
  });

  it('uses content-area window sizing and shared renderer constraints', () => {
    const mainProcess = readFileSync('desktop/main/index.ts', 'utf8');
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const panel = readFileSync('desktop/renderer/components/SpellPanel.tsx', 'utf8');

    expect(mainProcess).toContain('useContentSize: true');
    expect(mainProcess).toContain('minWidth: MAIN_WINDOW_MIN_WIDTH');
    expect(mainProcess).toContain('minHeight: MAIN_WINDOW_MIN_HEIGHT');
    expect(app).toContain("'--app-min-width': `${MAIN_WINDOW_MIN_WIDTH}px`");
    expect(app).toContain("'--app-min-height': `${MAIN_WINDOW_MIN_HEIGHT}px`");
    expect(app).toContain("'--app-sidebar-width': `${APP_SIDEBAR_WIDTH}px`");
    expect(panel).toContain('minWidth: QUICK_PANEL_MIN_WIDTH');
  });

  it('keeps every main view scrollable or wrappable within the minimum workspace', () => {
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const stack = styles.match(/\.stack\s*\{[^}]+\}/s)?.[0] ?? '';
    const settingsContent = styles.match(/\.settings-content\s*\{[^}]+\}/s)?.[0] ?? '';
    const skillActions = styles.match(/\.skill-actions\s*\{[^}]+\}/s)?.[0] ?? '';
    const scanSourceRow = styles.match(/\.scan-source-row\s*\{[^}]+\}/s)?.[0] ?? '';
    const spellList = styles.match(/\.spell-list\s*\{[^}]+\}/s)?.[0] ?? '';
    const editorDialog = styles.match(/\.spell-editor-dialog\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(stack).toContain('overflow: auto;');
    expect(settingsContent).toContain('overflow: auto;');
    expect(skillActions).toContain('flex-wrap: wrap;');
    expect(scanSourceRow).toContain('grid-template-columns: 90px minmax(0, 1fr) auto auto;');
    expect(spellList).toContain('overflow: auto;');
    expect(editorDialog).toContain('width: min(760px, calc(100vw - 64px));');
    expect(editorDialog).toContain('height: min(580px, calc(100vh - 64px));');
  });

  it('uses one polished scrollbar system across light and dark surfaces', () => {
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const root = styles.match(/:root\s*\{[^}]+\}/s)?.[0] ?? '';
    const scrollbar = styles.match(/\*::-webkit-scrollbar\s*\{[^}]+\}/s)?.[0] ?? '';
    const thumb = styles.match(/\*::-webkit-scrollbar-thumb\s*\{[^}]+\}/s)?.[0] ?? '';
    const thumbHover =
      styles.match(/\*::-webkit-scrollbar-thumb:hover\s*\{[^}]+\}/s)?.[0] ?? '';
    const thumbActive =
      styles.match(/\*::-webkit-scrollbar-thumb:active\s*\{[^}]+\}/s)?.[0] ?? '';
    const darkSurfaceScrollbars =
      styles.match(
        /\.quick-spell-preview,\s*\.spell-preview,\s*\.export-preview\s*\{[^}]+\}/s
      )?.[0] ?? '';

    expect(root).toContain('--scrollbar-size: 10px;');
    expect(root).toContain('--scrollbar-thumb-hover:');
    expect(scrollbar).toContain('width: var(--scrollbar-size);');
    expect(scrollbar).toContain('height: var(--scrollbar-size);');
    expect(thumb).toContain('min-width: 36px;');
    expect(thumb).toContain('min-height: 36px;');
    expect(thumb).toContain('border: 2px solid transparent;');
    expect(thumb).toContain('border-radius: 999px;');
    expect(thumb).toContain('background-clip: padding-box;');
    expect(thumbHover).toContain('border-width: 1px;');
    expect(thumbHover).toContain('background-color: var(--scrollbar-thumb-hover);');
    expect(thumbActive).toContain('background-color: var(--scrollbar-thumb-active);');
    expect(styles).toContain('*::-webkit-scrollbar-button');
    expect(styles).toContain('*::-webkit-scrollbar-corner');
    expect(darkSurfaceScrollbars).toContain('--scrollbar-thumb: rgba(228, 228, 231, 0.3);');
  });
});
