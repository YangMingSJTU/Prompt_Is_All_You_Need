import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../desktop/main/services/database';
import { createSettingsService, defaultScanSources } from '../desktop/main/services/settingsService';
import { DEFAULT_APP_SETTINGS } from '../desktop/shared/settings';

describe('settings service', () => {
  it('returns default settings when nothing is saved', async () => {
    const db = await createTestDatabase();
    const service = createSettingsService(db);

    expect(service.getSettings()).toEqual({
      ...DEFAULT_APP_SETTINGS,
      scanSources: defaultScanSources()
    });
  });

  it('persists valid setting updates', async () => {
    const db = await createTestDatabase();
    const service = createSettingsService(db);

    await service.updateSettings({
      language: 'en',
      quickPanelShortcut: 'CommandOrControl+Alt+K',
      quickPanelPlacement: 'mouse',
      quickPanelPinned: true,
      recommendationPanelOpen: false
    });

    expect(createSettingsService(db).getSettings()).toEqual({
      language: 'en',
      quickPanelShortcut: 'CommandOrControl+Alt+K',
      quickPanelPlacement: 'mouse',
      quickPanelPinned: true,
      recommendationPanelOpen: false,
      scanSources: defaultScanSources()
    });

    await service.updateSettings({ quickPanelPinned: false });

    expect(createSettingsService(db).getSettings().quickPanelPinned).toBe(false);
    expect(createSettingsService(db).getSettings().recommendationPanelOpen).toBe(false);
  });

  it('loads legacy shortcut ids as accelerators', async () => {
    const db = await createTestDatabase();
    db.run(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
      ['quickPanelShortcut', 'ctrl-alt-p', '2026-07-07T00:00:00.000Z']
    );

    expect(createSettingsService(db).getSettings().quickPanelShortcut).toBe('CommandOrControl+Alt+P');
  });

  it('falls back to defaults for invalid stored values', async () => {
    const db = await createTestDatabase();
    db.run(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?), (?, ?, ?), (?, ?, ?)',
      [
        'language',
        'fr',
        '2026-07-07T00:00:00.000Z',
        'quickPanelShortcut',
        'ctrl-k',
        '2026-07-07T00:00:00.000Z',
        'quickPanelPlacement',
        'corner',
        '2026-07-07T00:00:00.000Z'
      ]
    );

    expect(createSettingsService(db).getSettings()).toEqual({
      ...DEFAULT_APP_SETTINGS,
      scanSources: defaultScanSources()
    });
  });
});
