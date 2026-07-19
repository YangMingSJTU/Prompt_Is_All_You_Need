import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_SETTINGS } from '../desktop/shared/settings';
import {
  QuickPanelShortcutController,
  type GlobalShortcutAdapter
} from '../desktop/main/services/quickPanelShortcutController';

const DEFAULT = DEFAULT_APP_SETTINGS.quickPanelShortcut;
const CUSTOM = 'CommandOrControl+Alt+K';
const SECOND = 'CommandOrControl+Shift+P';

describe('quick panel shortcut controller', () => {
  it('registers the candidate, persists it, then releases the old shortcut', async () => {
    const events: string[] = [];
    const globalShortcut = new FakeGlobalShortcut(events);
    const settings = new FakeSettings(DEFAULT, events);
    const controller = createController(globalShortcut, settings);
    await controller.initialize();
    events.length = 0;

    const result = await controller.update({ intent: 'set', accelerator: CUSTOM });

    expect(result).toMatchObject({ ok: true, change: 'updated' });
    expect(events).toEqual([
      `register:${CUSTOM}`,
      `persist:${CUSTOM}`,
      `unregister:${DEFAULT}`
    ]);
    expect(controller.getState()).toMatchObject({
      configuredAccelerator: CUSTOM,
      activeAccelerator: CUSTOM,
      status: 'active'
    });
  });

  it('preserves the old shortcut on conflict and persistence failure', async () => {
    const events: string[] = [];
    const globalShortcut = new FakeGlobalShortcut(events);
    const settings = new FakeSettings(DEFAULT, events);
    const controller = createController(globalShortcut, settings);
    await controller.initialize();
    globalShortcut.conflicts.add(CUSTOM);

    expect(await controller.update({ intent: 'set', accelerator: CUSTOM })).toMatchObject({
      ok: false,
      error: 'conflict'
    });
    expect(globalShortcut.registered.has(DEFAULT)).toBe(true);
    globalShortcut.conflicts.delete(CUSTOM);
    settings.failPersistence = true;

    expect(await controller.update({ intent: 'set', accelerator: CUSTOM })).toMatchObject({
      ok: false,
      error: 'persist_failed'
    });
    expect(globalShortcut.registered.has(DEFAULT)).toBe(true);
    expect(globalShortcut.registered.has(CUSTOM)).toBe(false);
    expect(controller.getState().activeAccelerator).toBe(DEFAULT);
  });

  it('returns busy for overlapping updates and suppresses actions during the transaction', async () => {
    const events: string[] = [];
    const globalShortcut = new FakeGlobalShortcut(events);
    const settings = new FakeSettings(DEFAULT, events);
    const toggles: string[] = [];
    const controller = createController(globalShortcut, settings, () => toggles.push('toggle'));
    await controller.initialize();
    const deferred = settings.deferNextPersistence();

    const first = controller.update({ intent: 'set', accelerator: CUSTOM });
    globalShortcut.invoke(DEFAULT);
    globalShortcut.invoke(CUSTOM);
    const second = await controller.update({ intent: 'set', accelerator: SECOND });

    expect(second).toMatchObject({ ok: false, error: 'busy' });
    expect(toggles).toEqual([]);
    deferred.resolve();
    await expect(first).resolves.toMatchObject({ ok: true });
  });

  it('covers configured, fallback, persistence-failed fallback, and disabled startup states', async () => {
    const activeController = createController(
      new FakeGlobalShortcut([]),
      new FakeSettings(CUSTOM, [])
    );
    expect(await activeController.initialize()).toMatchObject({
      configuredAccelerator: CUSTOM,
      activeAccelerator: CUSTOM,
      status: 'active',
      startupNotice: null
    });

    const fallbackGlobal = new FakeGlobalShortcut([]);
    fallbackGlobal.conflicts.add(CUSTOM);
    const fallbackSettings = new FakeSettings(CUSTOM, []);
    const fallbackController = createController(fallbackGlobal, fallbackSettings);
    expect(await fallbackController.initialize()).toMatchObject({
      configuredAccelerator: DEFAULT,
      activeAccelerator: DEFAULT,
      status: 'fallback',
      startupNotice: 'custom_unavailable_fallback_applied'
    });
    expect(fallbackSettings.shortcut).toBe(DEFAULT);

    const persistFailureGlobal = new FakeGlobalShortcut([]);
    persistFailureGlobal.conflicts.add(CUSTOM);
    const persistFailureSettings = new FakeSettings(CUSTOM, []);
    persistFailureSettings.failPersistence = true;
    const persistFailureController = createController(
      persistFailureGlobal,
      persistFailureSettings
    );
    expect(await persistFailureController.initialize()).toMatchObject({
      configuredAccelerator: CUSTOM,
      activeAccelerator: DEFAULT,
      status: 'fallback',
      startupNotice: 'fallback_persist_failed'
    });

    const allConflictGlobal = new FakeGlobalShortcut([]);
    allConflictGlobal.conflicts.add(CUSTOM);
    allConflictGlobal.conflicts.add(DEFAULT);
    const disabledController = createController(
      allConflictGlobal,
      new FakeSettings(CUSTOM, [])
    );
    expect(await disabledController.initialize()).toMatchObject({
      configuredAccelerator: CUSTOM,
      activeAccelerator: null,
      status: 'disabled',
      startupNotice: 'all_shortcuts_unavailable'
    });

    const defaultConflictGlobal = new FakeGlobalShortcut([]);
    defaultConflictGlobal.conflicts.add(DEFAULT);
    const defaultDisabledController = createController(
      defaultConflictGlobal,
      new FakeSettings(DEFAULT, [])
    );
    expect(await defaultDisabledController.initialize()).toMatchObject({
      configuredAccelerator: DEFAULT,
      activeAccelerator: null,
      status: 'disabled'
    });
  });

  it('suspends capture, ignores stale cleanup, and force-recovers after renderer loss', async () => {
    const events: string[] = [];
    const globalShortcut = new FakeGlobalShortcut(events);
    const settings = new FakeSettings(DEFAULT, events);
    let toggleCount = 0;
    const controller = createController(globalShortcut, settings, () => {
      toggleCount += 1;
    });
    await controller.initialize();

    const capture = controller.beginCapture();
    expect(capture).toMatchObject({ ok: true, sessionToken: 'session-token' });
    expect(controller.getState().captureActive).toBe(true);
    globalShortcut.invoke(DEFAULT);
    expect(toggleCount).toBe(0);

    controller.endCapture('stale-token');
    expect(controller.getState().captureActive).toBe(true);
    controller.forceEndCapture();
    expect(controller.getState().captureActive).toBe(false);
    expect(globalShortcut.suspended).toBe(false);
    globalShortcut.invoke(DEFAULT);
    expect(toggleCount).toBe(1);
    expect(events).toContain('suspended:true');
    expect(events).toContain('suspended:false');
  });

  it('clears a capture session even when Electron fails to resume listeners', async () => {
    const globalShortcut = new FakeGlobalShortcut([]);
    const controller = createController(globalShortcut, new FakeSettings(DEFAULT, []));
    await controller.initialize();
    expect(controller.beginCapture().ok).toBe(true);
    globalShortcut.failResume = true;

    expect(() => controller.forceEndCapture()).not.toThrow();
    expect(controller.getState().captureActive).toBe(false);
  });

  it('reports recovery failure when neither compensation nor persisted recovery can register', async () => {
    const events: string[] = [];
    const globalShortcut = new FakeGlobalShortcut(events);
    const settings = new FakeSettings(DEFAULT, events);
    const controller = createController(globalShortcut, settings);
    await controller.initialize();
    settings.failPersistence = true;
    settings.onFailure = () => {
      globalShortcut.registered.delete(DEFAULT);
      globalShortcut.conflicts.add(DEFAULT);
    };

    const result = await controller.update({ intent: 'set', accelerator: CUSTOM });

    expect(result).toMatchObject({ ok: false, error: 'recovery_failed' });
    expect(controller.getState()).toMatchObject({
      configuredAccelerator: DEFAULT,
      activeAccelerator: null,
      status: 'disabled'
    });
  });
});

