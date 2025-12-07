/**
 * Repository module exports
 */

export {
  insertExecution,
  getExecutionById,
  getExecutions,
  getRecentExecutions,
  getExecutionSummary,
  countExecutions,
  deleteOldExecutions,
} from './executions.js';

export {
  insertImprovement,
  getImprovementById,
  getImprovements,
  updateImprovement,
  getImprovementSummary,
  getOpenImprovements,
  getUrgentImprovements,
} from './improvements.js';

export {
  insertAlert,
  getAlertById,
  getAlerts,
  updateAlert,
  addAlertNotification,
  getActiveAlerts,
  getCriticalAlerts,
  acknowledgeAlert,
  resolveAlert,
  suppressAlert,
  isRuleInCooldown,
} from './alerts.js';

export {
  getOrCreateDailyMetrics,
  incrementExecutionMetrics,
  incrementImprovementMetrics,
  incrementAlertMetrics,
  getMetricsSnapshot,
  getDailyMetrics,
} from './metrics.js';

