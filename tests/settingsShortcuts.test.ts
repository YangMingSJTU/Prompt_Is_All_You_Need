import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_SETTINGS,
  formatShortcutDisplay,
  getShortcutAccessibleText,
  getShortcutKeycaps,
  isShortcutAccelerator,
  normalizeShortcutAccelerator,
  shortcutFromKeyInput
} from '../desktop/shared/settings';

describe('settings shortcuts', () => {
  it('uses platform-specific default shortcut labels and accessible text', () => {
    expect(DEFAULT_APP_SETTINGS.quickPanelShortcut).toBe('CommandOrControl+Shift+Space');
    expect(formatShortcutDisplay(DEFAULT_APP_SETTINGS.quickPanelShortcut, 'win32')).toBe(
      'Ctrl Shift Space'
    );
    expect(formatShortcutDisplay(DEFAULT_APP_SETTINGS.quickPanelShortcut, 'darwin')).toBe(
      '⌘ ⇧ Space'
    );
    expect(getShortcutAccessibleText(DEFAULT_APP_SETTINGS.quickPanelShortcut, 'darwin')).toBe(
      'Command + Shift + Space'
    );
  });

  it('normalizes legacy shortcut ids and accelerator text', () => {
    expect(normalizeShortcutAccelerator('ctrl-alt-p')).toBe('CommandOrControl+Alt+P');
    expect(normalizeShortcutAccelerator('Ctrl Shift K', 'win32')).toBe(
      'CommandOrControl+Shift+K'
    );
    expect(normalizeShortcutAccelerator('Command Shift K', 'darwin')).toBe('Command+Shift+K');
    expect(normalizeShortcutAccelerator('Control Option F12', 'darwin')).toBe(
      'Control+Alt+F12'
    );
  });

  it('builds Windows accelerators without accepting the Windows key', () => {
    expect(shortcutFromKeyInput({ key: 'k', ctrlKey: true, shiftKey: true }, 'win32')).toEqual({
      accelerator: 'CommandOrControl+Shift+K',
      display: 'Ctrl Shift K'
    });
    expect(shortcutFromKeyInput({ key: ' ', ctrlKey: true, altKey: true }, 'win32')).toEqual({
      accelerator: 'CommandOrControl+Alt+Space',
      display: 'Ctrl Alt Space'
    });
    expect(shortcutFromKeyInput({ key: 'k', metaKey: true }, 'win32')).toBeNull();
    expect(shortcutFromKeyInput({ key: 'k', ctrlKey: true, metaKey: true }, 'win32')).toBeNull();
  });

  it('keeps Command, Control, and Option distinct on macOS', () => {
    expect(shortcutFromKeyInput({ key: '7', metaKey: true, shiftKey: true }, 'darwin')).toEqual({
      accelerator: 'Command+Shift+7',
      display: '⌘ ⇧ 7'
    });
    expect(shortcutFromKeyInput({ key: 'F5', ctrlKey: true }, 'darwin')).toEqual({
      accelerator: 'Control+F5',
      display: '⌃ F5'
    });
    expect(shortcutFromKeyInput({ key: ' ', altKey: true }, 'darwin')).toEqual({
      accelerator: 'Alt+Space',
      display: '⌥ Space'
    });
    expect(getShortcutKeycaps('Command+Control+Alt+K', 'darwin').map((item) => item.label)).toEqual(
      ['⌘', '⌃', '⌥', 'K']
    );
  });

  it('rejects modifier-only, single-key, multiple-main-key, and unsupported combinations', () => {
    expect(shortcutFromKeyInput({ key: 'k' }, 'win32')).toBeNull();
    expect(shortcutFromKeyInput({ key: 'Shift', shiftKey: true }, 'win32')).toBeNull();
    expect(shortcutFromKeyInput({ key: 'Tab' }, 'win32')).toBeNull();
    expect(isShortcutAccelerator('P', 'win32')).toBe(false);
    expect(isShortcutAccelerator('Control+K+P', 'darwin')).toBe(false);
    expect(isShortcutAccelerator('CommandOrControl+Alt+P', 'win32')).toBe(true);
  });
});
