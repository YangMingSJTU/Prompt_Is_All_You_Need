import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const makensis = process.env.SPELLBOOK_NSIS_MAKENSIS ?? '';
const describeNsis =
  process.platform === 'win32' ? describe : describe.skip;

interface ProbeObservation {
  actual: string;
  expected: string;
  matched: boolean;
}

interface ExecutableResult {
  exitCode: number;
  stderr: string;
}

function runExecutable(
  executable: string,
  args: string[],
  environment: NodeJS.ProcessEnv = process.env
): Promise<ExecutableResult> {
  return new Promise((resolveResult) => {
    execFile(
      executable,
      args,
      { env: environment, timeout: 60_000 },
      (error, _stdout, stderr) => {
        if (error) {
          const code = (error as { code?: string | number | null }).code;
          resolveResult({
            exitCode: typeof code === 'number' ? code : -1,
            stderr: error.message + '\n' + stderr
          });
          return;
        }
        resolveResult({ exitCode: 0, stderr });
      }
    );
  });
}

async function waitFor(
  predicate: () => boolean,
  description: string,
  timeout = 20_000
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for ' + description + '.');
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
}

function nsisPath(path: string): string {
  return path.replaceAll('"', '$\\"');
}

async function runProbe(
  root: string,
  legacyExedir: boolean
): Promise<{
  outerExitCode: number;
  observation: ProbeObservation;
  payloadExists: boolean;
  sectionRan: boolean;
}> {
  const variant = legacyExedir ? 'legacy-exedir' : 'fixed-outdir';
  const fixture = join(root, variant);
  const resources = join(fixture, 'resources');
  const source = join(fixture, 'probe.nsi');
  const installer = join(fixture, 'probe-installer.exe');
  const uninstaller = join(fixture, 'probe-uninstaller.exe');
  const payload = join(fixture, 'payload.txt');
  const sectionMarker = join(fixture, 'uninstall-section-ran.txt');
  const observationFile = join(fixture, 'validation.json');
  const include = resolve(process.cwd(), 'build', 'installer.nsh');

  await mkdir(resources, { recursive: true });
  await writeFile(
    join(resources, 'installationRegistry.ps1'),
    [
      "$ErrorActionPreference = 'Stop'",
      '$actual = [IO.Path]::GetFullPath($env:SPELLBOOK_INSTALL_PATH).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)',
      '$expected = [IO.Path]::GetFullPath($env:SPELLBOOK_PROBE_EXPECTED_TARGET).TrimEnd([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)',
      '$matched = [string]::Equals($actual, $expected, [StringComparison]::OrdinalIgnoreCase)',
      '$result = [pscustomobject]@{ actual = $actual; expected = $expected; matched = $matched } | ConvertTo-Json -Compress',
      '[IO.File]::WriteAllText($env:SPELLBOOK_PROBE_RESULT, $result, [Text.UTF8Encoding]::new($false))',
      'if (-not $matched) { exit 23 }'
    ].join('\n')
  );

  const uninit = legacyExedir
    ? [
        '  !insertmacro runInstallationRegistry "validate-uninstall" "$EXEDIR"',
        '  StrCpy $INSTDIR "$EXEDIR"'
      ]
    : ['  !insertmacro customUnInit'];
  await writeFile(
    source,
    [
      'Unicode true',
      'SilentInstall silent',
      'SilentUnInstall silent',
      'RequestExecutionLevel user',
      '!include "LogicLib.nsh"',
      '!define BUILD_UNINSTALLER',
      '!define BUILD_RESOURCES_DIR "' + nsisPath(resources) + '"',
      '!define APP_EXECUTABLE_FILENAME "Spellbook.exe"',
      '!define UNINSTALL_FILENAME "probe-uninstaller.exe"',
      '!define INSTALL_REGISTRY_KEY "Software\\SpellbookNsisProbe"',
      '!define UNINSTALL_REGISTRY_KEY "Software\\SpellbookNsisProbeUninstall"',
      'Var installMode',
      '!include "' + nsisPath(include) + '"',
      'OutFile "' + nsisPath(installer) + '"',
      'Section',
      '  WriteUninstaller "$EXEDIR\\probe-uninstaller.exe"',
      'SectionEnd',
      'Function un.onInit',
      '  SetOutPath $INSTDIR',
      '  StrCpy $INSTDIR "$TEMP\\spellbook-active-instance-decoy"',
      '  StrCpy $installMode "CurrentUser"',
      ...uninit,
      'FunctionEnd',
      'Section "Uninstall"',
      '  Delete "$INSTDIR\\payload.txt"',
      '  FileOpen $0 "$INSTDIR\\uninstall-section-ran.txt" w',
      '  FileWrite $0 "ran"',
      '  FileClose $0',
      'SectionEnd'
    ].join('\n')
  );

  const compile = await runExecutable(makensis, ['/V2', source]);
  if (compile.exitCode !== 0) {
    throw new Error('makensis failed for ' + variant + '.\n' + compile.stderr);
  }
  const generate = await runExecutable(installer, ['/S']);
  if (generate.exitCode !== 0) {
    throw new Error(
      'Probe installer failed for ' + variant + '.\n' + generate.stderr
    );
  }
  await writeFile(payload, 'must be removed only by the real uninstall section');

  const uninstall = await runExecutable(
    uninstaller,
    ['/S'],
    {
      ...process.env,
      SPELLBOOK_PROBE_EXPECTED_TARGET: fixture,
      SPELLBOOK_PROBE_RESULT: observationFile
    }
  );
  await waitFor(
    () => existsSync(observationFile),
    variant + ' validation observation'
  );
  if (!legacyExedir) {
    await waitFor(
      () => existsSync(sectionMarker) && !existsSync(payload),
      variant + ' uninstall section completion'
    );
  } else {
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }

  return {
    outerExitCode: uninstall.exitCode,
    observation: JSON.parse(
      await readFile(observationFile, 'utf8')
    ) as ProbeObservation,
    payloadExists: existsSync(payload),
    sectionRan: existsSync(sectionMarker)
  };
}

describeNsis('NSIS standard silent uninstall execution', () => {
  it('reproduces the EXEDIR no-op and binds the fixed flow to the original uninstaller directory', async () => {
    expect(existsSync(makensis)).toBe(true);
    const testRoot = process.env.SPELLBOOK_NSIS_TEST_ROOT ?? tmpdir();
    await mkdir(testRoot, { recursive: true });
    const fixture = await mkdtemp(
      join(testRoot, 'spellbook-nsis-uninstall-execution-')
    );

    try {
      const legacy = await runProbe(fixture, true);
      expect(legacy.outerExitCode).toBe(0);
      expect(legacy.observation.matched).toBe(false);
      expect(legacy.observation.actual.toLowerCase()).not.toBe(
        legacy.observation.expected.toLowerCase()
      );
      expect(legacy.payloadExists).toBe(true);
      expect(legacy.sectionRan).toBe(false);

      const fixed = await runProbe(fixture, false);
      expect(fixed.outerExitCode).toBe(0);
      expect(fixed.observation.matched).toBe(true);
      expect(fixed.observation.actual.toLowerCase()).toBe(
        fixed.observation.expected.toLowerCase()
      );
      expect(fixed.payloadExists).toBe(false);
      expect(fixed.sectionRan).toBe(true);
    } finally {
      await rm(fixture, {
        recursive: true,
        force: true,
        maxRetries: 20,
        retryDelay: 200
      });
    }
  }, 120_000);
});
