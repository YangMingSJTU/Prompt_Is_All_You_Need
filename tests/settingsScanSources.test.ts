import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../desktop/main/services/database';
import { createSettingsService } from '../desktop/main/services/settingsService';

describe('settings scan source configuration', () => {
  it('provides editable default scan sources for spells and skills', () => {
    const dbPromise = createTestDatabase();

    return dbPromise.then((db) => {
      const service = createSettingsService(db);
      const settings = service.getSettings();
      const home = homedir();

      expect(settings.scanSources).toEqual([
        { provider: 'claude', target: 'spells', path: join(home, '.claude'), enabled: true },
        { provider: 'codex', target: 'spells', path: join(home, '.codex'), enabled: true },
        { provider: 'claude', target: 'skills', path: join(home, '.claude', 'skills'), enabled: true },
        { provider: 'codex', target: 'skills', path: join(home, '.agents', 'skills'), enabled: true }
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
});
