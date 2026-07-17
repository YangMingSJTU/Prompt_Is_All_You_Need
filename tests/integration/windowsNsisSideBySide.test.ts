import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const describeWindows = process.platform === 'win32' ? describe : describe.skip;

function runExecutable(path: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(path, args, { timeout: 120_000 }, (error, _stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}\n${stderr}`));
        return;
      }
      resolve();
    });
  });
}

function runPowerShell(command: string, environment: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
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

async function removeTestRegistry(installKey: string, uninstallKey: string): Promise<void> {
  await runPowerShell(
    [
      '[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($env:TEST_INSTALL_KEY, $false)',
      '[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree(($env:TEST_INSTALL_KEY + ".Instances"), $false)',
      '[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($env:TEST_UNINSTALL_KEY, $false)'
    ].join('; '),
    {
      ...process.env,
      TEST_INSTALL_KEY: installKey,
      TEST_UNINSTALL_KEY: uninstallKey
    }
  );
}

async function readTestRegistryState(
  installKey: string,
  uninstallKey: string
): Promise<{ install: boolean; instances: boolean; uninstall: boolean }> {
  const output = await runPowerShell(
    [
      '$root = [Microsoft.Win32.Registry]::CurrentUser',
      '$state = [pscustomobject]@{',
      '  install = $null -ne $root.OpenSubKey($env:TEST_INSTALL_KEY)',
      '  instances = $null -ne $root.OpenSubKey(($env:TEST_INSTALL_KEY + ".Instances"))',
      '  uninstall = $null -ne $root.OpenSubKey($env:TEST_UNINSTALL_KEY)',
      '}',
      '$state | ConvertTo-Json -Compress'
    ].join('\n'),
    {
      ...process.env,
      TEST_INSTALL_KEY: installKey,
      TEST_UNINSTALL_KEY: uninstallKey
    }
  );
  return JSON.parse(output) as {
    install: boolean;
    instances: boolean;
    uninstall: boolean;
  };
}

async function waitForPath(path: string, expected: boolean, timeout = 20_000): Promise<void> {
  const deadline = Date.now() + timeout;
  let stableSince: number | null = null;
  while (stableSince === null || Date.now() - stableSince < 1_000) {
    if (existsSync(path) === expected) {
      stableSince ??= Date.now();
    } else {
      stableSince = null;
    }
    if (Date.now() >= deadline) {
      const remaining = existsSync(path) ? readdirSync(path) : [];
      throw new Error(
        `Timed out waiting for ${path} existence to become ${expected}; remaining entries: ${remaining.join(', ') || '(none)'}.`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

describeWindows('generated NSIS side-by-side lifecycle', () => {
  it('keeps A and B installed, then isolates reverse-order uninstall', async () => {
    const installer = process.env.SPELLBOOK_NSIS_INSTALLER;
    const productName = process.env.SPELLBOOK_NSIS_PRODUCT_NAME;
    const installKey = process.env.SPELLBOOK_NSIS_TEST_INSTALL_KEY;
    const uninstallKey = process.env.SPELLBOOK_NSIS_TEST_UNINSTALL_KEY;
    if (!installer || !productName || !installKey || !uninstallKey) {
      throw new Error(
        'Set the SPELLBOOK_NSIS_INSTALLER, SPELLBOOK_NSIS_PRODUCT_NAME, SPELLBOOK_NSIS_TEST_INSTALL_KEY, and SPELLBOOK_NSIS_TEST_UNINSTALL_KEY test inputs.'
      );
    }

    const testRoot = process.env.SPELLBOOK_NSIS_TEST_ROOT ?? tmpdir();
    await mkdir(testRoot, { recursive: true });
    const fixture = await mkdtemp(join(testRoot, 'spellbook-nsis-'));
    const installA = join(fixture, 'A');
    const installB = join(fixture, 'B');
    const executableA = join(installA, `${productName}.exe`);
    const executableB = join(installB, `${productName}.exe`);
    const uninstallerA = join(installA, `Uninstall ${productName}.exe`);
    const uninstallerB = join(installB, `Uninstall ${productName}.exe`);

    try {
      await removeTestRegistry(installKey, uninstallKey);
      await runExecutable(installer, [
        '/S',
        '/currentuser',
        '--no-desktop-shortcut',
        '--no-start-menu-shortcut',
        `/D=${installA}`
      ]);
      expect(existsSync(executableA)).toBe(true);
      expect(existsSync(uninstallerA)).toBe(true);

      await runExecutable(installer, [
        '/S',
        '/currentuser',
        '--no-desktop-shortcut',
        '--no-start-menu-shortcut',
        `/D=${installB}`
      ]);
      expect(existsSync(executableA)).toBe(true);
      expect(existsSync(uninstallerA)).toBe(true);
      expect(existsSync(executableB)).toBe(true);
      expect(existsSync(uninstallerB)).toBe(true);

      await runExecutable(uninstallerB, ['/S', '/currentuser']);
      await waitForPath(installB, false);
      expect(existsSync(executableA)).toBe(true);
      expect(existsSync(uninstallerA)).toBe(true);

      await runExecutable(uninstallerA, ['/S', '/currentuser']);
      await waitForPath(installA, false);
      expect(await readTestRegistryState(installKey, uninstallKey)).toEqual({
        install: false,
        instances: false,
        uninstall: false
      });
    } finally {
      if (existsSync(uninstallerB)) {
        await runExecutable(uninstallerB, ['/S', '/currentuser']).catch(() => undefined);
        await waitForPath(installB, false).catch(() => undefined);
      }
      if (existsSync(uninstallerA)) {
        await runExecutable(uninstallerA, ['/S', '/currentuser']).catch(() => undefined);
        await waitForPath(installA, false).catch(() => undefined);
      }
      await rm(fixture, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 200
      });
      await removeTestRegistry(installKey, uninstallKey);
    }
  }, 300_000);
});
