import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const describeWindows = process.platform === 'win32' ? describe : describe.skip;
const registryScript = join(process.cwd(), 'build', 'installationRegistry.ps1');

interface RegistryFixture {
  installKey: string;
  uninstallKey: string;
  instancesKey: string;
}

function runPowerShell(
  args: string[],
  environment: NodeJS.ProcessEnv = process.env
): Promise<string> {
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

async function runRegistry(
  action: 'prepare' | 'installed' | 'uninstalled' | 'rollback',
  installPath: string,
  fixture: RegistryFixture
): Promise<void> {
  await runPowerShell([
    '-File',
    registryScript,
    '-Action',
    action,
    '-RegistryRoot',
    'HKCU',
    '-InstallKeyPath',
    fixture.installKey,
    '-UninstallKeyPath',
    fixture.uninstallKey,
    '-InstancesKeyPath',
    fixture.instancesKey,
    '-InstallPath',
    installPath,
    '-InstalledExecutablePath',
    join(installPath, 'Spellbook.exe'),
    '-UninstallerPath',
    join(installPath, 'Uninstall Spellbook.exe')
  ]);
}

async function writeInstalledArtifacts(installPath: string): Promise<void> {
  await mkdir(installPath, { recursive: true });
  await writeFile(join(installPath, 'Spellbook.exe'), 'application');
  await writeFile(join(installPath, 'Uninstall Spellbook.exe'), 'uninstaller');
}

async function writeRegistration(
  installPath: string,
  fixture: RegistryFixture,
  version: string
): Promise<void> {
  await runPowerShell(
    [
      '-Command',
      [
        '$install = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($env:TEST_INSTALL_KEY)',
        'try {',
        '  $install.SetValue("InstallLocation", $env:TEST_INSTALL_PATH, [Microsoft.Win32.RegistryValueKind]::String)',
        '  $install.SetValue("KeepShortcuts", "true", [Microsoft.Win32.RegistryValueKind]::String)',
        '} finally { $install.Dispose() }',
        '$uninstall = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($env:TEST_UNINSTALL_KEY)',
        'try {',
        '  $uninstall.SetValue("UninstallString", (Join-Path $env:TEST_INSTALL_PATH "Uninstall Spellbook.exe"), [Microsoft.Win32.RegistryValueKind]::String)',
        '  $uninstall.SetValue("DisplayVersion", $env:TEST_VERSION, [Microsoft.Win32.RegistryValueKind]::String)',
        '  $uninstall.SetValue("EstimatedSize", 321, [Microsoft.Win32.RegistryValueKind]::DWord)',
        '} finally { $uninstall.Dispose() }'
      ].join('; ')
    ],
    {
      ...process.env,
      TEST_INSTALL_KEY: fixture.installKey,
      TEST_UNINSTALL_KEY: fixture.uninstallKey,
      TEST_INSTALL_PATH: installPath,
      TEST_VERSION: version
    }
  );
}

async function removeSingletonRegistration(fixture: RegistryFixture): Promise<void> {
  await runPowerShell(
    [
      '-Command',
      '[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($env:TEST_INSTALL_KEY, $false); [Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($env:TEST_UNINSTALL_KEY, $false)'
    ],
    {
      ...process.env,
      TEST_INSTALL_KEY: fixture.installKey,
      TEST_UNINSTALL_KEY: fixture.uninstallKey
    }
  );
}

function getInstanceId(installPath: string): string {
  const normalized = installPath.replace(/[\\/]+$/, '').toUpperCase();
  return createHash('sha256').update(normalized, 'utf8').digest('hex').toUpperCase();
}

async function writePartiallyInvalidInstance(
  installPath: string,
  fixture: RegistryFixture
): Promise<void> {
  const installValues = JSON.stringify([
    { name: 'InstallLocation', kind: 'String', value: installPath }
  ]);
  const uninstallValues = JSON.stringify([
    { name: 'UninstallString', kind: 'InvalidKind', value: 'invalid' }
  ]);
  await runPowerShell(
    [
      '-Command',
      [
        '$instance = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey($env:TEST_INSTANCE_KEY)',
        'try {',
        '  $instance.SetValue("InstallLocation", $env:TEST_INSTALL_PATH, [Microsoft.Win32.RegistryValueKind]::String)',
        '  $instance.SetValue("InstallValues", $env:TEST_INSTALL_VALUES, [Microsoft.Win32.RegistryValueKind]::String)',
        '  $instance.SetValue("UninstallValues", $env:TEST_UNINSTALL_VALUES, [Microsoft.Win32.RegistryValueKind]::String)',
        '  $instance.SetValue("UpdatedAt", [DateTime]::UtcNow.Ticks, [Microsoft.Win32.RegistryValueKind]::QWord)',
        '} finally { $instance.Dispose() }'
      ].join('; ')
    ],
    {
      ...process.env,
      TEST_INSTANCE_KEY: `${fixture.instancesKey}\\${getInstanceId(installPath)}`,
      TEST_INSTALL_PATH: installPath,
      TEST_INSTALL_VALUES: installValues,
      TEST_UNINSTALL_VALUES: uninstallValues
    }
  );
}

async function readRegistration(fixture: RegistryFixture): Promise<{
  installLocation: string | null;
  displayVersion: string | null;
  estimatedSize: number | null;
}> {
  const output = await runPowerShell(
    [
      '-Command',
      [
        '$install = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($env:TEST_INSTALL_KEY)',
        '$uninstall = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey($env:TEST_UNINSTALL_KEY)',
        'try {',
        '  $installLocation = if ($null -eq $install) { $null } else { $install.GetValue("InstallLocation", $null) }',
        '  $displayVersion = if ($null -eq $uninstall) { $null } else { $uninstall.GetValue("DisplayVersion", $null) }',
        '  $estimatedSize = if ($null -eq $uninstall) { $null } else { $uninstall.GetValue("EstimatedSize", $null) }',
        '  [pscustomobject]@{',
        '    installLocation = $installLocation',
        '    displayVersion = $displayVersion',
        '    estimatedSize = $estimatedSize',
        '  } | ConvertTo-Json -Compress',
        '} finally { if ($null -ne $install) { $install.Dispose() }; if ($null -ne $uninstall) { $uninstall.Dispose() } }'
      ].join('\n')
    ],
    {
      ...process.env,
      TEST_INSTALL_KEY: fixture.installKey,
      TEST_UNINSTALL_KEY: fixture.uninstallKey
    }
  );
  return JSON.parse(output) as {
    installLocation: string | null;
    displayVersion: string | null;
    estimatedSize: number | null;
  };
}

async function cleanupRegistry(fixture: RegistryFixture): Promise<void> {
  await runPowerShell(
    [
      '-Command',
      '[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKeyTree($env:TEST_ROOT_KEY, $false)'
    ],
    {
      ...process.env,
      TEST_ROOT_KEY: fixture.installKey.slice(0, fixture.installKey.lastIndexOf('\\'))
    }
  );
}

describeWindows('Windows installation registry isolation', () => {
  it('preserves A while installing B and restores A when B is uninstalled first', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'spellbook-install-registry-'));
    const rootKey = `Software\\SpellbookTests\\${randomUUID()}`;
    const fixture = {
      installKey: `${rootKey}\\Install`,
      uninstallKey: `${rootKey}\\Uninstall`,
      instancesKey: `${rootKey}\\Instances`
    };
    const installA = join(directory, 'A');
    const installB = join(directory, 'B');

    try {
      await writeInstalledArtifacts(installA);
      await writeInstalledArtifacts(installB);

      await writeRegistration(installA, fixture, 'A');
      await runRegistry('installed', installA, fixture);
      await runRegistry('prepare', installA, fixture);
      expect(await readRegistration(fixture)).toEqual({
        installLocation: installA,
        displayVersion: 'A',
        estimatedSize: 321
      });

      await runRegistry('prepare', installB, fixture);
      expect(await readRegistration(fixture)).toEqual({
        installLocation: null,
        displayVersion: null,
        estimatedSize: null
      });

      await runRegistry('rollback', installB, fixture);
      expect((await readRegistration(fixture)).installLocation).toBe(installA);

      await runRegistry('prepare', installB, fixture);
      await writeRegistration(installB, fixture, 'B');
      await runRegistry('installed', installB, fixture);
      expect((await readRegistration(fixture)).installLocation).toBe(installB);

      await removeSingletonRegistration(fixture);
      await runRegistry('uninstalled', installB, fixture);
      expect(await readRegistration(fixture)).toEqual({
        installLocation: installA,
        displayVersion: 'A',
        estimatedSize: 321
      });

      await removeSingletonRegistration(fixture);
      await runRegistry('uninstalled', installA, fixture);
      expect(await readRegistration(fixture)).toEqual({
        installLocation: null,
        displayVersion: null,
        estimatedSize: null
      });
    } finally {
      await cleanupRegistry(fixture);
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);

  it('restores A when the installer registration exists but committed artifacts are missing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'spellbook-install-registry-'));
    const rootKey = `Software\\SpellbookTests\\${randomUUID()}`;
    const fixture = {
      installKey: `${rootKey}\\Install`,
      uninstallKey: `${rootKey}\\Uninstall`,
      instancesKey: `${rootKey}\\Instances`
    };
    const installA = join(directory, 'A');
    const installB = join(directory, 'B');

    try {
      await writeInstalledArtifacts(installA);
      await mkdir(installB);
      await writeRegistration(installA, fixture, 'A');
      await runRegistry('installed', installA, fixture);

      await runRegistry('prepare', installB, fixture);
      await writeRegistration(installB, fixture, 'B');
      await expect(runRegistry('installed', installB, fixture)).rejects.toThrow(
        /application executable[\s\S]+is missing/
      );
      expect(await readRegistration(fixture)).toEqual({
        installLocation: installA,
        displayVersion: 'A',
        estimatedSize: 321
      });
    } finally {
      await cleanupRegistry(fixture);
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);

  it('restores the original singleton registration after a partial prepare write', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'spellbook-install-registry-'));
    const rootKey = `Software\\SpellbookTests\\${randomUUID()}`;
    const fixture = {
      installKey: `${rootKey}\\Install`,
      uninstallKey: `${rootKey}\\Uninstall`,
      instancesKey: `${rootKey}\\Instances`
    };
    const installA = join(directory, 'A');
    const installB = join(directory, 'B');

    try {
      await writeInstalledArtifacts(installA);
      await mkdir(installB);
      await writeRegistration(installA, fixture, 'A');
      await runRegistry('installed', installA, fixture);
      await writePartiallyInvalidInstance(installB, fixture);

      await expect(runRegistry('prepare', installB, fixture)).rejects.toThrow();
      expect(await readRegistration(fixture)).toEqual({
        installLocation: installA,
        displayVersion: 'A',
        estimatedSize: 321
      });

      await runRegistry('rollback', installB, fixture);
      expect((await readRegistration(fixture)).installLocation).toBe(installA);
    } finally {
      await cleanupRegistry(fixture);
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);
});
