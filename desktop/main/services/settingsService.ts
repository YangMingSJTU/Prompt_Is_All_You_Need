import type { AppDatabase } from './database';
import {
  DEFAULT_APP_SETTINGS,
  type AppLanguage,
  type AppSettings,
  isAppLanguage,
  isQuickPanelPlacement,
  normalizeShortcutAccelerator,
  type QuickPanelPlacement,
  type ShortcutAccelerator
} from '../../shared/settings';

interface SettingRow {
  [key: string]: unknown;
  key: string;
  value: string;
}

export interface SettingsService {
  getSettings(): AppSettings;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
}

export function createSettingsService(db: AppDatabase): SettingsService {
  return {
    getSettings() {
      const rows = db.all<SettingRow>('SELECT key, value FROM app_settings');
      const values = new Map(rows.map((row) => [row.key, row.value]));
      return {
        language: normalizeLanguage(values.get('language')),
        quickPanelShortcut: normalizeShortcut(values.get('quickPanelShortcut')),
        quickPanelPlacement: normalizePlacement(values.get('quickPanelPlacement'))
      };
    },
    async updateSettings(patch) {
      const current = this.getSettings();
      const next: AppSettings = {
        language:
          patch.language === undefined
            ? current.language
            : normalizeLanguage(patch.language),
        quickPanelShortcut:
          patch.quickPanelShortcut === undefined
            ? current.quickPanelShortcut
            : normalizeShortcut(patch.quickPanelShortcut),
        quickPanelPlacement:
          patch.quickPanelPlacement === undefined
            ? current.quickPanelPlacement
            : normalizePlacement(patch.quickPanelPlacement)
      };
      const now = new Date().toISOString();
      writeSetting(db, 'language', next.language, now);
      writeSetting(db, 'quickPanelShortcut', next.quickPanelShortcut, now);
      writeSetting(db, 'quickPanelPlacement', next.quickPanelPlacement, now);
      await db.save();
      return next;
    }
  };
}

function normalizeLanguage(value: unknown): AppLanguage {
  return isAppLanguage(value) ? value : DEFAULT_APP_SETTINGS.language;
}

function normalizeShortcut(value: unknown): ShortcutAccelerator {
  return normalizeShortcutAccelerator(value) ?? DEFAULT_APP_SETTINGS.quickPanelShortcut;
}

function normalizePlacement(value: unknown): QuickPanelPlacement {
  return isQuickPanelPlacement(value) ? value : DEFAULT_APP_SETTINGS.quickPanelPlacement;
}

function writeSetting(db: AppDatabase, key: keyof AppSettings, value: string, updatedAt: string): void {
  db.run(
    `
      INSERT INTO app_settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
    [key, value, updatedAt]
  );
}
