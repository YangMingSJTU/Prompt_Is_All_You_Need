import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPackagedSmokeEvidence } from '../desktop/main/services/packagedSmoke';
import {
  createPlatformPaths,
  nativePlatformPathContext
} from '../desktop/main/services/platformPaths';

describe('packaged smoke evidence', () => {
  it('passes only for a packaged app with data and resources in place', async () => {
    const root = await mkdtemp(join(tmpdir(), 'spellbook-smoke-'));
    const userDataDirectory = join(root, 'user data');
    const pathContext = nativePlatformPathContext;
    const paths = createPlatformPaths({
      platform: pathContext.platform,
      homeDirectory: join(root, 'home'),
      userDataDirectory,
      path: pathContext.path
    });
    const sqlWasmPath = join(root, 'resources', 'sql-wasm.wasm');
    const trayIconPath = join(root, 'resources', 'tray.png');
    const windowsIconPath = join(root, 'resources', 'app.ico');

    try {
      await mkdir(paths.packageDirectory, { recursive: true });
      await mkdir(join(root, 'resources'), { recursive: true });
      await Promise.all([
        writeFile(paths.databasePath, 'db'),
        writeFile(sqlWasmPath, 'wasm'),
        writeFile(trayIconPath, 'png'),
        writeFile(windowsIconPath, 'ico')
      ]);
      const evidence = await createPackagedSmokeEvidence({
        platform: pathContext.platform,
        isPackaged: true,
        paths,
        pathContext,
        sqlWasmPath,
        trayIconPath,
        windowsIconPath: pathContext.platform === 'win32' ? windowsIconPath : undefined
      });

      expect(evidence.passed).toBe(true);
      expect(evidence.checks).toEqual({
        databaseCreated: true,
        packageDirectoryCreated: true,
        sqlWasmLoaded: true,
        trayIconLoaded: true,
        windowsIconLoaded: true,
        dataInsideUserData: true
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
