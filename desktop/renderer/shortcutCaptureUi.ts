import {
  getShortcutAccessibleText,
  type QuickPanelShortcutState
} from '../shared/settings';
import type { TFunction } from './i18n';

export interface ShortcutButtonPresentation {
  label: string;
  description: string;
  phase: 'default' | 'recording' | 'applying' | 'disabled';
}

export function getShortcutButtonPresentation(options: {
  state: QuickPanelShortcutState | null;
  recording: boolean;
  applying: boolean;
  candidate: string | null;
  modifierPreview: string[];
  t: TFunction;
}): ShortcutButtonPresentation {
  const { state, recording, applying, candidate, modifierPreview, t } = options;
  if (recording) {
    const preview = modifierPreview.map(spokenModifier).join(' + ');
    return {
      label: preview
        ? `${t('settings.shortcut.recording')}: ${preview}`
        : t('settings.shortcut.recording'),
      description: t('settings.shortcut.recordingHint'),
      phase: 'recording'
    };
  }
  if (applying && state) {
    const accelerator =
      candidate ?? state.activeAccelerator ?? state.configuredAccelerator;
    return {
      label: `${t('settings.shortcut.applying')}: ${getShortcutAccessibleText(
        accelerator,
        state.platform
      )}`,
      description: t('settings.shortcut.applying'),
      phase: 'applying'
    };
  }
  if (!state || state.status === 'disabled' || !state.activeAccelerator) {
    return {
      label: t('settings.shortcut.set'),
      description: t('settings.shortcut.allUnavailable'),
      phase: 'disabled'
    };
  }
  return {
    label: `${t('settings.shortcut.change')}: ${getShortcutAccessibleText(
      state.activeAccelerator,
      state.platform
    )}`,
    description: t('settings.shortcut.quickPanelDescription'),
    phase: 'default'
  };
}

export type ShortcutFocusEvent =
  | 'success'
  | 'conflict'
  | 'persist_failed'
  | 'recovery_failed'
  | 'escape'
  | 'tab'
  | 'window_blur'
  | 'outside';

export function restoreShortcutButtonFocus(
  event: ShortcutFocusEvent,
  button: Pick<HTMLButtonElement, 'focus'> | null
): boolean {
  if (event === 'tab' || event === 'window_blur' || event === 'outside' || !button) {
    return false;
  }
  button.focus();
  return true;
}

function spokenModifier(label: string): string {
  const labels: Record<string, string> = {
    '⌘': 'Command',
    '⌃': 'Control',
    '⌥': 'Option',
    '⇧': 'Shift',
    Ctrl: 'Control',
    Win: 'Windows'
  };
  return labels[label] ?? label;
}
