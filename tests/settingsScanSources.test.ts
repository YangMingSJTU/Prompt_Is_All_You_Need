import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../desktop/main/services/database';
import { createSettingsService } from '../desktop/main/services/settingsService';

describe('settings scan source configuration', () => {
  it('provides editable default scan sources only for spell history', () => {
    const dbPromise = createTestDatabase();

    return dbPromise.then((db) => {
      const service = createSettingsService(db);
      const settings = service.getSettings();
      const home = homedir();

      expect(settings.scanSources).toEqual([
        { provider: 'claude', target: 'spells', path: join(home, '.claude'), enabled: true },
        { provider: 'codex', target: 'spells', path: join(home, '.codex'), enabled: true }
      ]);
    });
  });

  it('persists customized scan source paths', async () => {
    const db = await createTestDatabase();
    const service = createSettingsService(db);
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

    expect(createSettingsService(db).getSettings().scanSources).toEqual([
      { provider: 'claude', target: 'spells', path: 'D:\\History', enabled: true },
      expect.objectContaining({ provider: 'codex', target: 'spells' })
    ]);
  });
});
