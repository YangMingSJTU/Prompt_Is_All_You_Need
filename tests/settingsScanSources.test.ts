import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../desktop/main/services/database';
import {
  createPlatformPathContext,
  createPlatformPaths
} from '../desktop/main/services/platformPaths';
import {
  createSettingsService,
  defaultScanSources
} from '../desktop/main/services/settingsService';

const PLATFORM_PATHS = createPlatformPaths({
  platform: 'win32',
  homeDirectory: 'C:\\Users\\Test',
  userDataDirectory: 'C:\\Users\\Test\\AppData\\Roaming\\Spellbook'
});
const OPTIONS = {
  defaultScanSources: defaultScanSources(PLATFORM_PATHS),
  pathContext: createPlatformPathContext('win32')
};

describe('settings scan source configuration', () => {
  it('provides editable default scan sources only for spell history', async () => {
    const db = await createTestDatabase();
    const settings = createSettingsService(db, OPTIONS).getSettings();

    expect(settings.scanSources).toEqual([
      { provider: 'claude', target: 'spells', path: 'C:\\Users\\Test\\.claude', enabled: true },
      { provider: 'codex', target: 'spells', path: 'C:\\Users\\Test\\.codex', enabled: true }
    ]);
  });

  it('persists customized scan source paths', async () => {
    const db = await createTestDatabase();
    const service = createSettingsService(db, OPTIONS);
    const [first, ...rest] = service.getSettings().scanSources;

    await service.updateSettings({
      scanSources: [{ ...first, path: 'D:\\Custom\\Claude' }, ...rest]
    });

    expect(service.getSettings().scanSources[0].path).toBe('D:\\Custom\\Claude');
  });

  it('filters legacy skill scan sources from persisted settings', async () => {
    const db = await createTestDatabase();
    db.run(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
      [
        'scanSources',
        JSON.stringify([
          { provider: 'claude', target: 'spells', path: 'D:\\History', enabled: true },
          { provider: 'codex', target: 'skills', path: 'D:\\Skills', enabled: true }
        ]),
        '2026-07-15T00:00:00.000Z'
      ]
    );

    expect(createSettingsService(db, OPTIONS).getSettings().scanSources).toEqual([
      { provider: 'claude', target: 'spells', path: 'D:\\History', enabled: true },
      expect.objectContaining({ provider: 'codex', target: 'spells' })
    ]);
  });

  it('rejects relative and other-platform persisted paths', async () => {
    const db = await createTestDatabase();
    db.run(
      'INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)',
      [
        'scanSources',
        JSON.stringify([
          { provider: 'claude', target: 'spells', path: '../history', enabled: true },
          { provider: 'codex', target: 'spells', path: '/Users/test/.codex', enabled: true }
        ]),
        '2026-07-19T00:00:00.000Z'
      ]
    );

    expect(createSettingsService(db, OPTIONS).getSettings().scanSources).toEqual(
      OPTIONS.defaultScanSources
    );
  });
});
