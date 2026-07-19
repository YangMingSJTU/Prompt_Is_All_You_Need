import { randomUUID } from 'node:crypto';
import {
  DEFAULT_QUICK_PANEL_SHORTCUT,
  normalizeShortcutAccelerator,
  type QuickPanelShortcutState,
  type ShortcutAccelerator,
  type ShortcutCaptureResult,
  type ShortcutPlatform,
  type ShortcutUpdateRequest,
  type ShortcutUpdateResult
} from '../../shared/settings';
import type { SettingsService } from './settingsService';

export interface GlobalShortcutAdapter {
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
  isRegistered(accelerator: string): boolean;
  setSuspended(suspended: boolean): void;
}

interface QuickPanelShortcutControllerOptions {
  platform: ShortcutPlatform;
  globalShortcut: GlobalShortcutAdapter;
  settingsService: Pick<SettingsService, 'getSettings' | 'updateQuickPanelShortcut'>;
  onToggle(): void;
  createSessionToken?: () => string;
}

export class QuickPanelShortcutController {
  private readonly platform: ShortcutPlatform;
  private readonly globalShortcut: GlobalShortcutAdapter;
  private readonly settingsService: QuickPanelShortcutControllerOptions['settingsService'];
  private readonly onToggle: () => void;
  private readonly createSessionToken: () => string;
  private readonly ownedAccelerators = new Set<ShortcutAccelerator>();
  private state: QuickPanelShortcutState;
  private captureSessionToken: string | null = null;
  private updating = false;
  private disposed = false;

  constructor(options: QuickPanelShortcutControllerOptions) {
    this.platform = options.platform;
    this.globalShortcut = options.globalShortcut;
    this.settingsService = options.settingsService;
    this.onToggle = options.onToggle;
    this.createSessionToken = options.createSessionToken ?? randomUUID;
    this.state = {
      platform: this.platform,
      configuredAccelerator: DEFAULT_QUICK_PANEL_SHORTCUT,
      activeAccelerator: null,
      status: 'disabled',
      captureActive: false,
      startupNotice: null
    };
  }

  async initialize(): Promise<QuickPanelShortcutState> {
    const configured =
      normalizeShortcutAccelerator(
        this.settingsService.getSettings().quickPanelShortcut,
        this.platform
      ) ?? DEFAULT_QUICK_PANEL_SHORTCUT;
    this.state = {
      ...this.state,
      configuredAccelerator: configured,
      activeAccelerator: null,
      status: 'disabled',
      startupNotice: null
    };

    if (this.registerOwned(configured)) {
      this.state = {
        ...this.state,
        activeAccelerator: configured,
        status: 'active'
      };
      return this.getState();
    }

    if (configured !== DEFAULT_QUICK_PANEL_SHORTCUT && this.registerOwned(DEFAULT_QUICK_PANEL_SHORTCUT)) {
      this.state = {
        ...this.state,
        activeAccelerator: DEFAULT_QUICK_PANEL_SHORTCUT,
        status: 'fallback'
      };
      try {
        await this.settingsService.updateQuickPanelShortcut(DEFAULT_QUICK_PANEL_SHORTCUT);
        this.state = {
          ...this.state,
          configuredAccelerator: DEFAULT_QUICK_PANEL_SHORTCUT,
          startupNotice: 'custom_unavailable_fallback_applied'
        };
      } catch {
        this.state = {
          ...this.state,
          startupNotice: 'fallback_persist_failed'
        };
      }
      return this.getState();
    }

    this.state = {
      ...this.state,
      activeAccelerator: null,
      status: 'disabled',
      startupNotice: 'all_shortcuts_unavailable'
    };
    return this.getState();
  }

  getState(): QuickPanelShortcutState {
    return { ...this.state };
  }

