import { mkdir, stat, writeFile } from 'node:fs/promises';
import type { DesktopPlatform } from '../../shared/platform';
import type { PlatformPathContext, PlatformPaths } from './platformPaths';

export interface PackagedSmokeInput {
  platform: DesktopPlatform;
  isPackaged: boolean;
  paths: PlatformPaths;
  pathContext: PlatformPathContext;
  sqlWasmPath: string;
  trayIconPath: string;
  windowsIconPath?: string;
}

export interface PackagedSmokeEvidence {
  platform: DesktopPlatform;
  isPackaged: boolean;
  userDataDirectory: string;
  databasePath: string;
  packageDirectory: string;
  resources: {
    sqlWasmPath: string;
    trayIconPath: string;
    windowsIconPath?: string;
  };
  checks: {
    databaseCreated: boolean;
    packageDirectoryCreated: boolean;
    sqlWasmLoaded: boolean;
    trayIconLoaded: boolean;
    windowsIconLoaded: boolean;
    dataInsideUserData: boolean;
  };
  passed: boolean;
}

export async function writePackagedSmokeEvidence(
  outputPath: string,
  input: PackagedSmokeInput
): Promise<PackagedSmokeEvidence> {
  const evidence = await createPackagedSmokeEvidence(input);
  await mkdir(input.pathContext.path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  return evidence;
}

export async function createPackagedSmokeEvidence(
  input: PackagedSmokeInput
): Promise<PackagedSmokeEvidence> {
  const [databaseCreated, packageDirectoryCreated, sqlWasmLoaded, trayIconLoaded, windowsIconLoaded] =
    await Promise.all([
      pathExists(input.paths.databasePath),
      directoryExists(input.paths.packageDirectory),
      pathExists(input.sqlWasmPath),
      pathExists(input.trayIconPath),
      input.windowsIconPath ? pathExists(input.windowsIconPath) : Promise.resolve(true)
    ]);
  const relativeDataPath = input.pathContext.path.relative(
    input.paths.userDataDirectory,
    input.paths.dataDirectory
  );
  const dataInsideUserData =
    relativeDataPath.length > 0 &&
    relativeDataPath !== '..' &&
    !relativeDataPath.startsWith(`..${input.pathContext.path.sep}`) &&
    !input.pathContext.path.isAbsolute(relativeDataPath);
  const checks = {
    databaseCreated,
    packageDirectoryCreated,
    sqlWasmLoaded,
    trayIconLoaded,
    windowsIconLoaded,
    dataInsideUserData
  };
  return {
    platform: input.platform,
    isPackaged: input.isPackaged,
    userDataDirectory: input.paths.userDataDirectory,
    databasePath: input.paths.databasePath,
    packageDirectory: input.paths.packageDirectory,
    resources: {
      sqlWasmPath: input.sqlWasmPath,
      trayIconPath: input.trayIconPath,
      ...(input.windowsIconPath ? { windowsIconPath: input.windowsIconPath } : {})
    },
    checks,
    passed: input.isPackaged && Object.values(checks).every(Boolean)
  };
}

async function pathExists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

async function directoryExists(path: string): Promise<boolean> {
  return stat(path).then((value) => value.isDirectory(), () => false);
}
