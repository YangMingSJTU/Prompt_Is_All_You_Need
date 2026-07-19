import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Electron storage', () => {
  it('derives application data from Electron userData after readiness', async () => {
    const mainSource = await readFile(
      join(process.cwd(), 'desktop', 'main', 'index.ts'),
      'utf8'
    );
    const readyAt = mainSource.indexOf('app.whenReady()');
    const pathsAt = mainSource.indexOf('platformPaths = createPlatformPaths({');
    const startupAt = mainSource.indexOf('return runAppStartup({');
    const initializeAt = mainSource.indexOf('async initialize()', startupAt);

    expect(readyAt).toBeGreaterThan(-1);
    expect(pathsAt).toBeGreaterThan(readyAt);
    expect(startupAt).toBeGreaterThan(-1);
    expect(initializeAt).toBeGreaterThan(startupAt);
    expect(pathsAt).toBeGreaterThan(initializeAt);
    expect(mainSource).toContain("userDataDirectory: app.getPath('userData')");
    expect(mainSource).not.toContain('app.setPath(');
    expect(mainSource).not.toContain('configureElectronStorage');
  });

  it('keeps platform detection in the startup composition root', async () => {
    const mainSource = await readFile(join(process.cwd(), 'desktop', 'main', 'index.ts'), 'utf8');
    const serviceSources = await Promise.all([
      'platformPaths.ts', 'settingsService.ts', 'skillService.ts', 'skillPath.ts'
    ].map((name) => readFile(join(process.cwd(), 'desktop', 'main', 'services', name), 'utf8')));
    const scannerSource = await readFile(join(process.cwd(), 'desktop', 'main', 'services', 'scanner.ts'), 'utf8');

    expect(mainSource.match(/process\.platform/g)).toHaveLength(1);
    for (const source of serviceSources) {
      expect(source).not.toContain('process.platform');
      expect(source).not.toContain('process.cwd()');
    }
    expect(scannerSource).not.toContain("from 'node:path'");
    expect(scannerSource).toContain('pathContext.path.join');
  });
});
