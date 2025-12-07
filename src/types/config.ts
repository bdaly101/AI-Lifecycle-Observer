/**
 * Configuration types for the lifecycle observer
 */

import type { LifecycleTool } from './execution.js';
import type { AlertThresholds } from './alert.js';
import type { MetricsPeriod } from './metrics.js';

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * How frequently to update improvement files
 */
export type UpdateFrequency = 'immediate' | 'hourly' | 'daily';

/**
 * Configuration for a monitored project
 */
export interface ProjectConfig {
  /** Project name */
  name: string;
  /** Full path to project */
  path: string;
  /** Whether this project is enabled */
  enabled: boolean;
  /** Tools used in this project */
  tools: LifecycleTool[];
}

/**
 * AI provider configuration
 */
export interface AIConfig {
  /** Whether AI analysis is enabled */
  enabled: boolean;
  /** AI provider (currently only anthropic) */
  provider: 'anthropic';
  /** Model to use */
  model: string;
  /** API key (can be "env:VAR_NAME" to read from env) */
  apiKey: string;
  /** Maximum tokens per request */
  maxTokens: number;
  /** Temperature for generation */
  temperature: number;
  /** Run AI analysis every N executions */
  analyzeEveryNExecutions: number;
}

/**
 * GitHub integration configuration
 */
export interface GitHubAlertConfig {
  /** Whether GitHub integration is enabled */
  enabled: boolean;
  /** GitHub token (can be "env:VAR_NAME") */
  token: string;
  /** Whether to create issues for alerts */
  createIssues: boolean;
  /** Labels to add to created issues */
  issueLabels: string[];
}

/**
 * Slack integration configuration
 */
export interface SlackAlertConfig {
  /** Whether Slack integration is enabled */
  enabled: boolean;
  /** Webhook URL (can be "env:VAR_NAME") */
  webhookUrl: string;
  /** Channel to post to */
  channel: string;
  /** Users to mention for critical alerts */
  mentionUsers?: string[];
}

/**
 * Email integration configuration
 */
export interface EmailAlertConfig {
  /** Whether email integration is enabled */
  enabled: boolean;
  /** Email recipients */
  recipients: string[];
  /** SMTP configuration */
  smtpConfig: Record<string, unknown>;
}

/**
 * Alert channel configuration
 */
export interface AlertChannelConfig {
  /** Console output */
  console: boolean;
  /** File logging */
  file: boolean;
  /** GitHub integration */
  github: GitHubAlertConfig;
  /** Slack integration (optional) */
  slack?: SlackAlertConfig;
  /** Email integration (optional) */
  email?: EmailAlertConfig;
}

/**
 * Alert escalation configuration
 */
export interface EscalationConfig {
  /** Whether escalation is enabled */
  enabled: boolean;
  /** Minutes to wait before escalating critical alerts */
  criticalDelayMinutes: number;
  /** Users/contacts to escalate to */
  escalateTo: string[];
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  /** Whether alerting is enabled */
  enabled: boolean;
  /** Alert thresholds */
  thresholds: AlertThresholds;
  /** Notification channels */
  channels: AlertChannelConfig;
  /** Escalation settings */
  escalation: EscalationConfig;
}

/**
 * Reporting configuration
 */
export interface ReportingConfig {
  /** Whether reporting is enabled */
  enabled: boolean;
  /** Automatically update improvement files */
  autoUpdateFiles: boolean;
  /** How often to update files */
  updateFrequency: UpdateFrequency;
  /** Filename for project improvement files */
  futureImprovementsFilename: string;
  /** Include metrics in reports */
  includeMetrics: boolean;
  /** Include improvement history in reports */
  includeHistory: boolean;
}

/**
 * Database configuration
 */
export interface DatabaseConfig {
  /** Path to SQLite database */
  path: string;
  /** Days to retain execution data */
  retentionDays: number;
  /** Intervals for metrics aggregation */
  aggregationIntervals: MetricsPeriod[];
}

/**
 * Complete lifecycle observer configuration
 */
export interface LifecycleObserverConfig {
  /** Whether the observer is enabled */
  enabled: boolean;
  /** Path to projects directory */
  projectsDir: string;
  /** Path to data directory */
  dataDir: string;
  /** Log level */
  logLevel: LogLevel;

  /** Projects to monitor */
  projects: ProjectConfig[];

  /** AI configuration */
  ai: AIConfig;

  /** Alert configuration */
  alerts: AlertConfig;

  /** Reporting configuration */
  reporting: ReportingConfig;

  /** Database configuration */
  database: DatabaseConfig;
}

/**
 * Partial config for user-provided overrides
 */
export type PartialConfig = {
  [K in keyof LifecycleObserverConfig]?: LifecycleObserverConfig[K] extends object
    ? Partial<LifecycleObserverConfig[K]>
    : LifecycleObserverConfig[K];
};

