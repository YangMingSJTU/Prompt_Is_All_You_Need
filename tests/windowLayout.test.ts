import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  APP_SIDEBAR_WIDTH,
  FLOATING_WINDOW_DEFAULT_HEIGHT,
  FLOATING_WINDOW_DEFAULT_WIDTH,
  FLOATING_WINDOW_MAX_HEIGHT,
  FLOATING_WINDOW_MAX_WIDTH,
  FLOATING_WINDOW_MIN_HEIGHT,
  FLOATING_WINDOW_MIN_WIDTH,
  MAIN_WINDOW_COMPACT_MIN_WIDTH,
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
  SPELL_LIBRARY_DEFAULT_RECOMMENDATION_WINDOW_DELTA,
  SPELL_LIBRARY_SPLITTER_WIDTH,
  SPELL_LIBRARY_MIN_WORKSPACE_WIDTH
} from '../desktop/shared/layout';

describe('window layout constraints', () => {
  it('keeps the floating panel compact while allowing bounded resizing', () => {
    expect(FLOATING_WINDOW_DEFAULT_WIDTH).toBeGreaterThan(FLOATING_WINDOW_MIN_WIDTH);
    expect(FLOATING_WINDOW_DEFAULT_WIDTH).toBeLessThan(FLOATING_WINDOW_MAX_WIDTH);
    expect(FLOATING_WINDOW_DEFAULT_HEIGHT).toBeGreaterThan(FLOATING_WINDOW_MIN_HEIGHT);
    expect(FLOATING_WINDOW_DEFAULT_HEIGHT).toBeLessThan(FLOATING_WINDOW_MAX_HEIGHT);
    expect(FLOATING_WINDOW_MAX_WIDTH - FLOATING_WINDOW_MIN_WIDTH).toBeGreaterThanOrEqual(200);
    expect(FLOATING_WINDOW_MAX_HEIGHT - FLOATING_WINDOW_MIN_HEIGHT).toBeGreaterThanOrEqual(300);
  });

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
    expect(SPELL_LIBRARY_DEFAULT_RECOMMENDATION_WINDOW_DELTA).toBe(
      SPELL_LIBRARY_SPLITTER_WIDTH + SPELL_LIBRARY_MIN_CANDIDATE_WIDTH
    );
    expect(MAIN_WINDOW_COMPACT_MIN_WIDTH).toBe(
      APP_SIDEBAR_WIDTH + SPELL_LIBRARY_HORIZONTAL_PADDING + SPELL_LIBRARY_MIN_LIST_WIDTH
    );
    expect(MAIN_WINDOW_COMPACT_MIN_WIDTH).toBeLessThan(MAIN_WINDOW_MIN_WIDTH);
  });

  it('uses content-area window sizing and shared renderer constraints', () => {
    const mainProcess = readFileSync('desktop/main/index.ts', 'utf8');
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const panel = readFileSync('desktop/renderer/components/SpellPanel.tsx', 'utf8');

    expect(mainProcess).toContain('useContentSize: true');
    expect(mainProcess).toContain('minWidth: MAIN_WINDOW_MIN_WIDTH');
    expect(mainProcess).toContain('minHeight: MAIN_WINDOW_MIN_HEIGHT');
    expect(app).toContain("'--app-min-width':");
    expect(app).toContain('compactLibraryWindow ? MAIN_WINDOW_COMPACT_MIN_WIDTH : MAIN_WINDOW_MIN_WIDTH');
    expect(app).toContain("'--app-min-height': `${MAIN_WINDOW_MIN_HEIGHT}px`");
    expect(app).toContain("'--app-sidebar-width': `${APP_SIDEBAR_WIDTH}px`");
    expect(panel).toContain('minWidth: QUICK_PANEL_MIN_WIDTH');
  });

  it('shrinks the main window with the recommendation panel and restores it safely', () => {
    const mainProcess = readFileSync('desktop/main/index.ts', 'utf8');
    const preload = readFileSync('desktop/main/preload.ts', 'utf8');
    const globals = readFileSync('desktop/renderer/global.d.ts', 'utf8');
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const library = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');

    expect(mainProcess).toContain("'window:setRecommendationPanelOpen'");
    expect(mainProcess).toContain('owner !== mainWindow');
    expect(mainProcess).toContain('setMainWindowRecommendationPanelOpen');
    expect(mainProcess).toContain('window.getContentBounds()');
    expect(mainProcess).toContain('window.setContentBounds');
    expect(mainProcess).toContain(
      'window.setMinimumSize(MAIN_WINDOW_COMPACT_MIN_WIDTH, MAIN_WINDOW_MIN_HEIGHT)'
    );
    expect(mainProcess).toContain('screen.getDisplayMatching(bounds)');
    expect(mainProcess).toContain(': mainWindowRecommendationDelta');
    expect(preload).toContain('setRecommendationPanelWindowOpen');
    expect(globals).toContain(
      'setRecommendationPanelWindowOpen(open: boolean, panelWidth?: number): Promise<void>'
    );
    expect(app).toContain("view !== 'library' || settings.recommendationPanelOpen");
    expect(app).toContain('compactLibraryWindow');
    expect(app).toContain('MAIN_WINDOW_COMPACT_MIN_WIDTH');
    expect(library).toContain('candidateDockRef');
    expect(library).toContain('getBoundingClientRect().width');
    expect(library).toContain('SPELL_LIBRARY_SPLITTER_WIDTH');
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
