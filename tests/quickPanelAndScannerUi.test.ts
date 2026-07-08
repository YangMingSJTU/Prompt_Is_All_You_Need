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
    expect(settings).not.toContain('settings.scanSources\n                .filter');
    expect(settings).not.toContain('sourceFiles');
    expect(settings).not.toContain('source-table');
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

    expect(component).toContain('listPopularSpells(5)');
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
});
