/**
 * Database module exports
 */

export {
  initDatabase,
  getDatabase,
  closeDatabase,
  isDatabaseInitialized,
  runMigrations,
  getSchemaVersion,
  executeRaw,
  transaction,
  cleanupOldData,
  type DatabaseOptions,
} from './connection.js';

export * from './repositories/index.js';

