export interface StartupFailureFeedback {
  title: string;
  message: string;
}

export interface AppStartupOperations {
  initialize(): Promise<void>;
  createWindows(): Promise<void>;
  showFailure(feedback: StartupFailureFeedback): void;
  quit(): void;
}

export interface AppPreflightOperations {
  prepare(): void;
  showFailure(feedback: StartupFailureFeedback): void;
  exit(code: number): void;
}

export function runAppPreflight(
  operations: AppPreflightOperations
): 'ready' | 'failed' {
  try {
    operations.prepare();
    return 'ready';
  } catch (error) {
    const feedback = createStorageFailureFeedback(error);
    try {
      operations.showFailure(feedback);
    } finally {
      operations.exit(1);
    }
    return 'failed';
  }
}

export async function runAppStartup(
  operations: AppStartupOperations
): Promise<'started' | 'failed'> {
  try {
    await operations.initialize();
    await operations.createWindows();
    return 'started';
  } catch (error) {
    const feedback = createStartupFailureFeedback(error);
    try {
      operations.showFailure(feedback);
    } finally {
      operations.quit();
    }
    return 'failed';
  }
}

export function createStartupFailureFeedback(error: unknown): StartupFailureFeedback {
  const detail =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : 'Unknown startup error';
  return {
    title: 'Spellbook failed to start',
    message: [
      'Spellbook could not load its required application resources.',
      'Please reinstall the application. If the problem continues, include the details below when reporting it.',
      '',
      `Details: ${detail}`
    ].join('\n')
  };
}

export function createStorageFailureFeedback(error: unknown): StartupFailureFeedback {
  const detail =
    error instanceof Error && error.message.trim()
      ? error.message.trim()
      : 'Unknown local data error';
  return {
    title: 'Spellbook failed to start',
    message: [
      'Spellbook could not prepare its local data directory.',
      'Check that your user profile is writable, then start Spellbook again.',
      '',
      `Details: ${detail}`
    ].join('\n')
  };
}
