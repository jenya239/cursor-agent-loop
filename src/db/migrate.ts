import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { defaultCrDatabasePath, migrationsDirectory } from './cr-paths';

const MIGRATION_FILE_PATTERN = /^(\d{3})_.+\.sql$/;

export type MigrateResult = {
  databasePath: string;
  applied: number[];
};

function listMigrationFiles(): string[] {
  const directory = migrationsDirectory();
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((name) => MIGRATION_FILE_PATTERN.test(name))
    .sort();
}

function parseMigrationVersion(filename: string): number {
  const match = filename.match(MIGRATION_FILE_PATTERN);
  if (!match) throw new Error(`invalid migration filename: ${filename}`);
  return Number.parseInt(match[1], 10);
}

function ensureSchemaMigrationsTable(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

export function migrate(databasePath = defaultCrDatabasePath()): MigrateResult {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  try {
    database.pragma('journal_mode = WAL');
    ensureSchemaMigrationsTable(database);
    const applied: number[] = [];
    const insert = database.prepare(
      'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
    );
    const hasVersion = database.prepare(
      'SELECT 1 AS present FROM schema_migrations WHERE version = ?'
    );
    for (const filename of listMigrationFiles()) {
      const version = parseMigrationVersion(filename);
      if (hasVersion.get(version)) continue;
      const sql = fs.readFileSync(path.join(migrationsDirectory(), filename), 'utf8');
      database.exec(sql);
      insert.run(version, filename);
      applied.push(version);
    }
    return { databasePath, applied };
  } finally {
    database.close();
  }
}

export function openCrDatabase(databasePath = defaultCrDatabasePath()): Database.Database {
  migrate(databasePath);
  return new Database(databasePath);
}
