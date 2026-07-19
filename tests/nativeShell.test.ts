import { describe, expect, it, vi } from 'vitest';
import {
  applicationMenuTemplate,
  createTrayImage,
  mainWindowChromeOptions
} from '../desktop/main/services/nativeShell';

describe('native shell', () => {
  it('keeps macOS traffic lights and standard application menus', () => {
    expect(mainWindowChromeOptions('darwin', 'ignored.ico')).toEqual({
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 18 }
    });
    const template = applicationMenuTemplate('darwin', 'Spellbook');
    expect(template?.map((item) => item.label)).toEqual([
      'Spellbook',
      'Edit',
      'View',
      'Window'
    ]);
  });

  it('keeps Windows titlebar overlay and no application menu', () => {
    expect(mainWindowChromeOptions('win32', 'spellbook.ico')).toMatchObject({
      icon: 'spellbook.ico',
      titleBarStyle: 'hidden',
      titleBarOverlay: { height: 40 }
    });
    expect(applicationMenuTemplate('win32', 'Spellbook')).toBeNull();
  });

  it('builds a macOS template tray image with 1x and 2x representations', () => {
    const addRepresentation = vi.fn();
    const setTemplateImage = vi.fn();
    const resized = { toDataURL: () => 'data:image/png;base64,AA==' };
    const source = {
      isEmpty: () => false,
      resize: vi.fn(() => resized)
    };
    const output = { addRepresentation, setTemplateImage };

    expect(
      createTrayImage('darwin', 'tray.png', {
        createFromPath: () => source as never,
        createEmpty: () => output as never
      })
    ).toBe(output);
    expect(source.resize).toHaveBeenNthCalledWith(1, { width: 16, height: 16 });
    expect(source.resize).toHaveBeenNthCalledWith(2, { width: 32, height: 32 });
    expect(addRepresentation).toHaveBeenCalledTimes(2);
    expect(setTemplateImage).toHaveBeenCalledWith(true);
  });
});
