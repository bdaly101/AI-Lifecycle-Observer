/**
 * Type exports for the lifecycle observer
 */

// Execution types
export type {
  LifecycleTool,
  ExecutionStatus,
  ErrorCategory,
  ExecutionContext,
  ExecutionRecord,
  ExecutionSummary,
  StartExecutionOptions,
  ExecutionResult,
  ExecutionFilter,
} from './execution.js';

// Improvement types
export type {
  ImprovementType,
  ImprovementSeverity,
  ImprovementScope,
  ImprovementStatus,
  DetectionMethod,
  EstimationLevel,
  ImprovementSuggestion,
  ImprovementFilter,
  CreateImprovementData,
  UpdateImprovementData,
  ImprovementSummary,
} from './improvement.js';

// Alert types
export type {
  AlertCategory,
  AlertSeverity,
  AlertStatus,
  AlertThresholds,
  AlertNotification,
  Alert,
  AlertRuleContext,
  AlertRule,
  AlertFilter,
  CreateAlertData,
  UpdateAlertData,
} from './alert.js';

// Metrics types
export type {
  MetricsPeriod,
  TrendDirection,
  ToolMetrics,
  ProjectToolMetrics,
  MetricsSnapshot,
  MetricsTrend,
  HealthFactor,
  ProjectMetrics,
  DailyMetricsRecord,
  MetricsOptions,
} from './metrics.js';

// Config types
export type {
  LogLevel,
  UpdateFrequency,
  ProjectConfig,
  AIConfig,
  GitHubAlertConfig,
  SlackAlertConfig,
  EmailAlertConfig,
  AlertChannelConfig,
  EscalationConfig,
  AlertConfig,
  ReportingConfig,
  DatabaseConfig,
  LifecycleObserverConfig,
  PartialConfig,
} from './config.js';

