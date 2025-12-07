/**
 * Metrics repository - aggregation and queries for metrics
 */

import { getDatabase } from '../connection.js';
import { formatDate, todayIso } from '../../utils/time.js';
import type {
  DailyMetricsRecord,
  MetricsSnapshot,
  MetricsOptions,
  LifecycleTool,
  ToolMetrics,
} from '../../types/index.js';

/**
 * Get or create a daily metrics record
 */
export function getOrCreateDailyMetrics(
  date: string,
  tool: LifecycleTool | null,
  project: string | null
): DailyMetricsRecord {
  const db = getDatabase();

  // Try to get existing record
  const existing = db.prepare(`
    SELECT * FROM metrics_daily
    WHERE date = ? AND tool IS ? AND project IS ?
  `).get(date, tool, project) as DailyMetricsRecord | undefined;

  if (existing) {
    return existing;
  }

  // Create new record
  db.prepare(`
    INSERT INTO metrics_daily (date, tool, project)
    VALUES (?, ?, ?)
  `).run(date, tool, project);

  return {
    date,
    tool,
    project,
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalDuration: 0,
    minDuration: null,
    maxDuration: null,
    totalTokens: 0,
    totalApiCalls: 0,
    improvementsDetected: 0,
    improvementsResolved: 0,
    alertsTriggered: 0,
    alertsResolved: 0,
  };
}

/**
 * Increment execution metrics for today
 */
export function incrementExecutionMetrics(
  tool: LifecycleTool,
  project: string,
  duration: number,
  success: boolean,
  tokensUsed?: number,
  apiCalls?: number
): void {
  const db = getDatabase();
  const date = todayIso();

  // Update tool-specific metrics
  db.prepare(`
    INSERT INTO metrics_daily (date, tool, project, total_executions, successful_executions, failed_executions, total_duration, min_duration, max_duration, total_tokens, total_api_calls)
    VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, tool, project) DO UPDATE SET
      total_executions = total_executions + 1,
      successful_executions = successful_executions + excluded.successful_executions,
      failed_executions = failed_executions + excluded.failed_executions,
      total_duration = total_duration + excluded.total_duration,
      min_duration = MIN(COALESCE(min_duration, excluded.min_duration), excluded.min_duration),
      max_duration = MAX(COALESCE(max_duration, 0), excluded.max_duration),
      total_tokens = total_tokens + excluded.total_tokens,
      total_api_calls = total_api_calls + excluded.total_api_calls
  `).run(
    date,
    tool,
    project,
    success ? 1 : 0,
    success ? 0 : 1,
    duration,
    duration,
    duration,
    tokensUsed ?? 0,
    apiCalls ?? 0
  );

  // Update aggregate metrics (null tool and project)
  db.prepare(`
    INSERT INTO metrics_daily (date, tool, project, total_executions, successful_executions, failed_executions, total_duration, min_duration, max_duration, total_tokens, total_api_calls)
    VALUES (?, NULL, NULL, 1, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date, tool, project) DO UPDATE SET
      total_executions = total_executions + 1,
      successful_executions = successful_executions + excluded.successful_executions,
      failed_executions = failed_executions + excluded.failed_executions,
      total_duration = total_duration + excluded.total_duration,
      min_duration = MIN(COALESCE(min_duration, excluded.min_duration), excluded.min_duration),
      max_duration = MAX(COALESCE(max_duration, 0), excluded.max_duration),
      total_tokens = total_tokens + excluded.total_tokens,
      total_api_calls = total_api_calls + excluded.total_api_calls
  `).run(
    date,
    success ? 1 : 0,
    success ? 0 : 1,
    duration,
    duration,
    duration,
    tokensUsed ?? 0,
    apiCalls ?? 0
  );
}

/**
 * Increment improvement metrics for today
 */
