/**
 * Alert types for the lifecycle observer
 */

import type { LifecycleTool } from './execution.js';
import type { MetricsSnapshot } from './metrics.js';
import type { ExecutionRecord } from './execution.js';

/**
 * Categories of alerts
 */
export type AlertCategory =
  | 'security_breach'
  | 'tool_failure'
  | 'api_exhaustion'
  | 'integration_break'
  | 'performance_degradation'
  | 'coverage_drop'
  | 'config_invalid'
  | 'dependency_issue';

/**
 * Severity levels for alerts
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Current status of an alert
 */
export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'suppressed';

/**
 * Configurable thresholds for alert triggering
 */
export interface AlertThresholds {
  // Tool-level thresholds
  /** Number of consecutive failures before alerting (default: 3) */
  consecutiveFailures: number;
  /** Failure rate threshold (0-1) to trigger alert (default: 0.30) */
  failureRateThreshold: number;
  /** Time window for failure rate calculation in ms (default: 86400000 = 24h) */
  failureRateWindow: number;
  /** Multiplier of avg duration to consider slow (default: 3) */
  avgDurationMultiplier: number;
  /** Execution timeout threshold in ms (default: 300000 = 5min) */
  timeoutThreshold: number;

  // Security thresholds (immediate alert)
  /** Alert on potential secrets in output (default: true) */
  secretsDetected: boolean;
  /** Alert on permission escalation attempts (default: true) */
  permissionEscalation: boolean;
  /** Alert on push to unprotected branch (default: true) */
  unprotectedBranchPush: boolean;

  // API thresholds
  /** API failure rate threshold (0-1) (default: 0.50) */
  apiFailureRateThreshold: number;
  /** Time window for API failure rate in ms (default: 3600000 = 1h) */
  apiFailureRateWindow: number;
  /** Number of rate limit hits before alerting (default: 5) */
  rateLimitHits: number;

  // Git operation thresholds
  /** Number of git failures before alerting (default: 5) */
  gitOperationFailures: number;
  /** Time window for git failures in ms (default: 3600000 = 1h) */
  gitOperationWindow: number;

  // Coverage thresholds
  /** Coverage drop threshold (0-1) to trigger alert (default: 0.05) */
  coverageDropThreshold: number;
  /** Minimum acceptable coverage (0-1) (default: 0.70) */
  minimumCoverage: number;
}

/**
 * Record of a notification sent for an alert
 */
export interface AlertNotification {
  /** Channel used (console, github, slack, email) */
  channel: string;
  /** When the notification was sent */
  sentAt: Date;
  /** Whether the notification was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * An alert record
 */
export interface Alert {
  /** Unique identifier */
  id: string;
  /** Category of the alert */
  category: AlertCategory;
  /** Severity level */
  severity: AlertSeverity;
  /** Current status */
  status: AlertStatus;
  /** Short title */
  title: string;
  /** Detailed message */
  message: string;
  /** Tool that triggered the alert (optional) */
  tool?: LifecycleTool;
  /** Project that triggered the alert (optional) */
  project?: string;
  /** When the alert was triggered */
  triggeredAt: Date;
  /** Rule or method that triggered the alert */
  triggeredBy: string;
  /** Additional context */
  context: Record<string, unknown>;
  /** When the alert was acknowledged */
  acknowledgedAt?: Date;
  /** Who acknowledged the alert */
  acknowledgedBy?: string;
  /** When the alert was resolved */
  resolvedAt?: Date;
  /** Who resolved the alert */
  resolvedBy?: string;
  /** Resolution details */
  resolution?: string;
  /** If suppressed, until when */
  suppressedUntil?: Date;
  /** Related execution IDs */
  relatedExecutions?: string[];
  /** Notifications sent */
  notificationsSent: AlertNotification[];
}

/**
 * Context provided to alert rules for evaluation
 */
export interface AlertRuleContext {
  /** Recent executions for analysis */
  recentExecutions: ExecutionRecord[];
  /** Aggregated metrics snapshot */
  aggregatedMetrics: MetricsSnapshot;
  /** Current thresholds */
  thresholds: AlertThresholds;
  /** Tool being evaluated (optional) */
  tool?: LifecycleTool;
  /** Project being evaluated (optional) */
  project?: string;
}

/**
 * Definition of an alert rule
 */
export interface AlertRule {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Description of what the rule detects */
  description: string;
  /** Whether the rule is active */
  enabled: boolean;
  /** Alert category for triggered alerts */
  category: AlertCategory;
  /** Severity for triggered alerts */
  severity: AlertSeverity;
  /** Condition function that returns true to trigger */
  condition: (context: AlertRuleContext) => boolean | Promise<boolean>;
  /** Template for alert message (supports {{variable}} placeholders) */
  messageTemplate: string;
  /** Minimum time between alerts from this rule in ms */
  cooldownMs: number;
  /** Optional function to auto-resolve the alert */
  autoResolve?: (context: AlertRuleContext) => boolean | Promise<boolean>;
}

/**
 * Filter options for querying alerts
 */
export interface AlertFilter {
  /** Filter by categories */
  categories?: AlertCategory[];
  /** Filter by severities */
  severities?: AlertSeverity[];
  /** Filter by statuses */
  statuses?: AlertStatus[];
  /** Filter by tools */
  tools?: LifecycleTool[];
  /** Filter by projects */
  projects?: string[];
  /** Start of date range */
  since?: Date;
  /** End of date range */
  until?: Date;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Data required to create a new alert
 */
export interface CreateAlertData {
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  tool?: LifecycleTool;
  project?: string;
  triggeredBy: string;
  context: Record<string, unknown>;
  relatedExecutions?: string[];
}

/**
 * Data for updating an alert
 */
export interface UpdateAlertData {
  status?: AlertStatus;
  acknowledgedBy?: string;
  resolvedBy?: string;
  resolution?: string;
  suppressedUntil?: Date;
}

