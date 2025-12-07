#!/usr/bin/env node
/**
 * Database migration script
 * 
 * Usage:
 *   npm run db:migrate
 *   npx tsx src/database/migrate.ts
 */

import { initDatabase, getSchemaVersion, closeDatabase } from './connection.js';
import { loadConfig, expandPath } from '../config/index.js';
import { initLogger } from '../utils/logger.js';

async function main() {
  const logger = initLogger({ level: 'info' });

  try {
    // Load configuration
    const config = loadConfig();
    const dbPath = expandPath(config.database.path);

    logger.info({ path: dbPath }, 'Running database migrations');

    // Initialize database (runs migrations)
    initDatabase({
      path: dbPath,
      migrate: true,
      verbose: false,
    });

    const version = getSchemaVersion();
    logger.info({ version }, 'Database is at schema version');

    closeDatabase();
    logger.info('Migration complete');
  } catch (error) {
    logger.error({ error }, 'Migration failed');
    process.exit(1);
  }
}

main();