export function incrementImprovementMetrics(detected: boolean, resolved: boolean): void {
  const db = getDatabase();
  const date = todayIso();

  db.prepare(`
    INSERT INTO metrics_daily (date, tool, project, improvements_detected, improvements_resolved)
    VALUES (?, NULL, NULL, ?, ?)
    ON CONFLICT(date, tool, project) DO UPDATE SET
      improvements_detected = improvements_detected + excluded.improvements_detected,
      improvements_resolved = improvements_resolved + excluded.improvements_resolved
  `).run(date, detected ? 1 : 0, resolved ? 1 : 0);
}

/**
 * Increment alert metrics for today
 */
export function incrementAlertMetrics(triggered: boolean, resolved: boolean): void {
  const db = getDatabase();
  const date = todayIso();

  db.prepare(`
    INSERT INTO metrics_daily (date, tool, project, alerts_triggered, alerts_resolved)
    VALUES (?, NULL, NULL, ?, ?)
    ON CONFLICT(date, tool, project) DO UPDATE SET
      alerts_triggered = alerts_triggered + excluded.alerts_triggered,
      alerts_resolved = alerts_resolved + excluded.alerts_resolved
  `).run(date, triggered ? 1 : 0, resolved ? 1 : 0);
}

/**
 * Get aggregated metrics for a period
 */
