export type SkillPlatform = 'claude' | 'codex';

export type SkillSource = 'bundled' | 'local';

export type BundledSkillKey = 'prompt-refiner' | 'task-planner';

export type SkillInstallation =
  | { state: 'installed'; targetPath: string }
  | { state: 'missing'; targetPath: string }
  | { state: 'conflict'; targetPath: string; errorCode: 'target_conflict' }
  | {
      state: 'failed';
      targetPath: string;
      errorCode: 'permission_denied' | 'target_unreadable' | 'io_error';
    };

export interface SkillLibraryItem {
  id: string;
  source: SkillSource;
  directoryName: string;
  name: string;
  description: string;
  bundledKey?: BundledSkillKey;
  compatiblePlatforms: SkillPlatform[];
  discoveredPlatform?: SkillPlatform;
  rootPath?: string;
  entryFilePath: string;
  files: string[];
  fileCount: number;
  updatedAt?: string;
  packageable: boolean;
  packageUnavailableReason?: 'empty' | 'unreadable';
  stale?: boolean;
  installation: Record<SkillPlatform, SkillInstallation>;
}

export type SkillScanErrorCode =
  | 'permission_denied'
  | 'not_directory'
  | 'source_changed'
  | 'unsupported_entry'
  | 'path_escape'
  | 'io_error';

export interface SkillScanError {
  code: SkillScanErrorCode;
  path: string;
  retryable: boolean;
}

export type SkillScanSourceResult =
  | {
      platform: SkillPlatform;
      path: string;
      status: 'success' | 'missing_directory';
      refreshed: true;
      stale: false;
      skillCount: number;
    }
  | {
      platform: SkillPlatform;
      path: string;
      status: 'unreadable' | 'failed';
      refreshed: false;
      stale: true;
      cachedSkillCount: number;
      error: SkillScanError;
    };

export interface SkillScanSourceState {
  platform: SkillPlatform;
  path: string;
  status: 'never_scanned' | 'success' | 'missing_directory' | 'unreadable' | 'failed';
  stale: boolean;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  errorCode?: SkillScanErrorCode;
}

export interface SkillLibraryState {
  items: SkillLibraryItem[];
  sources: SkillScanSourceState[];
  localLoadError?: 'io_error';
}

export interface SkillScanResult {
  outcome: 'success' | 'partial' | 'failed';
  freshSkillCount: number;
  sources: SkillScanSourceResult[];
  library: SkillLibraryState;
}

export type SkillOperationErrorCode =
  | 'invalid_request'
  | 'skill_not_found'
  | 'operation_in_progress'
  | 'source_missing'
  | 'source_unreadable'
  | 'unsupported_entry'
  | 'target_conflict'
  | 'permission_denied'
  | 'copy_failed'
  | 'commit_failed'
  | 'empty_skill'
  | 'write_failed'
  | 'io_error';

export interface SkillOperationError {
  code: SkillOperationErrorCode;
  path?: string;
  retryable: boolean;
}

export interface InstallSkillRequest {
  skillId: string;
  platform: SkillPlatform;
}

export type InstallSkillResult =
  | {
      ok: true;
      skillId: string;
      platform: SkillPlatform;
      targetPath: string;
      item: SkillLibraryItem;
    }
  | {
      ok: false;
      skillId: string;
      platform?: SkillPlatform;
      error: SkillOperationError;
      item?: SkillLibraryItem;
    };

export interface PackageSkillRequest {
  skillId: string;
}

export type PackageSkillResult =
  | { ok: true; skillId: string; outputPath: string }
  | { ok: false; skillId: string; error: SkillOperationError };
