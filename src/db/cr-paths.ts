import path from 'path';

export function crRepoRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

export function defaultCrDatabasePath(): string {
  const override = process.env.CR_DATABASE_PATH?.trim();
  if (override) return override;
  return path.join(crRepoRoot(), 'db', 'cr.db');
}

export function migrationsDirectory(): string {
  return path.join(crRepoRoot(), 'db', 'migrations');
}