  async update(request: ShortcutUpdateRequest): Promise<ShortcutUpdateResult> {
    if (this.captureSessionToken || this.updating || this.disposed) {
      return { ok: false, error: 'busy', state: this.getState() };
    }

    const candidate = normalizeShortcutAccelerator(
      request.intent === 'reset' ? DEFAULT_QUICK_PANEL_SHORTCUT : request.accelerator,
      this.platform
    );
    if (!candidate) {
      return { ok: false, error: 'invalid', state: this.getState() };
    }

    this.updating = true;
    const previous = this.getState();
    try {
      if (candidate === previous.activeAccelerator) {
        if (
          candidate === previous.configuredAccelerator &&
          previous.status === 'active' &&
          previous.startupNotice === null
        ) {
          return { ok: true, change: 'unchanged', state: this.getState() };
        }
        try {
          await this.settingsService.updateQuickPanelShortcut(candidate);
        } catch {
          return { ok: false, error: 'persist_failed', state: this.getState() };
        }
        this.state = {
          ...this.state,
          configuredAccelerator: candidate,
          activeAccelerator: candidate,
          status: 'active',
          startupNotice: null
        };
        return {
          ok: true,
          change: request.intent === 'reset' ? 'reset' : 'updated',
          state: this.getState()
        };
      }

      if (!this.registerOwned(candidate)) {
        return { ok: false, error: 'conflict', state: this.getState() };
      }

      try {
        await this.settingsService.updateQuickPanelShortcut(candidate);
      } catch {
        this.unregisterOwned(candidate);
        if (!this.restorePreviousRegistration(previous)) {
          return { ok: false, error: 'recovery_failed', state: this.getState() };
        }
        return { ok: false, error: 'persist_failed', state: this.getState() };
      }

      if (previous.activeAccelerator) {
        this.unregisterOwned(previous.activeAccelerator);
      }
      if (!this.isRegistered(candidate) && !this.registerOwned(candidate)) {
        this.state = {
          ...this.state,
          configuredAccelerator: candidate,
          activeAccelerator: null,
          status: 'disabled',
          startupNotice: 'all_shortcuts_unavailable'
        };
        return { ok: false, error: 'recovery_failed', state: this.getState() };
      }

      this.state = {
        ...this.state,
        configuredAccelerator: candidate,
        activeAccelerator: candidate,
        status: 'active',
        startupNotice: null
      };
      return {
        ok: true,
        change: request.intent === 'reset' ? 'reset' : 'updated',
        state: this.getState()
      };
    } finally {
      this.updating = false;
    }
  }

  beginCapture(): ShortcutCaptureResult {
    if (this.captureSessionToken || this.updating || this.disposed) {
      return { ok: false, error: 'busy', state: this.getState() };
    }

    const sessionToken = this.createSessionToken();
    this.captureSessionToken = sessionToken;
    this.state = { ...this.state, captureActive: true };
    try {
      this.globalShortcut.setSuspended(true);
      return { ok: true, sessionToken, state: this.getState() };
    } catch {
      this.captureSessionToken = null;
      this.state = { ...this.state, captureActive: false };
      return { ok: false, error: 'failed', state: this.getState() };
    }
  }

  endCapture(sessionToken: string): QuickPanelShortcutState {
    if (!this.captureSessionToken || sessionToken !== this.captureSessionToken) {
      return this.getState();
    }
    this.forceEndCapture();
    return this.getState();
  }

  forceEndCapture(): QuickPanelShortcutState {
    if (this.captureSessionToken) {
      try {
        this.globalShortcut.setSuspended(false);
      } catch {
        // The guard is still cleared so a renderer crash cannot strand the capture session.
      } finally {
        this.captureSessionToken = null;
        this.state = { ...this.state, captureActive: false };
      }
    }
    return this.getState();
  }

  dismissStartupNotice(): QuickPanelShortcutState {
    this.state = { ...this.state, startupNotice: null };
    return this.getState();
  }

  dispose(): void {
    this.forceEndCapture();
    for (const accelerator of [...this.ownedAccelerators]) {
      this.unregisterOwned(accelerator);
    }
    this.disposed = true;
  }

  private registerOwned(accelerator: ShortcutAccelerator): boolean {
    if (this.isRegistered(accelerator)) {
      return this.ownedAccelerators.has(accelerator);
    }
    try {
      const registered = this.globalShortcut.register(accelerator, () => {
        if (!this.captureSessionToken && !this.updating && !this.disposed) {
          this.onToggle();
        }
      });
      if (!registered || !this.globalShortcut.isRegistered(accelerator)) {
        if (registered) {
          this.globalShortcut.unregister(accelerator);
        }
        return false;
      }
      this.ownedAccelerators.add(accelerator);
      return true;
    } catch {
      return false;
    }
  }

  private unregisterOwned(accelerator: ShortcutAccelerator): void {
    if (!this.ownedAccelerators.has(accelerator)) {
      return;
    }
    this.globalShortcut.unregister(accelerator);
    this.ownedAccelerators.delete(accelerator);
  }

  private isRegistered(accelerator: ShortcutAccelerator): boolean {
    try {
      return this.globalShortcut.isRegistered(accelerator);
    } catch {
      return false;
    }
  }

  private restorePreviousRegistration(previous: QuickPanelShortcutState): boolean {
    if (!previous.activeAccelerator) {
      this.state = previous;
      return true;
    }
    if (
      !this.isRegistered(previous.activeAccelerator) &&
      !this.registerOwned(previous.activeAccelerator)
    ) {
      this.state = {
        ...previous,
        activeAccelerator: null,
        status: 'disabled',
        startupNotice: 'all_shortcuts_unavailable'
      };
      return false;
    }
    this.state = previous;
    return true;
  }
}
