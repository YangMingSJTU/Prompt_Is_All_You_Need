import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const describeWindows = process.platform === 'win32' ? describe : describe.skip;

interface ExecutableResult {
  exitCode: number;
  stderr: string;
}

function runExecutableResult(path: string, args: string[]): Promise<ExecutableResult> {
  return new Promise((resolve) => {
    execFile(path, args, { timeout: 120_000 }, (error, _stdout, stderr) => {
      if (error) {
        const code = (error as { code?: string | number | null }).code;
        resolve({
          exitCode: typeof code === 'number' ? code : -1,
          stderr: `${error.message}\n${stderr}`
        });
        return;
      }
      resolve({ exitCode: 0, stderr });
    });
  });
}

async function runExecutable(path: string, args: string[]): Promise<void> {
  const result = await runExecutableResult(path, args);
  if (result.exitCode !== 0) {
    throw new Error(
      `Executable exited with code ${result.exitCode}.\n${result.stderr}`
    );
  }
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

async function readTestRegistration(
  installKey: string,
  uninstallKey: string
): Promise<{
  installLocation: string | null;
  uninstallString: string | null;
  instanceLocations: string[];
}> {
  const output = await runPowerShell(
    [
      '$root = [Microsoft.Win32.Registry]::CurrentUser',
      '$install = $root.OpenSubKey($env:TEST_INSTALL_KEY)',
      '$uninstall = $root.OpenSubKey($env:TEST_UNINSTALL_KEY)',
      '$instances = $root.OpenSubKey(($env:TEST_INSTALL_KEY + ".Instances"))',
      'try {',
      '  $instanceLocations = @()',
      '  if ($null -ne $instances) {',
      '    foreach ($name in $instances.GetSubKeyNames()) {',
      '      $instance = $instances.OpenSubKey($name)',
      '      if ($null -ne $instance) {',
      '        try { $instanceLocations += [string]$instance.GetValue("InstallLocation", "") }',
      '        finally { $instance.Dispose() }',
      '      }',
      '    }',
      '  }',
      '  [pscustomobject]@{',
      '    installLocation = if ($null -eq $install) { $null } else { $install.GetValue("InstallLocation", $null) }',
      '    uninstallString = if ($null -eq $uninstall) { $null } else { $uninstall.GetValue("UninstallString", $null) }',
      '    instanceLocations = @($instanceLocations)',
      '  } | ConvertTo-Json -Compress',
      '} finally {',
      '  if ($null -ne $install) { $install.Dispose() }',
      '  if ($null -ne $uninstall) { $uninstall.Dispose() }',
      '  if ($null -ne $instances) { $instances.Dispose() }',
      '}'
    ].join('\n'),
    {
      ...process.env,
      TEST_INSTALL_KEY: installKey,
      TEST_UNINSTALL_KEY: uninstallKey
    }
  );
  const registration = JSON.parse(output) as {
    installLocation: string | null;
    uninstallString: string | null;
    instanceLocations?: string[];
  };
  return {
    ...registration,
    instanceLocations: registration.instanceLocations ?? []
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
      const registrationA = await readTestRegistration(installKey, uninstallKey);
      expect(registrationA.installLocation?.toLowerCase()).toBe(installA.toLowerCase());
      expect(registrationA.uninstallString?.toLowerCase()).toContain(
        uninstallerA.toLowerCase()
      );

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
      const registrationB = await readTestRegistration(installKey, uninstallKey);
      expect(registrationB.installLocation?.toLowerCase()).toBe(installB.toLowerCase());
      expect(registrationB.uninstallString?.toLowerCase()).toContain(
        uninstallerB.toLowerCase()
      );
      expect(registrationB.instanceLocations.map((path) => path.toLowerCase()).sort()).toEqual(
        [installA.toLowerCase(), installB.toLowerCase()].sort()
      );

      const uninstallB = await runExecutableResult(uninstallerB, ['/S', '/currentuser']);
      expect(uninstallB.exitCode).toBe(0);
      await waitForPath(installB, false);
      expect(existsSync(executableA)).toBe(true);
      expect(existsSync(uninstallerA)).toBe(true);
      expect(await readTestRegistration(installKey, uninstallKey)).toEqual(registrationA);

      const uninstallA = await runExecutableResult(uninstallerA, ['/S', '/currentuser']);
      expect(uninstallA.exitCode).toBe(0);
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

  it('binds an inactive A uninstaller to A and preserves active B', async () => {
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
    const fixture = await mkdtemp(join(testRoot, 'spellbook-nsis-inactive-first-'));
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
      const registrationBeforeUninstall = await readTestRegistration(
        installKey,
        uninstallKey
      );
      expect(registrationBeforeUninstall.installLocation?.toLowerCase()).toBe(
        installB.toLowerCase()
      );
      expect(
        registrationBeforeUninstall.instanceLocations
          .map((path) => path.toLowerCase())
          .sort()
      ).toEqual([installA.toLowerCase(), installB.toLowerCase()].sort());

      const uninstallA = await runExecutableResult(uninstallerA, ['/S', '/currentuser']);
      expect(uninstallA.exitCode).toBe(0);
      await waitForPath(installA, false);
      expect(existsSync(executableB)).toBe(true);
      expect(existsSync(uninstallerB)).toBe(true);

      const registrationAfterA = await readTestRegistration(installKey, uninstallKey);
      expect(registrationAfterA.installLocation?.toLowerCase()).toBe(
        installB.toLowerCase()
      );
      expect(registrationAfterA.uninstallString?.toLowerCase()).toContain(
        uninstallerB.toLowerCase()
      );
      expect(registrationAfterA.instanceLocations.map((path) => path.toLowerCase())).toEqual(
        [installB.toLowerCase()]
      );

      const uninstallB = await runExecutableResult(uninstallerB, ['/S', '/currentuser']);
      expect(uninstallB.exitCode).toBe(0);
      await waitForPath(installB, false);
      expect(await readTestRegistryState(installKey, uninstallKey)).toEqual({
        install: false,
        instances: false,
        uninstall: false
      });
    } finally {
      if (existsSync(uninstallerA)) {
        await runExecutable(uninstallerA, ['/S', '/currentuser']).catch(() => undefined);
        await waitForPath(installA, false).catch(() => undefined);
      }
      if (existsSync(uninstallerB)) {
        await runExecutable(uninstallerB, ['/S', '/currentuser']).catch(() => undefined);
        await waitForPath(installB, false).catch(() => undefined);
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

  it('fails an unavailable B target and restores A registration without a B instance', async () => {
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
    const fixture = await mkdtemp(join(testRoot, 'spellbook-nsis-rollback-'));
    const installA = join(fixture, 'A');
    const installB = join(fixture, 'B');
    const executableA = join(installA, `${productName}.exe`);
    const uninstallerA = join(installA, `Uninstall ${productName}.exe`);

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
      const registrationA = await readTestRegistration(installKey, uninstallKey);
      expect(registrationA.installLocation?.toLowerCase()).toBe(installA.toLowerCase());
      expect(registrationA.uninstallString?.toLowerCase()).toContain(
        uninstallerA.toLowerCase()
      );
      expect(
        registrationA.instanceLocations.some(
          (location) => location.toLowerCase() === installA.toLowerCase()
        )
      ).toBe(true);

      await writeFile(installB, 'occupied by an ordinary file');
      const failedInstall = await runExecutableResult(installer, [
        '/S',
        '/currentuser',
        '--no-desktop-shortcut',
        '--no-start-menu-shortcut',
        `/D=${installB}`
      ]);

      expect(failedInstall.exitCode).toBe(2);
      expect((await stat(installB)).isFile()).toBe(true);
      expect(existsSync(join(installB, `${productName}.exe`))).toBe(false);
      expect(
        existsSync(join(installB, '.spellbook-desktop-shortcut-owner.json'))
      ).toBe(false);
      expect(
        existsSync(join(installB, '.spellbook-start-menu-shortcut-owner.json'))
      ).toBe(false);
      expect(existsSync(executableA)).toBe(true);
      expect(existsSync(uninstallerA)).toBe(true);

      const registrationAfterFailure = await readTestRegistration(
        installKey,
        uninstallKey
      );
      expect(registrationAfterFailure).toEqual(registrationA);
      expect(
        registrationAfterFailure.instanceLocations.some(
          (location) => location.toLowerCase() === installB.toLowerCase()
        )
      ).toBe(false);

      await runExecutable(uninstallerA, ['/S', '/currentuser']);
      await waitForPath(installA, false);
      expect(await readTestRegistryState(installKey, uninstallKey)).toEqual({
        install: false,
        instances: false,
        uninstall: false
      });
    } finally {
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
