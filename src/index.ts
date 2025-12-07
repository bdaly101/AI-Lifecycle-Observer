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

// Note: wrapTool and related exports are now in ./integrations/index.js

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

// Export alert system
export {
  AlertManager,
  getAlertManager,
  createAlertManager,
  DEFAULT_ALERT_THRESHOLDS,
  BUILTIN_ALERT_RULES,
  getEnabledAlertRules,
  getAlertRuleById,
  getAlertRulesByCategory,
  getAlertRulesBySeverity,
  getCriticalAlertRules,
  type AlertCheckResult,
  type AlertManagerOptions,
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

// Export reporters
export {
  UrgentAlertReporter,
  getAlertReporter,
  createAlertReporter,
  ConsoleChannel,
  createConsoleChannel,
  FileChannel,
  createFileChannel,
  GitHubChannel,
  createGitHubChannel,
  // Markdown generators
  generateFutureImprovements,
  generateLifecycleImprovements,
  generateUrgentIssues,
  getVersion,
  calculateAge,
  // Project reporter
  ProjectReporter,
  createProjectReporter,
  getProjectReporter,
  // Lifecycle reporter
  LifecycleReporter,
  createLifecycleReporter,
  getLifecycleReporter,
  type NotificationChannel,
  type NotificationResult,
  type AlertReporterConfig,
  type AlertReportResult,
  type ConsoleChannelOptions,
  type FileChannelOptions,
  type GitHubChannelOptions,
  type FutureImprovementsData,
  type LifecycleImprovementsData,
  type UrgentIssuesData,
  type ProjectReportOptions,
  type ProjectReportResult,
  type LifecycleReportOptions,
  type LifecycleReportResult,
} from './reporters/index.js';

// Export integrations (includes wrapTool, etc.)
export {
  // Main wrapper functions
  wrapTool,
  wrapToolSync,
  createTrackedExecution,
  tracked,
  createExecutionRecord,
  // Tool-specific integrations
  createPRDevIntegration,
  createFeatureBuilderIntegration,
  createTestGeneratorIntegration,
  createDocsGeneratorIntegration,
  createSQLDevIntegration,
  // Verification
  verifyIntegration,
  // Types
  type WrapOptions,
  type WrapResult,
  type PRDevIntegrationOptions,
  type PRReviewResult,
  type FeatureBuilderIntegrationOptions,
  type FeatureImplementResult,
  type TestGeneratorIntegrationOptions,
  type TestGenerateResult,
  type DocsGeneratorIntegrationOptions,
  type DocsGenerateResult,
  type SQLDevIntegrationOptions,
  type SQLDevGenerateResult,
  type IntegrationStatus,
} from './integrations/index.js';

