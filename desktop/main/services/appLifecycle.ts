export interface RestorableWindow {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  isVisible(): boolean;
  restore(): void;
  show(): void;
  focus(): void;
}

export interface WindowRestorationOperations<TWindow extends RestorableWindow> {
  getWindow(): TWindow | null;
  createWindow(): Promise<TWindow>;
}

export interface SingleInstanceOperations {
  requestLock(): boolean;
  onSecondInstance(handler: () => void): void;
  restorePrimaryWindow(): Promise<void>;
  reportRestoreFailure(error: unknown): void;
  quitSecondary(): void;
}

export type AppReadinessResult = 'started' | 'failed';

export interface AppReadinessOperations {
  startApplication(): Promise<AppReadinessResult>;
  restorePrimaryWindow(): Promise<void>;
}

export interface AppReadinessBarrier {
  start(): Promise<AppReadinessResult>;
  restorePrimaryWindow(): Promise<boolean>;
}

export function createAppReadinessBarrier(
  operations: AppReadinessOperations
): AppReadinessBarrier {
  let readinessPromise: Promise<AppReadinessResult> | null = null;

  const start = () => {
    if (!readinessPromise) {
      readinessPromise = operations.startApplication();
    }
    return readinessPromise;
  };

  return {
    start,
    async restorePrimaryWindow() {
      if ((await start()) !== 'started') {
        return false;
      }
      await operations.restorePrimaryWindow();
      return true;
    }
  };
}

export function createWindowRestorer<TWindow extends RestorableWindow>(
  operations: WindowRestorationOperations<TWindow>
): () => Promise<void> {
  let pendingCreation: Promise<TWindow> | null = null;

  return async () => {
    let window = pendingCreation ? await pendingCreation : operations.getWindow();
    if (!window || window.isDestroyed()) {
      if (!pendingCreation) {
        pendingCreation = operations.createWindow().finally(() => {
          pendingCreation = null;
        });
      }
      window = await pendingCreation;
    }

    if (window.isDestroyed()) {
      return;
    }
    if (window.isMinimized()) {
      window.restore();
    }
    if (!window.isVisible()) {
      window.show();
    }
    window.focus();
  };
}

export function registerSingleInstanceLifecycle(
  operations: SingleInstanceOperations
): 'primary' | 'secondary' {
  if (!operations.requestLock()) {
    operations.quitSecondary();
    return 'secondary';
  }

  operations.onSecondInstance(() => {
    void operations.restorePrimaryWindow().catch((error: unknown) => {
      operations.reportRestoreFailure(error);
    });
  });
  return 'primary';
}