class FakeGlobalShortcut implements GlobalShortcutAdapter {
  readonly callbacks = new Map<string, () => void>();
  readonly conflicts = new Set<string>();
  readonly registered = new Set<string>();
  suspended = false;
  failResume = false;

  constructor(private readonly events: string[]) {}

  register(accelerator: string, callback: () => void): boolean {
    this.events.push(`register:${accelerator}`);
    if (this.conflicts.has(accelerator) || this.registered.has(accelerator)) {
      return false;
    }
    this.registered.add(accelerator);
    this.callbacks.set(accelerator, callback);
    return true;
  }

  unregister(accelerator: string): void {
    this.events.push(`unregister:${accelerator}`);
    this.registered.delete(accelerator);
    this.callbacks.delete(accelerator);
  }

  isRegistered(accelerator: string): boolean {
    return this.registered.has(accelerator);
  }

  setSuspended(suspended: boolean): void {
    this.events.push(`suspended:${suspended}`);
    if (!suspended && this.failResume) {
      throw new Error('injected resume failure');
    }
    this.suspended = suspended;
  }

  invoke(accelerator: string): void {
    this.callbacks.get(accelerator)?.();
  }
}

class FakeSettings {
  failPersistence = false;
  onFailure: (() => void) | null = null;
  shortcut: string;
  private deferred: Deferred | null = null;

  constructor(shortcut: string, private readonly events: string[]) {
    this.shortcut = shortcut;
  }

  getSettings() {
    return { ...DEFAULT_APP_SETTINGS, quickPanelShortcut: this.shortcut };
  }

  async updateQuickPanelShortcut(shortcut: string) {
    this.events.push(`persist:${shortcut}`);
    if (this.deferred) {
      const deferred = this.deferred;
      this.deferred = null;
      await deferred.promise;
    }
    if (this.failPersistence) {
      this.onFailure?.();
      throw new Error('injected persistence failure');
    }
    this.shortcut = shortcut;
    return this.getSettings();
  }

  deferNextPersistence(): Deferred {
    const deferred = createDeferred();
    this.deferred = deferred;
    return deferred;
  }
}

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
}

function createDeferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

function createController(
  globalShortcut: FakeGlobalShortcut,
  settingsService: FakeSettings,
  onToggle: () => void = () => undefined
): QuickPanelShortcutController {
  return new QuickPanelShortcutController({
    platform: 'win32',
    globalShortcut,
    settingsService,
    onToggle,
    createSessionToken: () => 'session-token'
  });
}
