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
import type { ScanProvider, ScanSourceConfig, ScanTarget } from '../../shared/types';
import {
  isAbsolutePlatformPath,
  type PlatformPathContext,
  type PlatformPaths
} from './platformPaths';

interface SettingRow {
  [key: string]: unknown;
  key: string;
  value: string;
}

export interface SettingsService {
  getSettings(): AppSettings;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
}

export interface SettingsServiceOptions {
  defaultScanSources: ScanSourceConfig[];
  pathContext: PlatformPathContext;
}

export function createSettingsService(
  db: AppDatabase,
  options: SettingsServiceOptions
): SettingsService {
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
        scanSources: normalizeScanSources(values.get('scanSources'), options)
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
            : normalizeScanSources(patch.scanSources, options)
      };
      const now = new Date().toISOString();
      writeSetting(db, 'language', next.language, now);
      writeSetting(db, 'quickPanelShortcut', next.quickPanelShortcut, now);
      writeSetting(db, 'quickPanelPlacement', next.quickPanelPlacement, now);
      writeSetting(db, 'quickPanelPinned', String(next.quickPanelPinned), now);
      writeSetting(db, 'recommendationPanelOpen', String(next.recommendationPanelOpen), now);
      writeSetting(db, 'scanSources', JSON.stringify(next.scanSources), now);
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

export function defaultScanSources(
  paths: Pick<PlatformPaths, 'historyRoots'>
): ScanSourceConfig[] {
  return paths.historyRoots.map((root) => ({
    provider: root.sourceTool,
    target: 'spells',
    path: root.path,
    enabled: true
  }));
}

function normalizeScanSources(
  value: unknown,
  options: SettingsServiceOptions
): ScanSourceConfig[] {
  const parsed = typeof value === 'string' ? parseJson(value) : value;
  const defaults = options.defaultScanSources;
  if (!Array.isArray(parsed)) {
    return defaults;
  }

  const byKey = new Map(
    defaults.map((source) => [scanSourceKey(source.provider, source.target), source])
  );
  for (const item of parsed) {
    if (!isScanSourceConfig(item) || !isAbsolutePlatformPath(item.path, options.pathContext)) {
      continue;
    }
    const key = scanSourceKey(item.provider, item.target);
    if (!byKey.has(key)) {
      continue;
    }
    byKey.set(key, {
      provider: item.provider,
      target: item.target,
      path: item.path.trim(),
      enabled: item.enabled
    });
  }
  return defaults.map(
    (source) => byKey.get(scanSourceKey(source.provider, source.target)) ?? source
  );
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
  return value === 'spells';
}

export function areScanSourcesValid(
  value: unknown,
  pathContext: PlatformPathContext
): value is ScanSourceConfig[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) => isScanSourceConfig(item) && isAbsolutePlatformPath(item.path, pathContext)
    )
  );
}

function scanSourceKey(provider: ScanProvider, target: ScanTarget): string {
  return `${provider}:${target}`;
}

function writeSetting(
  db: AppDatabase,
  key: keyof AppSettings,
  value: string,
  updatedAt: string
): void {
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
