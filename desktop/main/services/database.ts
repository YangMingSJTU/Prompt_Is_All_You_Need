import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';

export interface AppDatabase {
  run(sql: string, params?: unknown[]): void;
  all<T extends Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T extends Record<string, unknown>>(sql: string, params?: unknown[]): T | null;
  exportBytes(): Uint8Array;
  save(): Promise<void>;
}

export interface DatabaseWriteOperations {
  createParentDirectory(filePath: string): Promise<void>;
  writeFile(filePath: string, bytes: Uint8Array): Promise<void>;
}

export interface TestDatabaseOptions {
  filePath?: string;
  writeOperations?: DatabaseWriteOperations;
}

const sqlModulePromises = new Map<string, Promise<SqlJsStatic>>();

const nodeDatabaseWriteOperations: DatabaseWriteOperations = {
  async createParentDirectory(filePath) {
    await mkdir(dirname(filePath), { recursive: true });
  },
  async writeFile(filePath, bytes) {
    await writeFile(filePath, bytes);
  }
};

export async function createTestDatabase(
  options: TestDatabaseOptions = {}
): Promise<AppDatabase> {
  const SQL = await getSqlModule();
  return wrapDatabase(
    new SQL.Database(),
    options.filePath ?? null,
    options.writeOperations ?? nodeDatabaseWriteOperations
  );
}

export async function openAppDatabase(
  filePath: string,
  sqlWasmPath?: string
): Promise<AppDatabase> {
  const SQL = await getSqlModule(sqlWasmPath);
  let db: SqlJsDatabase;
  try {
    const bytes = await readFile(filePath);
    db = new SQL.Database(bytes);
  } catch {
    db = new SQL.Database();
  }
  return wrapDatabase(db, filePath, nodeDatabaseWriteOperations);
}

async function getSqlModule(sqlWasmPath = resolveInstalledSqlWasmPath()): Promise<SqlJsStatic> {
  let modulePromise = sqlModulePromises.get(sqlWasmPath);
  if (!modulePromise) {
    modulePromise = initSqlJs({ locateFile: () => sqlWasmPath });
    sqlModulePromises.set(sqlWasmPath, modulePromise);
  }
  return modulePromise;
}

function resolveInstalledSqlWasmPath(): string {
  return fileURLToPath(import.meta.resolve('sql.js/dist/sql-wasm.wasm'));
}

function wrapDatabase(
  db: SqlJsDatabase,
  filePath: string | null,
  writeOperations: DatabaseWriteOperations
): AppDatabase {
  createSchema(db);
  let pendingSave = Promise.resolve();
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
      const bytes = db.export();
      const save = pendingSave
        .catch(() => undefined)
        .then(async () => {
          await writeOperations.createParentDirectory(filePath);
          await writeOperations.writeFile(filePath, bytes);
        });
      pendingSave = save;
      await save;
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

  if (version > 0 && version < 8) {
    db.exec('DROP TABLE IF EXISTS candidates;');
  }

  if (hasColumn(db, 'spells', 'is_blocked')) {
    db.exec(`
      BEGIN TRANSACTION;
      CREATE TABLE spells_v9 (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        tags TEXT NOT NULL,
        source TEXT NOT NULL,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO spells_v9
        (id, name, body, tags, source, is_favorite, created_at, updated_at)
      SELECT id, name, body, tags, source, is_favorite, created_at, updated_at
      FROM spells;
      DROP TABLE spells;
      ALTER TABLE spells_v9 RENAME TO spells;
      COMMIT;
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

    CREATE TABLE IF NOT EXISTS skill_scan_sources (
      platform TEXT PRIMARY KEY CHECK (platform IN ('claude', 'codex')),
      root_path TEXT NOT NULL,
      last_attempt_status TEXT NOT NULL,
      last_attempt_at TEXT NOT NULL,
      last_success_at TEXT,
      last_error_code TEXT
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

  `);

  ensureColumn(db, 'spells', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
  db.exec('PRAGMA user_version = 10;');
}

function ensureColumn(
  db: SqlJsDatabase,
  tableName: 'spells',
  columnName: 'is_favorite',
  definition: string
): void {
  if (!hasColumn(db, tableName, columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

function hasColumn(db: SqlJsDatabase, tableName: 'spells', columnName: string): boolean {
  const columns = db.exec(`PRAGMA table_info(${tableName});`)[0]?.values ?? [];
  return columns.some((column) => column[1] === columnName);
}

function getUserVersion(db: SqlJsDatabase): number {
  const result = db.exec('PRAGMA user_version;')[0];
  const value = result?.values?.[0]?.[0];
  return typeof value === 'number' ? value : 0;
}
