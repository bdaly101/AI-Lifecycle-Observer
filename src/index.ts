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
  countExecutions,
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

// Export collectors
export {
  ExecutionCollector,
  getExecutionCollector,
  createExecutionCollector,
  ErrorCollector,
  getErrorCollector,
  createErrorCollector,
  EfficiencyAnalyzer,
  getEfficiencyAnalyzer,
  createEfficiencyAnalyzer,
  type ExecutionHandle,
  type StartOptions,
  type ErrorFrequency,
  type ErrorTrend,
  type ErrorAnalysis,
  type UsagePattern,
  type WorkflowSequence,
  type Bottleneck,
  type ToolUtilization,
  type EfficiencyAnalysis,
} from './collectors/index.js';

// Export wrapper
export {
  wrapTool,
  wrapToolSync,
  createTrackedExecution,
  tracked,
  type WrapOptions,
  type WrapResult,
} from './hooks/wrapper.js';

// Export core detection
export {
  ImprovementDetector,
  getImprovementDetector,
  createImprovementDetector,
  BUILTIN_RULES,
  getEnabledRules,
  getRuleById,
  getRulesByType,
  type DetectionRule,
  type RuleContext,
  type DetectionResult,
  type TriggeredImprovement,
  type DetectionOptions,
  type DetectionRunResult,
} from './core/index.js';

// Export AI analysis
export {
  ClaudeClient,
  getClaudeClient,
  createClaudeClient,
  AIPatternDetector,
  getAIPatternDetector,
  createAIPatternDetector,
  type AIRequestOptions,
  type AIResponse,
  type AIAnalysisOptions,
  type AIAnalysisResult,
} from './ai/index.js';

