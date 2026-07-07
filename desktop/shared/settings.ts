export type AppLanguage = 'system' | 'zh' | 'en';

export type ShortcutId =
  | 'ctrl-shift-space'
  | 'ctrl-alt-space'
  | 'ctrl-shift-p'
  | 'ctrl-alt-p';

export interface AppSettings {
  language: AppLanguage;
  quickPanelShortcut: ShortcutId;
}

export interface SettingsUpdateResult {
  settings: AppSettings;
  warning?: string;
}

export interface ShortcutOption {
  id: ShortcutId;
  display: string;
  accelerator: string;
}

export interface SettingsInfo {
  databasePath: string;
  historyRoots: Array<{ sourceTool: 'claude' | 'codex'; path: string }>;
  exportTargets: Array<{ label: string; path: string }>;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  language: 'system',
  quickPanelShortcut: 'ctrl-shift-space'
};

export const SHORTCUT_OPTIONS: ShortcutOption[] = [
  {
    id: 'ctrl-shift-space',
    display: 'Ctrl Shift Space',
    accelerator: 'CommandOrControl+Shift+Space'
  },
  {
    id: 'ctrl-alt-space',
    display: 'Ctrl Alt Space',
    accelerator: 'CommandOrControl+Alt+Space'
  },
  {
    id: 'ctrl-shift-p',
    display: 'Ctrl Shift P',
    accelerator: 'CommandOrControl+Shift+P'
  },
  {
    id: 'ctrl-alt-p',
    display: 'Ctrl Alt P',
    accelerator: 'CommandOrControl+Alt+P'
  }
];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'system' || value === 'zh' || value === 'en';
}

export function isShortcutId(value: unknown): value is ShortcutId {
  return SHORTCUT_OPTIONS.some((option) => option.id === value);
}

export function getShortcutOption(id: ShortcutId): ShortcutOption {
  return SHORTCUT_OPTIONS.find((option) => option.id === id) ?? SHORTCUT_OPTIONS[0];
}
