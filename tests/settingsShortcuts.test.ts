import { describe, expect, it } from 'vitest';
import { getShortcutOption, SHORTCUT_OPTIONS } from '../desktop/shared/settings';

describe('settings shortcuts', () => {
  it('maps shortcut ids to Electron accelerators and display labels', () => {
    expect(getShortcutOption('ctrl-shift-space')).toMatchObject({
      accelerator: 'CommandOrControl+Shift+Space',
      display: 'Ctrl Shift Space'
    });
    expect(getShortcutOption('ctrl-alt-space')).toMatchObject({
      accelerator: 'CommandOrControl+Alt+Space',
      display: 'Ctrl Alt Space'
    });
    expect(getShortcutOption('ctrl-shift-p')).toMatchObject({
      accelerator: 'CommandOrControl+Shift+P',
      display: 'Ctrl Shift P'
    });
    expect(getShortcutOption('ctrl-alt-p')).toMatchObject({
      accelerator: 'CommandOrControl+Alt+P',
      display: 'Ctrl Alt P'
    });
  });

  it('only exposes fixed first-version shortcut choices', () => {
    expect(SHORTCUT_OPTIONS.map((option) => option.id)).toEqual([
      'ctrl-shift-space',
      'ctrl-alt-space',
      'ctrl-shift-p',
      'ctrl-alt-p'
    ]);
  });
});
