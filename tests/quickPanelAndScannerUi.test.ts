import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('scanner placement and floating quick panel UI', () => {
  it('merges local scanning into local data settings instead of a separate page', () => {
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const settings = readFileSync('desktop/renderer/components/SettingsView.tsx', 'utf8');

    const navItems = app.match(/const NAV_ITEMS[\s\S]+?\];/)?.[0] ?? '';

    expect(navItems).not.toContain("'scanner'");
    expect(navItems).not.toContain('nav.scanner');
    expect(app).not.toContain("view === 'scanner'");
    expect(app).not.toContain('<ScannerView');

    expect(settings).toContain("type SettingsTab = 'preferences' | 'shortcut' | 'localData'");
    expect(settings).not.toContain("labelKey: 'settings.scanner'");
    expect(settings).not.toContain("activeTab === 'scanner'");
    expect(settings).not.toContain('<ScannerView');
    expect(settings).toContain('scanTarget');
    expect(settings).toContain('selectedProviders');
    expect(settings).toContain('scanSources');
    expect(settings).toContain('activeScanSources');
    expect(settings).toContain('promoteCandidates');
    expect(settings).toContain('selectAllCandidates');
    expect(settings).toContain('candidate-selection-list');
    expect(settings).toContain("candidate.sourceCount} ${t('metric.sources')}");
    expect(settings).not.toContain('candidate.score');
    expect(settings).not.toContain("t('metric.score')");
    expect(settings).toContain('selectDirectory');
    expect(settings).toContain('chooseScanSourceDirectory');
    expect(settings).not.toContain('settings.scanSources\n                .filter');
    expect(settings).not.toContain('sourceFiles');
    expect(settings).not.toContain('source-table');
  });

  it('uses native directory picking and flexible scan results in local data settings', () => {
    const main = readFileSync('desktop/main/index.ts', 'utf8');
    const preload = readFileSync('desktop/main/preload.ts', 'utf8');
    const globalTypes = readFileSync('desktop/renderer/global.d.ts', 'utf8');
    const settings = readFileSync('desktop/renderer/components/SettingsView.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(main).toContain('dialog');
    expect(main).toContain("ipcMain.handle('dialog:selectDirectory'");
    expect(main).toContain('showOpenDialog');
    expect(main).toContain("'openDirectory'");

    expect(preload).toContain('selectDirectory');
    expect(preload).toContain("ipcRenderer.invoke('dialog:selectDirectory'");
    expect(globalTypes).toContain('selectDirectory(defaultPath?: string): Promise<string | null>');

    expect(settings).toContain('chooseScanSourceDirectory');
    expect(settings).toContain('readOnly');
    expect(settings).toContain("t('settings.scanPath.choose')");

    const candidateListBlock = styles.match(/\.candidate-selection-list\s*\{[^}]+\}/s)?.[0] ?? '';
    const settingsSectionBlock = styles.match(/\.settings-section\s*\{[^}]+\}/s)?.[0] ?? '';
    const fillSettingsCardBlock = styles.match(/\.settings-section\.fill\s+\.settings-card\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(candidateListBlock).not.toContain('max-height: 300px');
    expect(candidateListBlock).toContain('flex: 1');
    expect(candidateListBlock).toContain('min-height: 0');
    expect(settingsSectionBlock).toContain('height: 100%');
    expect(fillSettingsCardBlock).toContain('flex: 1');
  });

  it('reuses shared filters and shows spell content as compact row summaries', () => {
    const main = readFileSync('desktop/main/index.ts', 'utf8');
    const component = readFileSync('desktop/renderer/components/FloatingPanel.tsx', 'utf8');
    const searchFilter = readFileSync(
      'desktop/renderer/components/SpellSearchFilter.tsx',
      'utf8'
    );
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(main).toContain('width: 420');
    expect(main).toContain('height: 320');
    expect(main).toContain('minWidth: 380');
    expect(main).toContain('minHeight: 280');
    expect(main).toContain('maxWidth: 460');
    expect(main).toContain('maxHeight: 360');

    expect(component).toContain('listSpells()');
    expect(component).not.toContain('searchSpells(');
    expect(component).toContain('filtered.slice(0, 5)');
    expect(component).toContain('filterSpells');
    expect(component).toContain('getSpellFilterTags');
    expect(component).toContain('SpellSearchFilter');
    expect(component).toContain('searchScope={searchScope}');
    expect(component).toContain('statusFilter={statusFilter}');
    expect(component).toContain('onInputKeyDown={(event) => void handleKeyDown(event)}');
    expect(component).toContain('deriveSpellName');
    expect(component).toContain('getFloatingSpellName');
    expect(component).toContain('floating-row-name');
    expect(component).toContain('floating-row-content');
    expect(component).toContain('getFloatingSpellSummary(spell)');
    expect(component).not.toContain('floating-preview');
    expect(searchFilter).toContain('inputRef?: Ref<HTMLInputElement>');
    expect(searchFilter).toContain('onInputKeyDown?: KeyboardEventHandler<HTMLInputElement>');
    expect(searchFilter).toContain('ref={inputRef}');
    expect(searchFilter).toContain('onKeyDown={onInputKeyDown}');

    expect(styles).toContain('.floating-row-identity');
    expect(styles).toContain('.floating-row-name');
    expect(styles).toContain('.floating-row-content');
    expect(styles.match(/\.floating-row\s*\{[^}]+height: 46px;[^}]+min-height: 46px;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.floating-row-content\s*\{[^}]+text-overflow: ellipsis;[^}]+white-space: nowrap;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles).not.toContain('.floating-preview');
  });

  it('removes dedicated floating-panel sorting and its unused resources', () => {
    const component = readFileSync('desktop/renderer/components/FloatingPanel.tsx', 'utf8');
    const sortLogic = readFileSync('desktop/renderer/spellSort.ts', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const i18n = readFileSync('desktop/renderer/i18n.ts', 'utf8');

    expect(component).not.toContain('SpellSortMenu');
    expect(component).not.toContain('sortSpells');
    expect(existsSync('desktop/renderer/components/SpellSortMenu.tsx')).toBe(false);
    expect(styles).not.toContain('.sort-menu-');
    expect(styles).not.toContain('.sort-direction-');
    expect(styles).not.toContain('.floating-search-row');
    expect(styles).not.toContain('.floating-search {');
    expect(i18n).not.toContain('floating.sort.');
    expect(sortLogic).not.toContain('SPELL_SORT_OPTIONS');
    expect(sortLogic).not.toContain("'created'");
  });
});
