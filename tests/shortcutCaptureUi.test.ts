import { describe, expect, it, vi } from 'vitest';
import type { TFunction } from '../desktop/renderer/i18n';
import {
  getShortcutButtonPresentation,
  restoreShortcutButtonFocus,
  type ShortcutFocusEvent
} from '../desktop/renderer/shortcutCaptureUi';
import type { QuickPanelShortcutState } from '../desktop/shared/settings';

const t = ((key: string) => key) as TFunction;
const activeState: QuickPanelShortcutState = {
  platform: 'win32',
  configuredAccelerator: 'CommandOrControl+Shift+Space',
  activeAccelerator: 'CommandOrControl+Shift+Space',
  status: 'active',
  captureActive: false,
  startupNotice: null
};

describe('shortcut capture UI behavior', () => {
  it('announces the current key before recording and recording instructions during capture', () => {
    expect(
      getShortcutButtonPresentation({
        state: activeState,
        recording: false,
        applying: false,
        candidate: null,
        modifierPreview: [],
        t
      })
    ).toMatchObject({
      phase: 'default',
      label: 'settings.shortcut.change: Control + Shift + Space'
    });
    expect(
      getShortcutButtonPresentation({
        state: { ...activeState, captureActive: true },
        recording: true,
        applying: false,
        candidate: null,
        modifierPreview: [],
        t
      })
    ).toEqual({
      phase: 'recording',
      label: 'settings.shortcut.recording',
      description: 'settings.shortcut.recordingHint'
    });
  });

  it('includes a spoken modifier preview and applying candidate in the accessible name', () => {
    expect(
      getShortcutButtonPresentation({
        state: activeState,
        recording: true,
        applying: false,
        candidate: null,
        modifierPreview: ['Ctrl', '⇧'],
        t
      }).label
    ).toBe('settings.shortcut.recording: Control + Shift');
    expect(
      getShortcutButtonPresentation({
        state: activeState,
        recording: false,
        applying: true,
        candidate: 'CommandOrControl+Alt+K',
        modifierPreview: [],
        t
      })
    ).toMatchObject({
      phase: 'applying',
      label: 'settings.shortcut.applying: Control + Alt + K'
    });
  });

  it('exposes disabled state instead of describing a stale active shortcut', () => {
    expect(
      getShortcutButtonPresentation({
        state: { ...activeState, activeAccelerator: null, status: 'disabled' },
        recording: false,
        applying: false,
        candidate: null,
        modifierPreview: [],
        t
      })
    ).toEqual({
      phase: 'disabled',
      label: 'settings.shortcut.set',
      description: 'settings.shortcut.allUnavailable'
    });
  });

  it.each([
    ['success', true],
    ['conflict', true],
    ['persist_failed', true],
    ['recovery_failed', true],
    ['escape', true],
    ['tab', false],
    ['window_blur', false],
    ['outside', false]
  ] as Array<[ShortcutFocusEvent, boolean]>)(
    'applies the %s focus policy',
    (event, expected) => {
      const focus = vi.fn();
      expect(restoreShortcutButtonFocus(event, { focus })).toBe(expected);
      expect(focus).toHaveBeenCalledTimes(expected ? 1 : 0);
    }
  );
});
