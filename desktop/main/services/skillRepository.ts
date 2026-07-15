import type {
  SkillPlatform,
  SkillScanErrorCode,
  SkillScanSourceResult,
  SkillScanSourceState
} from '../../shared/skillTypes';
import type { AppDatabase } from './database';
import type {
  LocalSkillSnapshot,
  SkillRoot,
  SkillRootScanResult
} from './skillScanner';

interface SkillRow extends Record<string, unknown> {
  id: string;
  platform: string;
  name: string;
  description: string;
  root_path: string;
  entry_file_path: string;
  file_count: number;
  files: string;
  updated_at: string;
  packageable: number;
}

interface SourceRow extends Record<string, unknown> {
  platform: string;
  root_path: string;
  last_attempt_status: string;
  last_attempt_at: string;
  last_success_at: string | null;
  last_error_code: string | null;
}

export interface SkillRepository {
  listLocalSkills(): LocalSkillSnapshot[];
  getLocalSkill(id: string): LocalSkillSnapshot | null;
  listSourceStates(roots: SkillRoot[]): SkillScanSourceState[];
  commitScan(results: SkillRootScanResult[]): Promise<SkillScanSourceResult[]>;
}

export function createSkillRepository(db: AppDatabase): SkillRepository {
  return {
    listLocalSkills() {
      return db
        .all<SkillRow>('SELECT * FROM skills ORDER BY platform ASC, name ASC')
        .map(rowToSkill);
    },

    getLocalSkill(id) {
      const row = db.get<SkillRow>('SELECT * FROM skills WHERE id = ?', [id]);
      return row ? rowToSkill(row) : null;
    },

    listSourceStates(roots) {
      const rows = db.all<SourceRow>('SELECT * FROM skill_scan_sources');
      const byPlatform = new Map(
        rows.map((row) => [row.platform as SkillPlatform, sourceRowToState(row)])
      );
      return roots.map(
        (root) =>
          byPlatform.get(root.platform) ?? {
            platform: root.platform,
            path: root.path,
            status: 'never_scanned',
            stale: false
          }
      );
    },

    async commitScan(results) {
      const cachedCounts = new Map<SkillPlatform, number>();
      for (const platform of ['claude', 'codex'] as const) {
        cachedCounts.set(
          platform,
          Number(
            db.get<{ count: number }>(
              'SELECT COUNT(*) AS count FROM skills WHERE platform = ?',
              [platform]
            )?.count ?? 0
          )
        );
      }

      const now = new Date().toISOString();
      db.run('BEGIN TRANSACTION');
      try {
        for (const result of results) {
          if (result.status === 'success' || result.status === 'missing_directory') {
            db.run('DELETE FROM skills WHERE platform = ?', [result.platform]);
            for (const skill of result.skills) {
              insertSkill(db, skill);
            }
          }
          const previous = db.get<SourceRow>(
            'SELECT * FROM skill_scan_sources WHERE platform = ?',
            [result.platform]
          );
          const authoritative = 'skills' in result;
          db.run(
            `INSERT OR REPLACE INTO skill_scan_sources
              (platform, root_path, last_attempt_status, last_attempt_at, last_success_at, last_error_code)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
              result.platform,
              result.path,
              result.status,
              now,
              authoritative ? now : previous?.last_success_at ?? null,
              authoritative ? null : result.error.code
            ]
          );
        }
        db.run('COMMIT');
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }
      await db.save();

      return results.map((result): SkillScanSourceResult => {
        if ('skills' in result) {
          return {
            platform: result.platform,
            path: result.path,
            status: result.status,
            refreshed: true,
            stale: false,
            skillCount: result.skills.length
          };
        }
        return {
          platform: result.platform,
          path: result.path,
          status: result.status,
          refreshed: false,
          stale: true,
          cachedSkillCount: cachedCounts.get(result.platform) ?? 0,
          error: result.error
        };
      });
    }
  };
}

function insertSkill(db: AppDatabase, skill: LocalSkillSnapshot): void {
  db.run(
    `INSERT OR REPLACE INTO skills
      (id, platform, name, description, root_path, entry_file_path, file_count, files, updated_at, packageable, install_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      skill.id,
      skill.platform,
      skill.name,
      skill.description,
      skill.rootPath,
      skill.entryFilePath,
      skill.files.length,
      JSON.stringify(skill.files),
      skill.updatedAt,
      skill.packageable ? 1 : 0,
      'installed'
    ]
  );
}

function rowToSkill(row: SkillRow): LocalSkillSnapshot {
  const files = parseFiles(row.files);
  return {
    id: row.id,
    platform: row.platform as SkillPlatform,
    directoryName: row.root_path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? row.name,
    name: row.name,
    description: row.description,
    rootPath: row.root_path,
    entryFilePath: row.entry_file_path,
    files,
    updatedAt: row.updated_at,
    packageable: row.packageable === 1 && files.length > 0
  };
}

function sourceRowToState(row: SourceRow): SkillScanSourceState {
  const status = isSourceStatus(row.last_attempt_status)
    ? row.last_attempt_status
    : 'failed';
  return {
    platform: row.platform as SkillPlatform,
    path: row.root_path,
    status,
    stale: status === 'unreadable' || status === 'failed',
    lastAttemptAt: row.last_attempt_at,
    lastSuccessAt: row.last_success_at ?? undefined,
    errorCode: isScanErrorCode(row.last_error_code) ? row.last_error_code : undefined
  };
}

function parseFiles(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((file): file is string => typeof file === 'string')
      : [];
  } catch {
    return [];
  }
}

function isSourceStatus(
  value: string
): value is SkillScanSourceState['status'] {
  return (
    value === 'never_scanned' ||
    value === 'success' ||
    value === 'missing_directory' ||
    value === 'unreadable' ||
    value === 'failed'
  );
}

function isScanErrorCode(value: string | null): value is SkillScanErrorCode {
  return (
    value === 'permission_denied' ||
    value === 'not_directory' ||
    value === 'source_changed' ||
    value === 'unsupported_entry' ||
    value === 'path_escape' ||
    value === 'io_error'
  );
}
