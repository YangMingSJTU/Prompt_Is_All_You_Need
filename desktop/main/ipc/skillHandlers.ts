import type { IpcMain } from 'electron';
import type {
  InstallSkillRequest,
  InstallSkillResult,
  PackageSkillRequest,
  PackageSkillResult,
  SkillPlatform
} from '../../shared/skillTypes';
import type { SkillService } from '../services/skillService';

export function registerSkillHandlers(ipcMain: IpcMain, service: SkillService): void {
  ipcMain.handle('skills:getLibraryState', () => service.getLibraryState());
  ipcMain.handle('skills:scan', () => service.scanSkills());
  ipcMain.handle('skills:install', (_event, request: unknown): Promise<InstallSkillResult> => {
    if (!isInstallRequest(request)) {
      return Promise.resolve({
        ok: false,
        skillId: readSkillId(request),
        ...(readPlatform(request) ? { platform: readPlatform(request) } : {}),
        error: { code: 'invalid_request', retryable: false }
      });
    }
    return service.installSkill(request);
  });
  ipcMain.handle('skills:package', (_event, request: unknown): Promise<PackageSkillResult> => {
    if (!isPackageRequest(request)) {
      return Promise.resolve({
        ok: false,
        skillId: readSkillId(request),
        error: { code: 'invalid_request', retryable: false }
      });
    }
    return service.packageSkill(request);
  });
}

function isInstallRequest(value: unknown): value is InstallSkillRequest {
  return (
    isRecord(value) &&
    isSkillId(value.skillId) &&
    isSkillPlatform(value.platform) &&
    Object.keys(value).every((key) => key === 'skillId' || key === 'platform')
  );
}

function isPackageRequest(value: unknown): value is PackageSkillRequest {
  return (
    isRecord(value) &&
    isSkillId(value.skillId) &&
    Object.keys(value).every((key) => key === 'skillId')
  );
}

function readSkillId(value: unknown): string {
  return isRecord(value) && typeof value.skillId === 'string' ? value.skillId : '';
}

function readPlatform(value: unknown): SkillPlatform | undefined {
  return isRecord(value) && isSkillPlatform(value.platform) ? value.platform : undefined;
}

function isSkillId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200;
}

function isSkillPlatform(value: unknown): value is SkillPlatform {
  return value === 'claude' || value === 'codex';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
