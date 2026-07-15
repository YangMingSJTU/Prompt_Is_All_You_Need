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
