/**
 * Database connection manager using better-sqlite3
 */

import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureParentDir } from '../utils/fs.js';
import { getLogger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Database connection options
 */
export interface DatabaseOptions {
  /** Path to the database file */
  path: string;
  /** Whether to run migrations on connect */
  migrate?: boolean;
  /** Enable verbose logging */
  verbose?: boolean;
}

/**
 * Database connection singleton
 */
let db: Database.Database | null = null;

/**
 * Get the current database connection
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Check if database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return db !== null;
}

/**
 * Initialize the database connection
 */
export function initDatabase(options: DatabaseOptions): Database.Database {
  const { path: dbPath, migrate = true, verbose = false } = options;
  const logger = getLogger();

  // Ensure parent directory exists
  ensureParentDir(dbPath);

  // Create or open database
  db = new Database(dbPath, {
    verbose: verbose ? (message) => logger.debug({ sql: message }, 'SQL') : undefined,
  });

  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Run migrations if enabled
  if (migrate) {
    runMigrations(db);
  }

  logger.info({ path: dbPath }, 'Database initialized');

  return db;
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    getLogger().info('Database connection closed');
  }
}

/**
 * Run database migrations
 */
export function runMigrations(database: Database.Database): void {
  const logger = getLogger();
  const migrationsDir = join(__dirname, 'migrations');

  // Get current schema version
  let currentVersion = 0;
  try {
    const result = database
      .prepare('SELECT MAX(version) as version FROM schema_migrations')
      .get() as { version: number | null } | undefined;
    currentVersion = result?.version ?? 0;
  } catch {
    // Table doesn't exist yet, version is 0
    currentVersion = 0;
  }

  logger.debug({ currentVersion }, 'Current schema version');

  // Find migration files
  const migrationFiles = [
    { version: 1, file: '001_initial.sql' },
    // Add more migrations here as needed
  ];

  // Run pending migrations
  for (const migration of migrationFiles) {
    if (migration.version > currentVersion) {
      const migrationPath = join(migrationsDir, migration.file);
      
      if (!existsSync(migrationPath)) {
        logger.warn({ migration: migration.file }, 'Migration file not found');
        continue;
      }

      logger.info({ version: migration.version, file: migration.file }, 'Running migration');

      const sql = readFileSync(migrationPath, 'utf-8');
      
      // Execute migration in a transaction
      database.exec(sql);
      
      logger.info({ version: migration.version }, 'Migration completed');
    }
  }
}

/**
 * Get schema version
 */
export function getSchemaVersion(): number {
  const database = getDatabase();
  try {
    const result = database
      .prepare('SELECT MAX(version) as version FROM schema_migrations')
      .get() as { version: number | null } | undefined;
    return result?.version ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Execute a raw SQL query
 */
export function executeRaw(sql: string): void {
  getDatabase().exec(sql);
}

/**
 * Run a function within a transaction
 */
export function transaction<T>(fn: () => T): T {
  const database = getDatabase();
  return database.transaction(fn)();
}

/**
 * Clean up old data based on retention policy
 */
export function cleanupOldData(retentionDays: number): { executionsDeleted: number } {
  const database = getDatabase();
  const cutoffTimestamp = Math.floor(Date.now() / 1000) - retentionDays * 24 * 60 * 60;

  const result = database
    .prepare('DELETE FROM executions WHERE timestamp < ?')
    .run(cutoffTimestamp);

  return { executionsDeleted: result.changes };
}

