import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';

export interface AppDatabase {
  run(sql: string, params?: unknown[]): void;
  all<T extends Record<string, unknown>>(sql: string, params?: unknown[]): T[];
  get<T extends Record<string, unknown>>(sql: string, params?: unknown[]): T | null;
  exportBytes(): Uint8Array;
  transaction<T>(operation: () => T | Promise<T>): Promise<T>;
}

export interface DatabaseFileOperations {
  read(path: string): Promise<Uint8Array>;
  makeDirectory(path: string): Promise<void>;
  write(path: string, bytes: Uint8Array): Promise<void>;
  replace(sourcePath: string, targetPath: string): Promise<void>;
  remove(path: string): Promise<void>;
}

const DEFAULT_FILE_OPERATIONS: DatabaseFileOperations = {
  async read(path) {
    return readFile(path);
  },
  async makeDirectory(path) {
    await mkdir(path, { recursive: true });
  },
  async write(path, bytes) {
    await writeFile(path, bytes);
  },
  async replace(sourcePath, targetPath) {
    await rename(sourcePath, targetPath);
  },
  async remove(path) {
    await rm(path, { force: true });
  }
};

let sqlModulePromise: Promise<SqlJsStatic> | null = null;

export async function createTestDatabase(): Promise<AppDatabase> {
  const SQL = await getSqlModule();
  return wrapDatabase(SQL, new SQL.Database(), null, DEFAULT_FILE_OPERATIONS);
}

export async function openAppDatabase(
  filePath: string,
  fileOperations: DatabaseFileOperations = DEFAULT_FILE_OPERATIONS
): Promise<AppDatabase> {
  const SQL = await getSqlModule();
  let db: SqlJsDatabase;
  try {
    const bytes = await fileOperations.read(filePath);
    db = new SQL.Database(bytes);
  } catch {
    db = new SQL.Database();
  }
  return wrapDatabase(SQL, db, filePath, fileOperations);
}

async function getSqlModule(): Promise<SqlJsStatic> {
  sqlModulePromise ??= initSqlJs({
    locateFile: (file) => join(process.cwd(), 'node_modules', 'sql.js', 'dist', file)
  });
  return sqlModulePromise;
}

function wrapDatabase(
  SQL: SqlJsStatic,
  initialDatabase: SqlJsDatabase,
  filePath: string | null,
  fileOperations: DatabaseFileOperations
): AppDatabase {
  let db = initialDatabase;
  let transactionQueue = Promise.resolve();
  createSchema(db);

  async function persist(bytes: Uint8Array): Promise<void> {
    if (!filePath) {
      return;
    }
    await fileOperations.makeDirectory(dirname(filePath));
    const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    try {
      await fileOperations.write(temporaryPath, bytes);
      await fileOperations.replace(temporaryPath, filePath);
    } finally {
      await fileOperations.remove(temporaryPath).catch(() => undefined);
    }
  }

  const appDatabase: AppDatabase = {
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
    transaction<T>(operation: () => T | Promise<T>): Promise<T> {
      const execute = async (): Promise<T> => {
        const snapshot = db.export();
        try {
          const result = await operation();
          await persist(db.export());
          return result;
        } catch (error) {
          db.close();
          db = new SQL.Database(snapshot);
          throw error;
        }
      };
      const result = transactionQueue.then(execute, execute);
      transactionQueue = result.then(
        () => undefined,
        () => undefined
      );
      return result;
    }
  };
  return appDatabase;
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

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

  `);

  ensureColumn(db, 'spells', 'is_favorite', 'INTEGER NOT NULL DEFAULT 0');
  db.exec('PRAGMA user_version = 9;');
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
