import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';

export interface AppDatabase {
  run(sql: string, params?: unknown[]): void;
  all<T extends Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T extends Record<string, unknown>>(sql: string, params?: unknown[]): T | null;
  exportBytes(): Uint8Array;
  save(): Promise<void>;
}

let sqlModulePromise: Promise<SqlJsStatic> | null = null;

export async function createTestDatabase(): Promise<AppDatabase> {
  const SQL = await getSqlModule();
  return wrapDatabase(new SQL.Database(), null);
}

export async function openAppDatabase(filePath: string): Promise<AppDatabase> {
  const SQL = await getSqlModule();
  let db: SqlJsDatabase;
  try {
    const bytes = await readFile(filePath);
    db = new SQL.Database(bytes);
  } catch {
    db = new SQL.Database();
  }
  return wrapDatabase(db, filePath);
}

async function getSqlModule(): Promise<SqlJsStatic> {
  sqlModulePromise ??= initSqlJs({
    locateFile: (file) => join(process.cwd(), 'node_modules', 'sql.js', 'dist', file)
  });
  return sqlModulePromise;
}

function wrapDatabase(db: SqlJsDatabase, filePath: string | null): AppDatabase {
  createSchema(db);
  return {
    run(sql: string, params: unknown[] = []) {
      db.run(sql, params as never[]);
    },
    all<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const statement = db.prepare(sql);
      const rows: T[] = [];
      try {
        statement.bind(params as never[]);
        while (statement.step()) {
          rows.push(statement.getAsObject() as T);
        }
      } finally {
        statement.free();
      }
      return rows;
    },
    get<T extends Record<string, unknown>>(sql: string, params: unknown[] = []) {
      return this.all<T>(sql, params)[0] ?? null;
    },
    exportBytes() {
      return db.export();
    },
    async save() {
      if (!filePath) {
        return;
      }
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, db.export());
    }
  };
}

function createSchema(db: SqlJsDatabase): void {
  const version = getUserVersion(db);
  if (version > 0 && version < 6) {
    db.exec(`
      DROP TABLE IF EXISTS spells;
      DROP TABLE IF EXISTS candidates;
      DROP TABLE IF EXISTS usage_events;
      DROP TABLE IF EXISTS source_files;
      DROP TABLE IF EXISTS skills;
      DROP TABLE IF EXISTS app_settings;
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS spells (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      tags TEXT NOT NULL,
      source TEXT NOT NULL,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_blocked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS candidates (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      template TEXT NOT NULL,
      candidate_type TEXT NOT NULL,
      source_count INTEGER NOT NULL,
      score REAL NOT NULL,
      status TEXT NOT NULL,
      examples TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_events (
      id TEXT PRIMARY KEY,
      spell_id TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS source_files (
      id TEXT PRIMARY KEY,
      source_tool TEXT NOT NULL,
      path TEXT NOT NULL,
      status TEXT NOT NULL,
      line_count INTEGER NOT NULL,
      prompt_count INTEGER NOT NULL,
      warning_count INTEGER NOT NULL,
      scanned_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      platform TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      root_path TEXT NOT NULL,
      entry_file_path TEXT NOT NULL,
      file_count INTEGER NOT NULL,
      files TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      packageable INTEGER NOT NULL,
      install_state TEXT NOT NULL,
      UNIQUE(platform, root_path)
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

  `);

  ensureColumn(db, 'spells', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'spells', 'is_blocked', 'INTEGER NOT NULL DEFAULT 0');
  db.exec('PRAGMA user_version = 7;');
}

function ensureColumn(
  db: SqlJsDatabase,
  tableName: 'spells',
  columnName: 'is_favorite' | 'is_blocked',
  definition: string
): void {
  const columns = db.exec(`PRAGMA table_info(${tableName});`)[0]?.values ?? [];
  if (!columns.some((column) => column[1] === columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function getUserVersion(db: SqlJsDatabase): number {
  const result = db.exec('PRAGMA user_version;')[0];
  const value = result?.values?.[0]?.[0];
  return typeof value === 'number' ? value : 0;
}
