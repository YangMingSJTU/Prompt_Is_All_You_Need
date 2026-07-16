import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

const describeWindows = process.platform === 'win32' ? describe : describe.skip;
const ownershipScript = join(process.cwd(), 'build', 'shortcutOwnership.ps1');

interface OwnershipPaths {
  shortcut: string;
  target: string;
  marker: string;
}

function runPowerShell(args: string[], environment: NodeJS.ProcessEnv = process.env): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...args],
      { env: environment },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${error.message}\n${stderr}`));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

async function runOwnership(
  action: 'install' | 'uninstall',
  paths: OwnershipPaths,
  requested = true
): Promise<void> {
  await runPowerShell([
    '-File',
    ownershipScript,
    '-Action',
    action,
    '-ShortcutPath',
    paths.shortcut,
    '-TargetPath',
    paths.target,
    '-MarkerPath',
    paths.marker,
    '-Requested',
    String(requested)
  ]);
}

async function createTarget(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, 'test executable');
}

async function createShortcut(shortcutPath: string, targetPath: string): Promise<void> {
  await mkdir(dirname(shortcutPath), { recursive: true });
  await runPowerShell(
    [
      '-Command',
      '$shell = New-Object -ComObject WScript.Shell; $shortcut = $shell.CreateShortcut($env:TEST_SHORTCUT); $shortcut.TargetPath = $env:TEST_TARGET; $shortcut.Save()'
    ],
    { ...process.env, TEST_SHORTCUT: shortcutPath, TEST_TARGET: targetPath }
  );
}

async function readShortcutTarget(shortcutPath: string): Promise<string> {
  return runPowerShell(
    [
      '-Command',
      '$shell = New-Object -ComObject WScript.Shell; [Console]::Out.Write($shell.CreateShortcut($env:TEST_SHORTCUT).TargetPath)'
    ],
    { ...process.env, TEST_SHORTCUT: shortcutPath }
  );
}

describeWindows('Windows desktop shortcut ownership', () => {
  it('honors --no-desktop-shortcut without creating ownership state', async () => {
    const fixture = await mkdtemp(join(tmpdir(), 'spellbook-shortcut-none-'));
    const paths = {
      shortcut: join(fixture, 'desktop', 'Spellbook.lnk'),
      target: join(fixture, 'custom install', 'Spellbook.exe'),
      marker: join(fixture, 'custom install', '.spellbook-desktop-shortcut-owner.json')
    };

    try {
      await createTarget(paths.target);
      await runOwnership('install', paths, false);
      await runOwnership('uninstall', paths);

      expect(existsSync(paths.shortcut)).toBe(false);
      expect(existsSync(paths.marker)).toBe(false);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  }, 15_000);

  it('preserves a same-name shortcut owned by an existing installation', async () => {
    const fixture = await mkdtemp(join(tmpdir(), 'spellbook-shortcut-existing-'));
    const oldTarget = join(fixture, 'existing 0.1.0.61', 'Spellbook.exe');
    const paths = {
      shortcut: join(fixture, 'desktop', 'Spellbook.lnk'),
      target: join(fixture, 'candidate custom directory', 'Spellbook.exe'),
      marker: join(
        fixture,
        'candidate custom directory',
        '.spellbook-desktop-shortcut-owner.json'
      )
    };

    try {
      await createTarget(oldTarget);
      await createTarget(paths.target);
      await createShortcut(paths.shortcut, oldTarget);

      await runOwnership('install', paths);
      expect(existsSync(paths.marker)).toBe(false);
      expect(await readShortcutTarget(paths.shortcut)).toBe(oldTarget);

      await runOwnership('uninstall', paths);
      expect(existsSync(paths.shortcut)).toBe(true);
      expect(await readShortcutTarget(paths.shortcut)).toBe(oldTarget);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  }, 15_000);

  it('tracks custom-directory upgrades and isolates side-by-side uninstall', async () => {
    const fixture = await mkdtemp(join(tmpdir(), 'spellbook-shortcut-owned-'));
    const shortcut = join(fixture, 'desktop', 'Spellbook.lnk');
    const first = {
      shortcut,
      target: join(fixture, 'install A', 'Spellbook.exe'),
      marker: join(fixture, 'install A', '.spellbook-desktop-shortcut-owner.json')
    };
    const sideBySide = {
      shortcut,
      target: join(fixture, 'install B', 'Spellbook.exe'),
      marker: join(fixture, 'install B', '.spellbook-desktop-shortcut-owner.json')
    };

    try {
      await createTarget(first.target);
      await createTarget(sideBySide.target);

      await runOwnership('install', first);
      await runOwnership('install', first);
      expect(await readShortcutTarget(shortcut)).toBe(first.target);
      expect(JSON.parse(await readFile(first.marker, 'utf8'))).toMatchObject({
        targetPath: first.target,
        shortcutPath: shortcut
      });

      await runOwnership('uninstall', first);
      expect(existsSync(shortcut)).toBe(false);
      await runOwnership('install', first);
      expect(await readShortcutTarget(shortcut)).toBe(first.target);

      await runOwnership('install', sideBySide);
      expect(existsSync(sideBySide.marker)).toBe(false);
      await runOwnership('uninstall', sideBySide);
      expect(existsSync(shortcut)).toBe(true);
      expect(await readShortcutTarget(shortcut)).toBe(first.target);

      await runOwnership('uninstall', first);
      expect(existsSync(shortcut)).toBe(false);
      expect(existsSync(first.marker)).toBe(false);
    } finally {
      await rm(fixture, { recursive: true, force: true });
    }
  }, 20_000);

  it('keeps the source-owned NSIS path from running electron-builder shortcut deletion', async () => {
    const config = await readFile(join(process.cwd(), 'electron-builder.yml'), 'utf8');
    const include = await readFile(join(process.cwd(), 'build', 'installer.nsh'), 'utf8');

    expect(config).toContain('include: build/installer.nsh');
    expect(config).toContain('createDesktopShortcut: false');
    expect(include).toContain('${isNoDesktopShortcut}');
    expect(include).toContain('customUnInstall');
  });
});
