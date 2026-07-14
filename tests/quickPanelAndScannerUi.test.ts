import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('scanner placement and floating quick panel UI', () => {
  it('merges local scanning into local data settings instead of a separate page', () => {
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const library = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
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

    expect(app).toContain("onOpenRecommendationDiscovery={() => openSettings('localData')}");
    expect(app).toContain('activeTab={settingsTab}');
    expect(settings).toContain('activeTab: SettingsTab');
    expect(settings).toContain('onTabChange(tab: SettingsTab): void');
    expect(settings).toContain("useState<ScanTarget>('spells')");
    expect(library).toContain('onClick={onOpenRecommendationDiscovery}');
    expect(library).toContain("t('library.find')");
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
    expect(main).toContain('if (hasSuccessfulSourceScan(summaries))');

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

    expect(main).toContain('width: FLOATING_WINDOW_DEFAULT_WIDTH');
    expect(main).toContain('height: FLOATING_WINDOW_DEFAULT_HEIGHT');
    expect(main).toContain('minWidth: FLOATING_WINDOW_MIN_WIDTH');
    expect(main).toContain('minHeight: FLOATING_WINDOW_MIN_HEIGHT');
    expect(main).toContain('maxWidth: FLOATING_WINDOW_MAX_WIDTH');
    expect(main).toContain('maxHeight: FLOATING_WINDOW_MAX_HEIGHT');
    expect(main).toContain('resizable: true');
    expect(main).toContain('movable: true');
    expect(main).toContain('thickFrame: true');

    expect(component).toContain('listSpells()');
    expect(component).not.toContain('searchSpells(');
    expect(component).not.toContain('slice(0, 5)');
    expect(component).toContain('filterSpells');
    expect(component).toContain('getSpellFilterTags');
    expect(component).toContain("sortSpells(filtered, 'usage', 'desc'");
    expect(component).toContain('SpellSearchFilter');
    expect(component).toContain('searchScope={searchScope}');
    expect(component).toContain('statusFilter={statusFilter}');
    expect(component).toContain('onInputKeyDown={(event) => void handleKeyDown(event)}');
    expect(component).toContain('deriveSpellName');
    expect(component).toContain('getFloatingSpellName');
    expect(component).toContain('floating-row-name');
    expect(component).toContain('floating-row-content');
    expect(component).toContain('getFloatingSpellSummary(spell)');
    expect(component).toContain('className="floating-row-copy"');
    expect(component).toContain('onClick={() => void copySpell(spell)}');
    expect(component).toContain('updateSpellState(spell.id, { isFavorite: nextFavorite })');
    expect(component).toContain('aria-pressed={spell.isFavorite}');
    expect(component).toContain('showTooltips={false}');
    expect(component).not.toContain('title=');
    expect(component).not.toContain('floating-preview');
    expect(searchFilter).toContain('inputRef?: Ref<HTMLInputElement>');
    expect(searchFilter).toContain('onInputKeyDown?: KeyboardEventHandler<HTMLInputElement>');
    expect(searchFilter).toContain('ref={inputRef}');
    expect(searchFilter).toContain('onKeyDown={onInputKeyDown}');
    expect(searchFilter).toContain('showTooltips?: boolean');

    expect(styles).toContain('.floating-row-identity');
    expect(styles).toContain('.floating-row-name');
    expect(styles).toContain('.floating-row-content');
    expect(styles.match(/\.floating-row\s*\{[^}]+height: 46px;[^}]+min-height: 46px;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.floating-row-content\s*\{[^}]+text-overflow: ellipsis;[^}]+white-space: nowrap;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles).not.toContain('.floating-preview');
  });

  it('uses fixed usage sorting without restoring a dedicated sort menu', () => {
    const component = readFileSync('desktop/renderer/components/FloatingPanel.tsx', 'utf8');
    const sortLogic = readFileSync('desktop/renderer/spellSort.ts', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const i18n = readFileSync('desktop/renderer/i18n.ts', 'utf8');

    expect(component).not.toContain('SpellSortMenu');
    expect(component).toContain("sortSpells(filtered, 'usage', 'desc'");
    expect(existsSync('desktop/renderer/components/SpellSortMenu.tsx')).toBe(false);
    expect(styles).not.toContain('.sort-menu-');
    expect(styles).not.toContain('.sort-direction-');
    expect(styles).not.toContain('.floating-search-row');
    expect(styles).not.toContain('.floating-search {');
    expect(i18n).not.toContain('floating.sort.');
    expect(sortLogic).not.toContain('SPELL_SORT_OPTIONS');
    expect(sortLogic).not.toContain("'created'");
  });

  it('adds draggable chrome and remembers the floating window pin preference', () => {
    const main = readFileSync('desktop/main/index.ts', 'utf8');
    const settings = readFileSync('desktop/shared/settings.ts', 'utf8');
    const settingsService = readFileSync('desktop/main/services/settingsService.ts', 'utf8');
    const preload = readFileSync('desktop/main/preload.ts', 'utf8');
    const globals = readFileSync('desktop/renderer/global.d.ts', 'utf8');
    const component = readFileSync('desktop/renderer/components/FloatingPanel.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(main).toContain('let floatingWindowPinned = false');
    expect(main).toContain('alwaysOnTop: floatingWindowPinned');
    expect(main).toContain("floatingWindow.on('blur'");
    expect(main).toContain('if (!floatingWindowPinned)');
    expect(main).toContain('event.sender === floatingWindow.webContents');
    expect(main).toContain("ipcMain.handle('floating:getState'");
    expect(main).toContain("ipcMain.handle('floating:setPinned'");
    expect(main).toContain('floatingWindow?.setAlwaysOnTop(pinned)');
    expect(main).toContain('floatingWindowPinned = settingsService.getSettings().quickPanelPinned');
    expect(main).toContain('await settingsService.updateSettings({ quickPanelPinned: pinned });');
    expect(main).not.toContain('setFloatingWindowPinned(false)');
    expect(settings).toContain('quickPanelPinned: boolean;');
    expect(settings).toContain('quickPanelPinned: false');
    expect(settingsService).toContain("quickPanelPinned: normalizePinned(values.get('quickPanelPinned'))");
    expect(settingsService).toContain("writeSetting(db, 'quickPanelPinned', String(next.quickPanelPinned), now)");

    expect(preload).toContain("ipcRenderer.invoke('floating:getState')");
    expect(preload).toContain("ipcRenderer.invoke('floating:setPinned', pinned)");
    expect(globals).toContain('getFloatingWindowState(): Promise<FloatingWindowState>');
    expect(globals).toContain('setFloatingWindowPinned(pinned: boolean): Promise<FloatingWindowState>');

    expect(component).toContain('className="floating-titlebar"');
    expect(component).toContain('aria-pressed={isPinned}');
    expect(component).toContain('<Pin');
    expect(component).toContain('<X');
    expect(component).toContain('const syncFloatingWindowState = useCallback');
    expect(component).toContain('void syncFloatingWindowState();');
    expect(styles.match(/\.floating-titlebar\s*\{[^}]+-webkit-app-region: drag;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.floating-titlebar-controls\s*\{[^}]+-webkit-app-region: no-drag;[^}]+\}/s)?.[0]).toBeTruthy();
  });
});