export function getMetricsSnapshot(options?: MetricsOptions): MetricsSnapshot {
  const db = getDatabase();
  const { period = 'daily', since, until, tools, projects } = options ?? {};

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (since) {
    conditions.push('date >= ?');
    params.push(formatDate(since));
  }

  if (until) {
    conditions.push('date <= ?');
    params.push(formatDate(until));
  }

  if (tools?.length) {
    conditions.push(`tool IN (${tools.map(() => '?').join(', ')})`);
    params.push(...tools);
  }

  if (projects?.length) {
    conditions.push(`project IN (${projects.map(() => '?').join(', ')})`);
    params.push(...projects);
  }

  // Get aggregate stats
  let aggregateSql = `
    SELECT
      SUM(total_executions) as total_executions,
      SUM(successful_executions) as successful_executions,
      SUM(failed_executions) as failed_executions,
      SUM(total_duration) as total_duration,
      MIN(min_duration) as min_duration,
      MAX(max_duration) as max_duration,
      SUM(total_tokens) as total_tokens,
      SUM(total_api_calls) as total_api_calls,
      SUM(improvements_detected) as improvements_detected,
      SUM(improvements_resolved) as improvements_resolved,
      SUM(alerts_triggered) as alerts_triggered,
      SUM(alerts_resolved) as alerts_resolved
    FROM metrics_daily
    WHERE tool IS NULL AND project IS NULL
  `;

  if (conditions.length > 0) {
    aggregateSql += ' AND ' + conditions.join(' AND ');
  }

  const aggregate = db.prepare(aggregateSql).get(...params) as {
    total_executions: number | null;
    successful_executions: number | null;
    failed_executions: number | null;
    total_duration: number | null;
    min_duration: number | null;
    max_duration: number | null;
    total_tokens: number | null;
    total_api_calls: number | null;
    improvements_detected: number | null;
    improvements_resolved: number | null;
    alerts_triggered: number | null;
    alerts_resolved: number | null;
  };

  // Get by-tool breakdown
  let toolSql = `
    SELECT
      tool,
      SUM(total_executions) as executions,
      SUM(successful_executions) as successes,
      SUM(total_duration) as duration
    FROM metrics_daily
    WHERE tool IS NOT NULL
  `;

  if (conditions.length > 0) {
    toolSql += ' AND ' + conditions.join(' AND ');
  }
  toolSql += ' GROUP BY tool';

  const toolRows = db.prepare(toolSql).all(...params) as {
    tool: string;
    executions: number;
    successes: number;
    duration: number;
  }[];

  const byTool: Partial<Record<LifecycleTool, ToolMetrics>> = {};
  for (const row of toolRows) {
    byTool[row.tool as LifecycleTool] = {
      executions: row.executions,
      successRate: row.executions > 0 ? row.successes / row.executions : 0,
      avgDuration: row.executions > 0 ? row.duration / row.executions : 0,
    };
  }

  // Get by-project breakdown
  let projectSql = `
    SELECT
      project,
      SUM(total_executions) as executions,
      SUM(successful_executions) as successes,
      SUM(total_duration) as duration
    FROM metrics_daily
    WHERE project IS NOT NULL
  `;

  if (conditions.length > 0) {
    projectSql += ' AND ' + conditions.join(' AND ');
  }
  projectSql += ' GROUP BY project';

  const projectRows = db.prepare(projectSql).all(...params) as {
    project: string;
    executions: number;
    successes: number;
    duration: number;
  }[];

  const byProject: Record<string, ToolMetrics> = {};
  for (const row of projectRows) {
    byProject[row.project] = {
      executions: row.executions,
      successRate: row.executions > 0 ? row.successes / row.executions : 0,
      avgDuration: row.executions > 0 ? row.duration / row.executions : 0,
    };
  }

  const totalExecutions = aggregate.total_executions ?? 0;
  const successfulExecutions = aggregate.successful_executions ?? 0;
  const totalDuration = aggregate.total_duration ?? 0;
  const avgDuration = totalExecutions > 0 ? totalDuration / totalExecutions : 0;

  // Count current open improvements and active alerts
  const openImprovements = db.prepare(`
    SELECT COUNT(*) as count FROM improvements WHERE status IN ('open', 'in_progress')
  `).get() as { count: number };

  const urgentImprovements = db.prepare(`
    SELECT COUNT(*) as count FROM improvements WHERE severity = 'urgent' AND status IN ('open', 'in_progress')
  `).get() as { count: number };

  const activeAlerts = db.prepare(`
    SELECT COUNT(*) as count FROM alerts WHERE status = 'active'
  `).get() as { count: number };

  const criticalAlerts = db.prepare(`
    SELECT COUNT(*) as count FROM alerts WHERE severity = 'critical' AND status = 'active'
  `).get() as { count: number };

  return {
    timestamp: new Date(),
    period,
    totalExecutions,
    successfulExecutions,
    failedExecutions: aggregate.failed_executions ?? 0,
    successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
    avgDuration,
    p50Duration: avgDuration, // Simplified - would need actual percentile calculation
    p95Duration: (aggregate.max_duration ?? 0) * 0.95,
    p99Duration: (aggregate.max_duration ?? 0) * 0.99,
    byTool,
    byProject,
    totalTokensUsed: aggregate.total_tokens ?? 0,
    totalApiCalls: aggregate.total_api_calls ?? 0,
    avgTokensPerExecution: totalExecutions > 0 ? (aggregate.total_tokens ?? 0) / totalExecutions : 0,
    improvementsDetected: aggregate.improvements_detected ?? 0,
    improvementsResolved: aggregate.improvements_resolved ?? 0,
    openImprovements: openImprovements.count,
    urgentImprovements: urgentImprovements.count,
    alertsTriggered: aggregate.alerts_triggered ?? 0,
    alertsResolved: aggregate.alerts_resolved ?? 0,
    activeAlerts: activeAlerts.count,
    criticalAlerts: criticalAlerts.count,
  };
}

/**
 * Get daily metrics for a date range
 */
export function getDailyMetrics(
  startDate: string,
  endDate: string,
  tool?: LifecycleTool,
  project?: string
): DailyMetricsRecord[] {
  const db = getDatabase();
  const conditions = ['date >= ?', 'date <= ?'];
  const params: unknown[] = [startDate, endDate];

  if (tool) {
    conditions.push('tool = ?');
    params.push(tool);
  } else {
    conditions.push('tool IS NULL');
  }

  if (project) {
    conditions.push('project = ?');
    params.push(project);
  } else {
    conditions.push('project IS NULL');
  }

  const sql = `SELECT * FROM metrics_daily WHERE ${conditions.join(' AND ')} ORDER BY date`;
  return db.prepare(sql).all(...params) as DailyMetricsRecord[];
}

