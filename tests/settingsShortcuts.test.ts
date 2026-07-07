import { describe, expect, it } from 'vitest';
import {
  DEFAULT_APP_SETTINGS,
  formatShortcutDisplay,
  isShortcutAccelerator,
  normalizeShortcutAccelerator,
  shortcutFromKeyInput
} from '../desktop/shared/settings';

describe('settings shortcuts', () => {
  it('uses a default shortcut accelerator with compact display text', () => {
    expect(DEFAULT_APP_SETTINGS.quickPanelShortcut).toBe('CommandOrControl+Shift+Space');
    expect(formatShortcutDisplay(DEFAULT_APP_SETTINGS.quickPanelShortcut)).toBe('Ctrl Shift Space');
  });

  it('normalizes legacy shortcut ids and user-entered accelerator text', () => {
    expect(normalizeShortcutAccelerator('ctrl-alt-p')).toBe('CommandOrControl+Alt+P');
    expect(normalizeShortcutAccelerator('Ctrl Shift K')).toBe('CommandOrControl+Shift+K');
    expect(normalizeShortcutAccelerator('CommandOrControl+Alt+Space')).toBe(
      'CommandOrControl+Alt+Space'
    );
  });

  it('builds a shortcut from keyboard input', () => {
    expect(shortcutFromKeyInput({ key: 'k', ctrlKey: true, shiftKey: true })).toEqual({
      accelerator: 'CommandOrControl+Shift+K',
      display: 'Ctrl Shift K'
    });
    expect(shortcutFromKeyInput({ key: ' ', ctrlKey: true, altKey: true })).toEqual({
      accelerator: 'CommandOrControl+Alt+Space',
      display: 'Ctrl Alt Space'
    });
  });

  it('rejects ambiguous global shortcuts', () => {
    expect(shortcutFromKeyInput({ key: 'k' })).toBeNull();
    expect(shortcutFromKeyInput({ key: 'Shift', shiftKey: true })).toBeNull();
    expect(isShortcutAccelerator('P')).toBe(false);
    expect(isShortcutAccelerator('CommandOrControl+Alt+P')).toBe(true);
  });
});
