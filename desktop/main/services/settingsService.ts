import { homedir } from 'node:os';
import { join } from 'node:path';
import type { AppDatabase } from './database';
import {
  DEFAULT_APP_SETTINGS,
  type AppLanguage,
  type AppSettings,
  type AppSettingsPatch,
  isAppLanguage,
  isQuickPanelPlacement,
  normalizeShortcutAccelerator,
  type QuickPanelPlacement,
  type ShortcutAccelerator
} from '../../shared/settings';
import type { ScanProvider, ScanSourceConfig, ScanTarget } from '../../shared/types';

interface SettingRow {
  [key: string]: unknown;
  key: string;
  value: string;
}

export interface SettingsService {
  getSettings(): AppSettings;
  updateSettings(patch: AppSettingsPatch): Promise<AppSettings>;
  updateQuickPanelShortcut(shortcut: ShortcutAccelerator): Promise<AppSettings>;
}

export function createSettingsService(db: AppDatabase): SettingsService {
  return {
    getSettings() {
      const rows = db.all<SettingRow>('SELECT key, value FROM app_settings');
      const values = new Map(rows.map((row) => [row.key, row.value]));
      return {
        language: normalizeLanguage(values.get('language')),
        quickPanelShortcut: normalizeShortcut(values.get('quickPanelShortcut')),
        quickPanelPlacement: normalizePlacement(values.get('quickPanelPlacement')),
        quickPanelPinned: normalizePinned(values.get('quickPanelPinned')),
        recommendationPanelOpen: normalizeRecommendationPanelOpen(
          values.get('recommendationPanelOpen')
        ),
        scanSources: normalizeScanSources(values.get('scanSources'))
      };
    },
    async updateSettings(patch) {
      if ('quickPanelShortcut' in (patch as Record<string, unknown>)) {
        throw new Error('quickPanelShortcut must be updated through the shortcut controller');
      }
      return db.transaction(() => {
        const current = this.getSettings();
        const next: AppSettings = {
          language:
            patch.language === undefined
              ? current.language
              : normalizeLanguage(patch.language),
          quickPanelShortcut: current.quickPanelShortcut,
          quickPanelPlacement:
            patch.quickPanelPlacement === undefined
              ? current.quickPanelPlacement
              : normalizePlacement(patch.quickPanelPlacement),
          quickPanelPinned:
            patch.quickPanelPinned === undefined
              ? current.quickPanelPinned
              : normalizePinned(patch.quickPanelPinned),
          recommendationPanelOpen:
            patch.recommendationPanelOpen === undefined
              ? current.recommendationPanelOpen
              : normalizeRecommendationPanelOpen(patch.recommendationPanelOpen),
          scanSources:
            patch.scanSources === undefined
              ? current.scanSources
              : normalizeScanSources(patch.scanSources)
        };
        writeSettings(db, [
          ['language', next.language],
          ['quickPanelPlacement', next.quickPanelPlacement],
          ['quickPanelPinned', String(next.quickPanelPinned)],
          ['recommendationPanelOpen', String(next.recommendationPanelOpen)],
          ['scanSources', JSON.stringify(next.scanSources)]
        ]);
        return next;
      });
    },
    async updateQuickPanelShortcut(shortcut) {
      const normalized = normalizeShortcutAccelerator(shortcut);
      if (!normalized) {
        throw new Error('Invalid quick panel shortcut');
      }
      return db.transaction(() => {
        writeSettings(db, [['quickPanelShortcut', normalized]]);
        return this.getSettings();
      });
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

function normalizePinned(value: unknown): boolean {
  return normalizeBooleanSetting(value, DEFAULT_APP_SETTINGS.quickPanelPinned);
}

function normalizeRecommendationPanelOpen(value: unknown): boolean {
  return normalizeBooleanSetting(value, DEFAULT_APP_SETTINGS.recommendationPanelOpen);
}

function normalizeBooleanSetting(value: unknown, fallback: boolean): boolean {
  if (value === true || value === 'true') {
    return true;
  }
  if (value === false || value === 'false') {
    return false;
  }
  return fallback;
}

export function defaultScanSources(): ScanSourceConfig[] {
  const home = homedir();
  return [
    { provider: 'claude', target: 'spells', path: join(home, '.claude'), enabled: true },
    { provider: 'codex', target: 'spells', path: join(home, '.codex'), enabled: true },
    { provider: 'claude', target: 'skills', path: join(home, '.claude', 'skills'), enabled: true },
    { provider: 'codex', target: 'skills', path: join(home, '.agents', 'skills'), enabled: true }
  ];
}

function normalizeScanSources(value: unknown): ScanSourceConfig[] {
  const parsed = typeof value === 'string' ? parseJson(value) : value;
  const defaults = defaultScanSources();
  if (!Array.isArray(parsed)) {
    return defaults;
  }

  const byKey = new Map(defaults.map((source) => [scanSourceKey(source.provider, source.target), source]));
  for (const item of parsed) {
    if (!isScanSourceConfig(item)) {
      continue;
    }
    const key = scanSourceKey(item.provider, item.target);
    if (!byKey.has(key)) {
      continue;
    }
    byKey.set(key, {
      provider: item.provider,
      target: item.target,
      path: item.path.trim() || byKey.get(key)?.path || '',
      enabled: item.enabled
    });
  }
  return defaults.map((source) => byKey.get(scanSourceKey(source.provider, source.target)) ?? source);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function isScanSourceConfig(value: unknown): value is ScanSourceConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const source = value as Record<string, unknown>;
  return (
    isScanProvider(source.provider) &&
    isScanTarget(source.target) &&
    typeof source.path === 'string' &&
    typeof source.enabled === 'boolean'
  );
}

function isScanProvider(value: unknown): value is ScanProvider {
  return value === 'claude' || value === 'codex';
}

function isScanTarget(value: unknown): value is ScanTarget {
  return value === 'spells' || value === 'skills';
}

function scanSourceKey(provider: ScanProvider, target: ScanTarget): string {
  return `${provider}:${target}`;
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

function writeSettings(
  db: AppDatabase,
  entries: Array<[keyof AppSettings, string]>
): void {
  const now = new Date().toISOString();
  for (const [key, value] of entries) {
    writeSetting(db, key, value, now);
  }
}
