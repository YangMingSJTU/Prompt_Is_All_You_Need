import { describe, expect, it } from 'vitest';
import {
  createAppReadinessBarrier,
  createWindowRestorer,
  registerSingleInstanceLifecycle,
  type RestorableWindow
} from '../desktop/main/services/appLifecycle';

class TestWindow implements RestorableWindow {
  destroyed = false;
  minimized = false;
  visible = false;
  restoreCalls = 0;
  showCalls = 0;
  focusCalls = 0;

  isDestroyed(): boolean {
    return this.destroyed;
  }

  isMinimized(): boolean {
    return this.minimized;
  }

  isVisible(): boolean {
    return this.visible;
  }

  restore(): void {
    this.minimized = false;
    this.restoreCalls += 1;
  }

  show(): void {
    this.visible = true;
    this.showCalls += 1;
  }

  focus(): void {
    this.focusCalls += 1;
  }
}

describe('app single-instance lifecycle', () => {
  it('quits a secondary process before it initializes another app session', () => {
    let handlerRegistered = false;
    let quitCalls = 0;

    const result = registerSingleInstanceLifecycle({
      requestLock: () => false,
      onSecondInstance: () => {
        handlerRegistered = true;
      },
      restorePrimaryWindow: async () => undefined,
      reportRestoreFailure: () => undefined,
      quitSecondary: () => {
        quitCalls += 1;
      }
    });

    expect(result).toBe('secondary');
    expect(quitCalls).toBe(1);
    expect(handlerRegistered).toBe(false);
  });

  it('restores one primary window across repeated tray closes and concurrent relaunches', async () => {
    let currentWindow: TestWindow | null = new TestWindow();
    currentWindow.visible = true;
    let createCalls = 0;
    let secondInstanceHandler: (() => void) | null = null;
    const pendingRestores: Promise<void>[] = [];
    const restoreWindow = createWindowRestorer({
      getWindow: () => currentWindow,
      async createWindow() {
        createCalls += 1;
        await Promise.resolve();
        currentWindow = new TestWindow();
        return currentWindow;
      }
    });

    expect(
      registerSingleInstanceLifecycle({
        requestLock: () => true,
        onSecondInstance(handler) {
          secondInstanceHandler = handler;
        },
        restorePrimaryWindow() {
          const restore = restoreWindow();
          pendingRestores.push(restore);
          return restore;
        },
        reportRestoreFailure(error) {
          throw error;
        },
        quitSecondary() {
          throw new Error('Primary instance must not quit');
        }
      })
    ).toBe('primary');

    for (let cycle = 0; cycle < 3; cycle += 1) {
      currentWindow!.destroyed = true;
      currentWindow = null;
      secondInstanceHandler!();
      secondInstanceHandler!();
      await Promise.all(pendingRestores.splice(0));

      expect(currentWindow).not.toBeNull();
      expect(currentWindow!.visible).toBe(true);
      expect(currentWindow!.focusCalls).toBeGreaterThan(0);
    }

    expect(createCalls).toBe(3);
  });

  it('queues cold-start relaunches behind bootstrap and creates exactly one focused window', async () => {
    let currentWindow: TestWindow | null = null;
    let createCalls = 0;
    let initializeCalls = 0;
    let secondInstanceHandler: (() => void) | null = null;
    const bootstrapStarted = deferred();
    const releaseBootstrap = deferred();
    const pendingRestores: Promise<void>[] = [];
    const restoreWindow = createWindowRestorer({
      getWindow: () => currentWindow,
      async createWindow() {
        createCalls += 1;
        currentWindow = new TestWindow();
        return currentWindow;
      }
    });
    const readiness = createAppReadinessBarrier({
      async startApplication() {
        initializeCalls += 1;
        bootstrapStarted.resolve();
        await releaseBootstrap.promise;
        await restoreWindow();
        return 'started';
      },
      restorePrimaryWindow: restoreWindow
    });

    expect(
      registerSingleInstanceLifecycle({
        requestLock: () => true,
        onSecondInstance(handler) {
          secondInstanceHandler = handler;
        },
        restorePrimaryWindow() {
          const restore = readiness.restorePrimaryWindow().then(() => undefined);
          pendingRestores.push(restore);
          return restore;
        },
        reportRestoreFailure(error) {
          throw error;
        },
        quitSecondary() {
          throw new Error('Primary instance must not quit');
        }
      })
    ).toBe('primary');

    const startup = readiness.start();
    secondInstanceHandler!();
    secondInstanceHandler!();
    await bootstrapStarted.promise;
    await Promise.resolve();

    expect(initializeCalls).toBe(1);
    expect(createCalls).toBe(0);
    expect(currentWindow).toBeNull();

    releaseBootstrap.resolve();
    await Promise.all([startup, ...pendingRestores]);

    expect(initializeCalls).toBe(1);
    expect(createCalls).toBe(1);
    expect(currentWindow).not.toBeNull();
    expect(currentWindow!.visible).toBe(true);
    expect(currentWindow!.focusCalls).toBeGreaterThan(0);
  });

  it('restores and focuses an existing minimized window without creating another one', async () => {
    const window = new TestWindow();
    window.minimized = true;
    let createCalls = 0;
    const restoreWindow = createWindowRestorer({
      getWindow: () => window,
      async createWindow() {
        createCalls += 1;
        return new TestWindow();
      }
    });

    await restoreWindow();

    expect(createCalls).toBe(0);
    expect(window.restoreCalls).toBe(1);
    expect(window.showCalls).toBe(1);
    expect(window.focusCalls).toBe(1);
  });
});

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}
