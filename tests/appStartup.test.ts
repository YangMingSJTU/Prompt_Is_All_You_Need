import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getAppIconPath,
  getSqlWasmPath,
  resolveAppRoot
} from '../desktop/main/services/appAssets';
import { runAppStartup } from '../desktop/main/services/appStartup';
import { openAppDatabase } from '../desktop/main/services/database';

const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
});

describe('app startup', () => {
  it('starts with real packaged resources when the process cwd is unrelated', async () => {
    const fixture = await mkdtemp(join(tmpdir(), 'spellbook-startup-cwd-'));
    const unrelatedCwd = join(fixture, 'other-cwd');
    const databasePath = join(fixture, 'user-data', 'index.sqlite');
    await mkdir(unrelatedCwd);
    process.chdir(unrelatedCwd);
    let windowsCreated = 0;
    const failures: unknown[] = [];

    try {
      const result = await runAppStartup({
        async initialize() {
          const appRoot = resolveAppRoot({
            isPackaged: true,
            appPath: join(originalCwd, 'resources', 'app.asar'),
            resourcesPath: join(originalCwd, 'resources')
          });
          expect(existsSync(getAppIconPath(appRoot, 'win32'))).toBe(true);
          const db = await openAppDatabase(databasePath, getSqlWasmPath(appRoot));
          db.run(
            "INSERT INTO app_settings (key, value, updated_at) VALUES ('cwd', 'independent', 'now')"
          );
          await db.save();
        },
        async createWindows() {
          windowsCreated += 1;
        },
        showFailure(feedback) {
          failures.push(feedback);
        },
        quit() {
          throw new Error('Startup should not quit');
        }
      });

      expect(result).toBe('started');
      expect(windowsCreated).toBe(1);
      expect(failures).toEqual([]);
      expect((await readFile(databasePath)).byteLength).toBeGreaterThan(0);
    } finally {
      process.chdir(originalCwd);
      await rm(fixture, { recursive: true, force: true });
    }
  });

  it('shows a visible error and quits when initialization fails before any window exists', async () => {
    const feedback: Array<{ title: string; message: string }> = [];
    let windowsCreated = 0;
    let quitCalls = 0;

    const result = await runAppStartup({
      async initialize() {
        throw new Error('sql-wasm.wasm is missing');
      },
      async createWindows() {
        windowsCreated += 1;
      },
      showFailure(value) {
        feedback.push(value);
      },
      quit() {
        quitCalls += 1;
      }
    });

    expect(result).toBe('failed');
    expect(windowsCreated).toBe(0);
    expect(quitCalls).toBe(1);
    expect(feedback).toEqual([
      expect.objectContaining({
        title: 'Spellbook failed to start',
        message: expect.stringContaining('sql-wasm.wasm is missing')
      })
    ]);
  });
});
