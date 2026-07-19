import type { ScanSourceConfig, SkillPlatform } from './types';

export type AppLanguage = 'system' | 'zh' | 'en';
export type ShortcutAccelerator = string;
export type ShortcutPlatform = 'win32' | 'darwin';
export type QuickPanelPlacement = 'center' | 'mouse';

export interface AppSettings {
  language: AppLanguage;
  quickPanelShortcut: ShortcutAccelerator;
  quickPanelPlacement: QuickPanelPlacement;
  quickPanelPinned: boolean;
  recommendationPanelOpen: boolean;
  scanSources: ScanSourceConfig[];
}

export type AppSettingsPatch = Partial<Omit<AppSettings, 'quickPanelShortcut'>>;

export interface SettingsUpdateResult {
  settings: AppSettings;
}

export interface ShortcutDefinition {
  display: string;
  accelerator: ShortcutAccelerator;
}

export interface ShortcutKeycap {
  key: string;
  label: string;
  spokenLabel: string;
}

export interface ShortcutKeyInput {
  key: string;
  code?: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

export type QuickPanelShortcutStatus = 'active' | 'fallback' | 'disabled';
export type QuickPanelShortcutStartupNotice =
  | 'custom_unavailable_fallback_applied'
  | 'fallback_persist_failed'
  | 'all_shortcuts_unavailable';

export interface QuickPanelShortcutState {
  platform: ShortcutPlatform;
  configuredAccelerator: ShortcutAccelerator;
  activeAccelerator: ShortcutAccelerator | null;
  status: QuickPanelShortcutStatus;
  captureActive: boolean;
  startupNotice: QuickPanelShortcutStartupNotice | null;
}

export type ShortcutUpdateRequest =
  | { intent: 'set'; accelerator: ShortcutAccelerator }
  | { intent: 'reset' };

export type ShortcutUpdateResult =
  | {
      ok: true;
      change: 'updated' | 'reset' | 'unchanged';
      state: QuickPanelShortcutState;
    }
  | {
      ok: false;
      error: 'invalid' | 'conflict' | 'persist_failed' | 'busy' | 'recovery_failed';
      state: QuickPanelShortcutState;
    };

export type ShortcutCaptureResult =
  | { ok: true; sessionToken: string; state: QuickPanelShortcutState }
  | { ok: false; error: 'busy' | 'failed'; state: QuickPanelShortcutState };

export interface SettingsInfo {
  databasePath: string;
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

const MODIFIER_ORDER = [
  'CommandOrControl',
  'Command',
  'Control',
  'Alt',
  'Shift'
] as const;
type ShortcutModifier = (typeof MODIFIER_ORDER)[number];

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === 'system' || value === 'zh' || value === 'en';
}

export function isQuickPanelPlacement(value: unknown): value is QuickPanelPlacement {
  return value === 'center' || value === 'mouse';
}

export function isShortcutAccelerator(
  value: unknown,
  platform?: ShortcutPlatform
): value is ShortcutAccelerator {
  return normalizeShortcutAccelerator(value, platform) !== null;
}

export function normalizeShortcutAccelerator(
  value: unknown,
  platform?: ShortcutPlatform
): ShortcutAccelerator | null {
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
    const modifier = normalizeModifier(token, platform);
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

  if (!mainKey || !hasRequiredModifier(modifiers, platform)) {
    return null;
  }
  if (platform === 'win32' && modifiers.has('Command')) {
    return null;
  }

  return [...MODIFIER_ORDER.filter((modifier) => modifiers.has(modifier)), mainKey].join('+');
}

export function getShortcutDefinition(
  accelerator: unknown,
  platform: ShortcutPlatform = 'win32'
): ShortcutDefinition {
  const normalized =
    normalizeShortcutAccelerator(accelerator, platform) ?? DEFAULT_QUICK_PANEL_SHORTCUT;
  return {
    accelerator: normalized,
    display: formatShortcutDisplay(normalized, platform)
  };
}

export function getShortcutKeycaps(
  accelerator: unknown,
  platform: ShortcutPlatform
): ShortcutKeycap[] {
  const normalized =
    normalizeShortcutAccelerator(accelerator, platform) ?? DEFAULT_QUICK_PANEL_SHORTCUT;
  return normalized.split('+').map((token) => shortcutKeycap(token, platform));
}

export function formatShortcutDisplay(
  accelerator: unknown,
  platform: ShortcutPlatform = 'win32'
): string {
  return getShortcutKeycaps(accelerator, platform)
    .map((keycap) => keycap.label)
    .join(' ');
}

export function getShortcutAccessibleText(
  accelerator: unknown,
  platform: ShortcutPlatform
): string {
  return getShortcutKeycaps(accelerator, platform)
    .map((keycap) => keycap.spokenLabel)
    .join(' + ');
}

export function shortcutFromKeyInput(
  input: ShortcutKeyInput,
  platform: ShortcutPlatform = 'win32'
): ShortcutDefinition | null {
  const mainKey = normalizeKeyInputMainKey(input);
  if (!mainKey) {
    return null;
  }

  const modifiers: ShortcutModifier[] = [];
  if (platform === 'win32') {
    if (input.metaKey) {
      return null;
    }
    if (input.ctrlKey) {
      modifiers.push('CommandOrControl');
    }
  } else {
    if (input.metaKey) {
      modifiers.push('Command');
    }
    if (input.ctrlKey) {
      modifiers.push('Control');
    }
  }
  if (input.altKey) {
    modifiers.push('Alt');
  }
  if (input.shiftKey) {
    modifiers.push('Shift');
  }
  if (!hasRequiredModifier(new Set(modifiers), platform)) {
    return null;
  }

  return getShortcutDefinition([...modifiers, mainKey].join('+'), platform);
}

function hasRequiredModifier(
  modifiers: ReadonlySet<ShortcutModifier>,
  platform?: ShortcutPlatform
): boolean {
  if (platform === 'win32') {
    return modifiers.has('CommandOrControl') || modifiers.has('Control') || modifiers.has('Alt');
  }
  if (platform === 'darwin') {
    return (
      modifiers.has('CommandOrControl') ||
      modifiers.has('Command') ||
      modifiers.has('Control') ||
      modifiers.has('Alt')
    );
  }
  return MODIFIER_ORDER.some(
    (modifier) => modifier !== 'Shift' && modifiers.has(modifier)
  );
}

function normalizeModifier(
  token: string,
  platform?: ShortcutPlatform
): ShortcutModifier | null {
  const normalized = token.toLowerCase();
  if (normalized === 'commandorcontrol' || normalized === 'cmdorctrl') {
    return 'CommandOrControl';
  }
  if (normalized === 'ctrl' || normalized === 'control') {
    return platform === 'win32' ? 'CommandOrControl' : 'Control';
  }
  if (normalized === 'cmd' || normalized === 'command' || normalized === 'meta') {
    return 'Command';
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

function shortcutKeycap(token: string, platform: ShortcutPlatform): ShortcutKeycap {
  if (token === 'CommandOrControl') {
    return platform === 'darwin'
      ? { key: token, label: '⌘', spokenLabel: 'Command' }
      : { key: token, label: 'Ctrl', spokenLabel: 'Control' };
  }
  if (token === 'Command') {
    return { key: token, label: platform === 'darwin' ? '⌘' : 'Command', spokenLabel: 'Command' };
  }
  if (token === 'Control') {
    return { key: token, label: platform === 'darwin' ? '⌃' : 'Ctrl', spokenLabel: 'Control' };
  }
  if (token === 'Alt') {
    return {
      key: token,
      label: platform === 'darwin' ? '⌥' : 'Alt',
      spokenLabel: platform === 'darwin' ? 'Option' : 'Alt'
    };
  }
  if (token === 'Shift') {
    return {
      key: token,
      label: platform === 'darwin' ? '⇧' : 'Shift',
      spokenLabel: 'Shift'
    };
  }
  return { key: token, label: displayMainKey(token), spokenLabel: spokenMainKey(token) };
}

function displayMainKey(token: string): string {
  const displayNames: Record<string, string> = {
    Space: 'Space',
    PageUp: 'Page Up',
    PageDown: 'Page Down',
    Up: '↑',
    Down: '↓',
    Left: '←',
    Right: '→'
  };
  return displayNames[token] ?? token;
}

function spokenMainKey(token: string): string {
  const spokenNames: Record<string, string> = {
    Up: 'Arrow Up',
    Down: 'Arrow Down',
    Left: 'Arrow Left',
    Right: 'Arrow Right',
    PageUp: 'Page Up',
    PageDown: 'Page Down'
  };
  return spokenNames[token] ?? token;
}
