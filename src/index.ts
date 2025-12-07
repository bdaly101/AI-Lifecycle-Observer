/**
 * AI Lifecycle Observer
 * 
 * Self-learning observer agent that monitors AI dev lifecycle tools,
 * tracks execution metrics, detects improvement opportunities,
 * and manages urgent issue alerts.
 */

// Export types
export * from './types/index.js';

// Export config
export {
  loadConfig,
  configExists,
  findConfigFile,
  getConfigPath,
  expandPath,
  resolveEnvValue,
  DEFAULT_CONFIG,
  DEFAULT_ALERT_THRESHOLDS,
} from './config/index.js';

// Export utilities
export {
  createLogger,
  getLogger,
  initLogger,
  formatDuration,
  formatDate,
  formatDateTime,
  generateTimestampId,
  ensureDir,
  writeFileSafe,
  readFileOrNull,
  resolvePath,
} from './utils/index.js';

// Export database
export {
  initDatabase,
  getDatabase,
  closeDatabase,
  isDatabaseInitialized,
  transaction,
  // Repositories
  insertExecution,
  getExecutions,
  getRecentExecutions,
  getExecutionSummary,
  insertImprovement,
  getImprovements,
  getOpenImprovements,
  getUrgentImprovements,
  updateImprovement,
  insertAlert,
  getAlerts,
  getActiveAlerts,
  getCriticalAlerts,
  acknowledgeAlert,
  resolveAlert,
  getMetricsSnapshot,
  incrementExecutionMetrics,
} from './database/index.js';

