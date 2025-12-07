/**
 * Metrics types for the lifecycle observer
 */

import type { LifecycleTool } from './execution.js';
import type { ImprovementSuggestion } from './improvement.js';
import type { Alert } from './alert.js';

/**
 * Time periods for metrics aggregation
 */
export type MetricsPeriod = 'hourly' | 'daily' | 'weekly' | 'monthly';

/**
 * Trend direction
 */
export type TrendDirection = 'improving' | 'stable' | 'degrading';

/**
 * Metrics for a specific tool
 */
export interface ToolMetrics {
  /** Number of executions */
  executions: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average duration in ms */
  avgDuration: number;
}

/**
 * Metrics for a specific project
 */
export interface ProjectToolMetrics {
  /** Number of executions */
  executions: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average duration in ms */
  avgDuration: number;
}

/**
 * A snapshot of metrics at a point in time
 */
export interface MetricsSnapshot {
  /** When the snapshot was taken */
  timestamp: Date;
  /** Time period this snapshot covers */
  period: MetricsPeriod;

  // Execution metrics
  /** Total number of executions */
  totalExecutions: number;
  /** Number of successful executions */
  successfulExecutions: number;
  /** Number of failed executions */
  failedExecutions: number;
  /** Overall success rate (0-1) */
  successRate: number;
  /** Average duration in ms */
  avgDuration: number;
  /** 50th percentile duration in ms */
  p50Duration: number;
  /** 95th percentile duration in ms */
  p95Duration: number;
  /** 99th percentile duration in ms */
  p99Duration: number;

  // By tool breakdown
  /** Metrics broken down by tool */
  byTool: Partial<Record<LifecycleTool, ToolMetrics>>;

  // By project breakdown
  /** Metrics broken down by project */
  byProject: Record<string, ProjectToolMetrics>;

  // AI metrics
  /** Total AI tokens used */
  totalTokensUsed: number;
  /** Total API calls made */
  totalApiCalls: number;
  /** Average tokens per execution */
  avgTokensPerExecution: number;

  // Improvement metrics
  /** Number of improvements detected in this period */
  improvementsDetected: number;
  /** Number of improvements resolved in this period */
  improvementsResolved: number;
  /** Current number of open improvements */
  openImprovements: number;
  /** Current number of urgent improvements */
  urgentImprovements: number;

  // Alert metrics
  /** Number of alerts triggered in this period */
  alertsTriggered: number;
  /** Number of alerts resolved in this period */
  alertsResolved: number;
  /** Current number of active alerts */
  activeAlerts: number;
  /** Current number of critical alerts */
  criticalAlerts: number;
}

/**
 * A tracked metric trend over time
 */
export interface MetricsTrend {
  /** Name of the metric */
  metric: string;
  /** Current value */
  current: number;
  /** Previous value (from comparison period) */
  previous: number;
  /** Absolute change */
  change: number;
  /** Percentage change */
  changePercent: number;
  /** Trend direction */
  trend: TrendDirection;
}

/**
 * Factor contributing to health score
 */
export interface HealthFactor {
  /** Name of the factor */
  factor: string;
  /** Score for this factor (0-100) */
  score: number;
  /** Weight of this factor in overall score */
  weight: number;
  /** Details about this factor */
  details: string;
}

/**
 * Complete metrics for a project
 */
export interface ProjectMetrics {
  /** Project name */
  project: string;
  /** Full project path */
  projectPath: string;
  /** When metrics were last updated */
  lastUpdated: Date;

  // Overall health score (0-100)
  /** Composite health score */
  healthScore: number;
  /** Factors contributing to health score */
  healthFactors: HealthFactor[];

  // Current state
  /** Current execution metrics */
  executionMetrics: MetricsSnapshot;
  /** Current open improvements */
  openImprovements: ImprovementSuggestion[];
  /** Current active alerts */
  activeAlerts: Alert[];

  // Trends
  /** Metric trends over time */
  trends: MetricsTrend[];

  // Recommendations
  /** AI-generated recommendations */
  recommendations: string[];
}

/**
 * Daily metrics record for storage
 */
export interface DailyMetricsRecord {
  /** Date (YYYY-MM-DD) */
  date: string;
  /** Tool (null for aggregate) */
  tool: LifecycleTool | null;
  /** Project (null for aggregate) */
  project: string | null;
  /** Total executions */
  totalExecutions: number;
  /** Successful executions */
  successfulExecutions: number;
  /** Failed executions */
  failedExecutions: number;
  /** Total duration of all executions in ms */
  totalDuration: number;
  /** Minimum duration in ms */
  minDuration: number | null;
  /** Maximum duration in ms */
  maxDuration: number | null;
  /** Total AI tokens used */
  totalTokens: number;
  /** Total API calls */
  totalApiCalls: number;
  /** Improvements detected this day */
  improvementsDetected: number;
  /** Improvements resolved this day */
  improvementsResolved: number;
  /** Alerts triggered this day */
  alertsTriggered: number;
  /** Alerts resolved this day */
  alertsResolved: number;
}

/**
 * Options for generating metrics
 */
export interface MetricsOptions {
  /** Time period to aggregate */
  period: MetricsPeriod;
  /** Start date */
  since?: Date;
  /** End date */
  until?: Date;
  /** Filter by tools */
  tools?: LifecycleTool[];
  /** Filter by projects */
  projects?: string[];
}

