import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { runAppPreflight, runAppStartup } from '../desktop/main/services/appStartup';
import { openAppDatabase } from '../desktop/main/services/database';
import { createPlatformPaths } from '../desktop/main/services/platformPaths';

const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
});

describe('app startup', () => {
  it('starts with the installed SQL resource when the process cwd is unrelated', async () => {
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
          const sqlWasmPath = fileURLToPath(import.meta.resolve('sql.js/dist/sql-wasm.wasm'));
          expect(existsSync(sqlWasmPath)).toBe(true);
          const db = await openAppDatabase(databasePath, { sqlWasmPath });
          await db.transaction(() => {
            db.run(
              "INSERT INTO app_settings (key, value, updated_at) VALUES ('cwd', 'independent', 'now')"
            );
          });
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

  it('reports an invalid platform override before creating a window', async () => {
    const feedback: Array<{ title: string; message: string }> = [];
    let windowsCreated = 0;
    let quitCalls = 0;

    const result = await runAppStartup({
      async initialize() {
        createPlatformPaths({
          platform: 'darwin',
          homeDirectory: '/Users/Ada',
          userDataDirectory: '/Users/Ada/Library/Application Support/Spellbook',
          env: { CODEX_HOME: '../relative-codex-home' }
        });
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
        message: expect.stringContaining('CODEX_HOME must be an absolute darwin path')
      })
    ]);
  });

  it('shows a visible error and exits when pre-ready storage preparation fails', () => {
    const sequence: string[] = [];

    const result = runAppPreflight({
      prepare() {
        throw new Error('EPERM: user profile is not writable');
      },
      showFailure(feedback) {
        sequence.push(`feedback:${feedback.title}:${feedback.message}`);
      },
      exit(code) {
        sequence.push(`exit:${code}`);
      }
    });

    expect(result).toBe('failed');
    expect(sequence).toHaveLength(2);
    expect(sequence[0]).toContain('Spellbook failed to start');
    expect(sequence[0]).toContain('EPERM: user profile is not writable');
    expect(sequence[1]).toBe('exit:1');
  });

  it('starts on the next launch after a missing wasm resource is restored', async () => {
    const feedback: Array<{ title: string; message: string }> = [];
    let quitCalls = 0;
    let windowsCreated = 0;
    let wasmAvailable = false;

    const operations = {
      async initialize() {
        if (!wasmAvailable) {
          throw new Error('ENOENT: sql-wasm.wasm is missing');
        }
      },
      async createWindows() {
        windowsCreated += 1;
      },
      showFailure(value: { title: string; message: string }) {
        feedback.push(value);
      },
      quit() {
        quitCalls += 1;
      }
    };

    expect(await runAppStartup(operations)).toBe('failed');
    expect(windowsCreated).toBe(0);
    expect(quitCalls).toBe(1);
    expect(feedback[0]).toEqual(
      expect.objectContaining({
        title: 'Spellbook failed to start',
        message: expect.stringContaining('sql-wasm.wasm')
      })
    );

    wasmAvailable = true;

    expect(await runAppStartup(operations)).toBe('started');
    expect(windowsCreated).toBe(1);
    expect(quitCalls).toBe(1);
    expect(feedback).toHaveLength(1);
  });
});
