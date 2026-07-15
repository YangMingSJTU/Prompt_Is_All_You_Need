import type { ScanSourceConfig, SkillPlatform } from './types';

export type AppLanguage = 'system' | 'zh' | 'en';

export type ShortcutAccelerator = string;

export type QuickPanelPlacement = 'center' | 'mouse';

export interface AppSettings {
  language: AppLanguage;
  quickPanelShortcut: ShortcutAccelerator;
  quickPanelPlacement: QuickPanelPlacement;
  quickPanelPinned: boolean;
  recommendationPanelOpen: boolean;
  scanSources: ScanSourceConfig[];
}

export interface SettingsUpdateResult {
  settings: AppSettings;
  warning?: string;
}

export interface ShortcutDefinition {
  display: string;
  accelerator: ShortcutAccelerator;
}

export interface ShortcutKeyInput {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

export interface SettingsInfo {
  defaultScanSources: ScanSourceConfig[];
  historyRoots: Array<{ sourceTool: 'claude' | 'codex'; path: string }>;
  skillRoots: Array<{ platform: SkillPlatform; path: string }>;
}

export const DEFAULT_QUICK_PANEL_SHORTCUT = 'CommandOrControl+Shift+Space';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  language: 'system',
  quickPanelShortcut: DEFAULT_QUICK_PANEL_SHORTCUT,
  quickPanelPlacement: 'center',
  quickPanelPinned: false,
  recommendationPanelOpen: true,
  scanSources: []
};

const LEGACY_SHORTCUTS: Record<string, ShortcutAccelerator> = {
  'ctrl-shift-space': 'CommandOrControl+Shift+Space',
  'ctrl-alt-space': 'CommandOrControl+Alt+Space',
  'ctrl-shift-p': 'CommandOrControl+Shift+P',
  'ctrl-alt-p': 'CommandOrControl+Alt+P'
};

const MODIFIER_ORDER = ['CommandOrControl', 'Alt', 'Shift'] as const;
type ShortcutModifier = (typeof MODIFIER_ORDER)[number];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'system' || value === 'zh' || value === 'en';
}

export function isQuickPanelPlacement(value: unknown): value is QuickPanelPlacement {
  return value === 'center' || value === 'mouse';
}

export function isShortcutAccelerator(value: unknown): value is ShortcutAccelerator {
  return normalizeShortcutAccelerator(value) !== null;
}

export function normalizeShortcutAccelerator(value: unknown): ShortcutAccelerator | null {
  if (typeof value !== 'string') {
    return null;
  }
  const raw = value.trim();
  if (!raw) {
    return null;
  }
  const legacy = LEGACY_SHORTCUTS[raw.toLowerCase()];
  if (legacy) {
    return legacy;
  }

  const modifiers = new Set<ShortcutModifier>();
  let mainKey: string | null = null;
  for (const token of raw.split(/[+\s]+/).filter(Boolean)) {
    const modifier = normalizeModifier(token);
    if (modifier) {
      modifiers.add(modifier);
      continue;
    }
    const key = normalizeMainKey(token);
    if (!key || mainKey) {
      return null;
    }
    mainKey = key;
  }

  if (!mainKey || (!modifiers.has('CommandOrControl') && !modifiers.has('Alt'))) {
    return null;
  }

  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), mainKey].join('+');
}

export function getShortcutDefinition(accelerator: unknown): ShortcutDefinition {
  const normalized = normalizeShortcutAccelerator(accelerator) ?? DEFAULT_QUICK_PANEL_SHORTCUT;
  return {
    accelerator: normalized,
    display: formatShortcutDisplay(normalized)
  };
}

export function formatShortcutDisplay(accelerator: unknown): string {
  const normalized = normalizeShortcutAccelerator(accelerator) ?? DEFAULT_QUICK_PANEL_SHORTCUT;
  return normalized
    .split('+')
    .map((token) => {
      if (token === 'CommandOrControl') {
        return 'Ctrl';
      }
      return displayMainKey(token);
    })
    .join(' ');
}

export function shortcutFromKeyInput(input: ShortcutKeyInput): ShortcutDefinition | null {
  const mainKey = normalizeKeyInputMainKey(input);
  if (!mainKey) {
    return null;
  }

  const modifiers: ShortcutModifier[] = [];
  if (input.ctrlKey || input.metaKey) {
    modifiers.push('CommandOrControl');
  }
  if (input.altKey) {
    modifiers.push('Alt');
  }
  if (input.shiftKey) {
    modifiers.push('Shift');
  }
  if (!modifiers.includes('CommandOrControl') && !modifiers.includes('Alt')) {
    return null;
  }

  return getShortcutDefinition([...modifiers, mainKey].join('+'));
}

function normalizeModifier(token: string): ShortcutModifier | null {
  const normalized = token.toLowerCase();
  if (
    normalized === 'ctrl' ||
    normalized === 'control' ||
    normalized === 'cmd' ||
    normalized === 'command' ||
    normalized === 'meta' ||
    normalized === 'commandorcontrol' ||
    normalized === 'cmdorctrl'
  ) {
    return 'CommandOrControl';
  }
  if (normalized === 'alt' || normalized === 'option') {
    return 'Alt';
  }
  if (normalized === 'shift') {
    return 'Shift';
  }
  return null;
}

function normalizeKeyInputMainKey(input: ShortcutKeyInput): string | null {
  if (input.code === 'Space' || input.key === ' ') {
    return 'Space';
  }
  return normalizeMainKey(input.key);
}

function normalizeMainKey(token: string): string | null {
  const normalized = token.trim();
  if (!normalized || normalizeModifier(normalized)) {
    return null;
  }
  if (/^[a-z]$/i.test(normalized)) {
    return normalized.toUpperCase();
  }
  if (/^[0-9]$/.test(normalized)) {
    return normalized;
  }
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(normalized)) {
    return normalized.toUpperCase();
  }

  const namedKeys: Record<string, string> = {
    ' ': 'Space',
    space: 'Space',
    spacebar: 'Space',
    enter: 'Enter',
    return: 'Enter',
    tab: 'Tab',
    backspace: 'Backspace',
    delete: 'Delete',
    del: 'Delete',
    insert: 'Insert',
    ins: 'Insert',
    home: 'Home',
    end: 'End',
    pageup: 'PageUp',
    pagedown: 'PageDown',
    escape: 'Escape',
    esc: 'Escape',
    arrowup: 'Up',
    up: 'Up',
    arrowdown: 'Down',
    down: 'Down',
    arrowleft: 'Left',
    left: 'Left',
    arrowright: 'Right',
    right: 'Right',
    plus: 'Plus',
    '+': 'Plus',
    minus: 'Minus',
    '-': 'Minus',
    comma: 'Comma',
    ',': 'Comma',
    period: 'Period',
    '.': 'Period',
    slash: 'Slash',
    '/': 'Slash',
    backslash: 'Backslash',
    '\\': 'Backslash'
  };
  return namedKeys[normalized.toLowerCase()] ?? null;
}

function displayMainKey(token: string): string {
  const displayNames: Record<string, string> = {
    Space: 'Space',
    PageUp: 'Page Up',
    PageDown: 'Page Down',
    Up: 'Arrow Up',
    Down: 'Arrow Down',
    Left: 'Arrow Left',
    Right: 'Arrow Right'
  };
  return displayNames[token] ?? token;
}
