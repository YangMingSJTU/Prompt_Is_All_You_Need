import { readFileSync } from 'node:fs';
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

  it('uses a smaller floating panel that lists spell names and previews the selected body', () => {
    const main = readFileSync('desktop/main/index.ts', 'utf8');
    const component = readFileSync('desktop/renderer/components/FloatingPanel.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(main).toContain('width: 420');
    expect(main).toContain('height: 320');
    expect(main).toContain('minWidth: 380');
    expect(main).toContain('minHeight: 280');
    expect(main).toContain('maxWidth: 460');
    expect(main).toContain('maxHeight: 360');

    expect(component).toContain('listSpells()');
    expect(component).toContain('sorted.slice(0, 5)');
    expect(component).toContain('deriveSpellName');
    expect(component).toContain('getFloatingSpellName');
    expect(component).toContain('floating-row-name');
    expect(component).toContain('floating-preview');
    expect(component).toContain('getSpellDisplayText(selected)');
    expect(component).not.toContain('<span className="spell-result-text">{getSpellDisplayText(spell)}</span>');

    expect(styles).toContain('.floating-preview');
    expect(styles).toContain('.floating-row-name');
    expect(styles.match(/\.floating-preview\s*\{[^}]+max-height: 112px;[^}]+overflow: auto;[^}]+\}/s)?.[0]).toBeTruthy();
  });

  it('provides a compact sort control for quick panel spell ordering', () => {
    const component = readFileSync('desktop/renderer/components/FloatingPanel.tsx', 'utf8');
    const sortMenu = readFileSync('desktop/renderer/components/SpellSortMenu.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const i18n = readFileSync('desktop/renderer/i18n.ts', 'utf8');

    expect(component).toContain('SpellSortMenu');
    expect(component).toContain('sortSpells');
    expect(component).toContain('variant="icon"');
    expect(component).not.toContain('<select');
    expect(component).not.toContain('className="floating-sort"');

    expect(sortMenu).toContain('ArrowUpDown');
    expect(sortMenu).toContain('role="menu"');
    expect(sortMenu).toContain('role="menuitemradio"');
    expect(sortMenu).toContain('sort-direction-group');
    expect(sortMenu).toContain('onDirectionChange');
    expect(sortMenu).toContain('aria-checked');
    expect(sortMenu).toContain('Check');

    expect(styles).toContain('.floating-search-row');
    expect(styles).toContain('.sort-menu-root');
    expect(styles).toContain('.sort-menu-button');
    expect(styles).toContain('.sort-menu-popover');
    expect(styles).toContain('.sort-menu-option');
    expect(styles).not.toContain('.floating-sort {');

    expect(i18n).toContain("'floating.sort.usage': '施法次数'");
    expect(i18n).toContain("'floating.sort.created': '创建时间'");
    expect(i18n).toContain("'floating.sort.updated': '更新时间'");
    expect(i18n).toContain("'floating.sort.name': '名称'");
    expect(i18n).toContain("'floating.sort.direction.asc': '正序'");
    expect(i18n).toContain("'floating.sort.direction.desc': '倒序'");
    expect(i18n).not.toContain('nameLength');
  });
});
