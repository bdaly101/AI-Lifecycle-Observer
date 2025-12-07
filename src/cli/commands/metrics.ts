/**
 * Metrics command - View execution metrics
 */

import { Command } from 'commander';
import * as fs from 'fs';
import { getGlobalOptions, initContext, output, handleError } from '../index.js';
import { getMetricsSnapshot, getDailyMetrics } from '../../database/repositories/metrics.js';
import { formatDate } from '../../utils/time.js';
import type { 
  LifecycleObserverConfig,
  MetricsPeriod,
  LifecycleTool,
} from '../../types/index.js';

interface MetricsOptions {
  period?: MetricsPeriod;
  tool?: LifecycleTool;
  project?: string;
  export?: string;
  days?: number;
}

interface ToolMetricsSummary {
  tool: string;
  executions: number;
  successRate: number;
  avgDuration: number;
  totalTokens: number;
  totalApiCalls: number;
}

interface MetricsResult {
  timestamp: Date;
  period: MetricsPeriod;
  summary: {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    successRate: number;
    avgDuration: number;
    p50Duration: number;
    p95Duration: number;
    totalTokensUsed: number;
    totalApiCalls: number;
  };
  tools: ToolMetricsSummary[];
  projects: Array<{
    name: string;
    executions: number;
    successRate: number;
    avgDuration: number;
  }>;
  improvements: {
    detected: number;
    resolved: number;
    open: number;
    urgent: number;
  };
  alerts: {
    triggered: number;
    resolved: number;
    active: number;
    critical: number;
  };
  dailyTrend?: Array<{
    date: string;
    executions: number;
    successRate: number;
    avgDuration: number;
  }>;
}

/**
 * Format duration as human-readable
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Format percentage
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format number with K/M suffix
 */
function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

/**
 * Format metrics result for display
 */
function formatMetricsResult(result: MetricsResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push(`║              METRICS (${result.period.toUpperCase()})                              ║`);
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');
  
  // Summary
  lines.push('  📊 Execution Summary');
  lines.push('  ─────────────────────────────────────────');
  lines.push(`     Total Executions:  ${formatNumber(result.summary.totalExecutions)}`);
  lines.push(`     Successful:        ${formatNumber(result.summary.successfulExecutions)} (${formatPercent(result.summary.successRate)})`);
  lines.push(`     Failed:            ${formatNumber(result.summary.failedExecutions)}`);
  lines.push('');
  
  // Duration stats
  lines.push('  ⏱️  Duration Stats');
  lines.push('  ─────────────────────────────────────────');
  lines.push(`     Average:   ${formatDuration(result.summary.avgDuration)}`);
  lines.push(`     P50:       ${formatDuration(result.summary.p50Duration)}`);
  lines.push(`     P95:       ${formatDuration(result.summary.p95Duration)}`);
  lines.push('');
  
  // AI Usage
  if (result.summary.totalTokensUsed > 0) {
    lines.push('  🤖 AI Usage');
    lines.push('  ─────────────────────────────────────────');
    lines.push(`     Tokens Used:  ${formatNumber(result.summary.totalTokensUsed)}`);
    lines.push(`     API Calls:    ${formatNumber(result.summary.totalApiCalls)}`);
    lines.push('');
  }
  
  // Tool breakdown
  const activeTools = result.tools.filter(t => t.executions > 0);
  if (activeTools.length > 0) {
    lines.push('  🛠️  Tool Breakdown');
    lines.push('  ─────────────────────────────────────────');
    lines.push('     Tool                    Runs    Success    Avg Time');
    lines.push('     ────────────────────    ────    ───────    ────────');
    for (const tool of activeTools) {
      const name = tool.tool.padEnd(20);
      const runs = tool.executions.toString().padStart(4);
      const success = formatPercent(tool.successRate).padStart(7);
      const duration = formatDuration(tool.avgDuration).padStart(8);
      lines.push(`     ${name}    ${runs}    ${success}    ${duration}`);
    }
    lines.push('');
  }
  
  // Project breakdown
  const activeProjects = result.projects.filter(p => p.executions > 0);
  if (activeProjects.length > 0) {
    lines.push('  📁 Project Breakdown');
    lines.push('  ─────────────────────────────────────────');
    for (const project of activeProjects) {
      lines.push(`     ${project.name}: ${project.executions} runs, ${formatPercent(project.successRate)} success`);
    }
    lines.push('');
  }
  
  // Improvements & Alerts
  lines.push('  📈 Improvements & Alerts');
  lines.push('  ─────────────────────────────────────────');
  lines.push(`     Improvements: ${result.improvements.detected} detected, ${result.improvements.resolved} resolved`);
  lines.push(`     Open:         ${result.improvements.open} (${result.improvements.urgent} urgent)`);
  lines.push(`     Alerts:       ${result.alerts.triggered} triggered, ${result.alerts.resolved} resolved`);
  lines.push(`     Active:       ${result.alerts.active} (${result.alerts.critical} critical)`);
  lines.push('');
  
  // Daily trend
  if (result.dailyTrend && result.dailyTrend.length > 0) {
    lines.push('  📅 Daily Trend (Last 7 days)');
    lines.push('  ─────────────────────────────────────────');
    lines.push('     Date         Runs    Success    Avg Time');
    lines.push('     ──────────   ────    ───────    ────────');
    for (const day of result.dailyTrend) {
      const date = day.date.padEnd(10);
      const runs = day.executions.toString().padStart(4);
      const success = formatPercent(day.successRate).padStart(7);
      const duration = formatDuration(day.avgDuration).padStart(8);
      lines.push(`     ${date}   ${runs}    ${success}    ${duration}`);
    }
    lines.push('');
  }
  
  lines.push(`  Generated: ${result.timestamp.toLocaleString()}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Convert metrics to CSV format
 */
function metricsToCSV(result: MetricsResult): string {
  const lines: string[] = [];
  
  // Header
  lines.push('metric,value');
  
  // Summary
  lines.push(`total_executions,${result.summary.totalExecutions}`);
  lines.push(`successful_executions,${result.summary.successfulExecutions}`);
  lines.push(`failed_executions,${result.summary.failedExecutions}`);
  lines.push(`success_rate,${result.summary.successRate}`);
  lines.push(`avg_duration_ms,${result.summary.avgDuration}`);
  lines.push(`p50_duration_ms,${result.summary.p50Duration}`);
  lines.push(`p95_duration_ms,${result.summary.p95Duration}`);
  lines.push(`total_tokens,${result.summary.totalTokensUsed}`);
  lines.push(`total_api_calls,${result.summary.totalApiCalls}`);
  
  // Tool breakdown
  lines.push('');
  lines.push('tool,executions,success_rate,avg_duration_ms,total_tokens');
  for (const tool of result.tools) {
    lines.push(`${tool.tool},${tool.executions},${tool.successRate},${tool.avgDuration},${tool.totalTokens}`);
  }
  
  // Daily trend
  if (result.dailyTrend) {
    lines.push('');
    lines.push('date,executions,success_rate,avg_duration_ms');
    for (const day of result.dailyTrend) {
      lines.push(`${day.date},${day.executions},${day.successRate},${day.avgDuration}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Execute the metrics command
 */
async function executeMetrics(
  _config: LifecycleObserverConfig,
  options: MetricsOptions
): Promise<MetricsResult> {
  const period = options.period || 'weekly';
  const days = options.days || (period === 'daily' ? 1 : period === 'weekly' ? 7 : 30);
  
  // Calculate date range
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - days);
  
  // Get metrics with filters
  const metricsOpts: {
    period: MetricsPeriod;
    since?: Date;
    until?: Date;
    tools?: LifecycleTool[];
    projects?: string[];
  } = {
    period,
    since,
    until,
  };
  
  if (options.tool) {
    metricsOpts.tools = [options.tool];
  }
  
  if (options.project) {
    metricsOpts.projects = [options.project];
  }
  
  const metrics = getMetricsSnapshot(metricsOpts);
  
  // Get daily trend
  const startDate = formatDate(since);
  const endDate = formatDate(until);
  const dailyData = getDailyMetrics(startDate, endDate);
  
  // Build tool summaries
  const tools: LifecycleTool[] = [
    'ai-pr-dev',
    'ai-feature-builder',
    'ai-test-generator',
    'ai-docs-generator',
    'ai-sql-dev',
  ];
  
  const toolSummaries: ToolMetricsSummary[] = tools.map(tool => {
    const tm = metrics.byTool[tool];
    return {
      tool,
      executions: tm?.executions ?? 0,
      successRate: tm?.successRate ?? 0,
      avgDuration: tm?.avgDuration ?? 0,
      totalTokens: 0, // Would need to aggregate from daily
      totalApiCalls: 0,
    };
  });
  
  // Build project summaries
  const projects = Object.entries(metrics.byProject).map(([name, pm]) => ({
    name,
    executions: pm.executions,
    successRate: pm.successRate,
    avgDuration: pm.avgDuration,
  }));
  
  // Build daily trend
  const dailyTrend = dailyData.map(d => ({
    date: d.date,
    executions: d.totalExecutions,
    successRate: d.totalExecutions > 0 
      ? d.successfulExecutions / d.totalExecutions 
      : 0,
    avgDuration: d.totalExecutions > 0 
      ? d.totalDuration / d.totalExecutions 
      : 0,
  }));
  
  return {
    timestamp: new Date(),
    period,
    summary: {
      totalExecutions: metrics.totalExecutions,
      successfulExecutions: metrics.successfulExecutions,
      failedExecutions: metrics.failedExecutions,
      successRate: metrics.successRate,
      avgDuration: metrics.avgDuration,
      p50Duration: metrics.p50Duration,
      p95Duration: metrics.p95Duration,
      totalTokensUsed: metrics.totalTokensUsed,
      totalApiCalls: metrics.totalApiCalls,
    },
    tools: toolSummaries,
    projects,
    improvements: {
      detected: metrics.improvementsDetected,
      resolved: metrics.improvementsResolved,
      open: metrics.openImprovements,
      urgent: metrics.urgentImprovements,
    },
    alerts: {
      triggered: metrics.alertsTriggered,
      resolved: metrics.alertsResolved,
      active: metrics.activeAlerts,
      critical: metrics.criticalAlerts,
    },
    dailyTrend,
  };
}

/**
 * Register the metrics command with the program
 */
export function registerMetricsCommand(program: Command): void {
  program
    .command('metrics')
    .description('View execution metrics')
    .option('-p, --period <period>', 'Time period: daily, weekly, monthly', 'weekly')
    .option('-t, --tool <tool>', 'Filter by tool')
    .option('--project <name>', 'Filter by project')
    .option('-d, --days <number>', 'Number of days to include', parseInt)
    .option('-e, --export <format>', 'Export format: csv')
    .action(async (options: MetricsOptions) => {
      const globalOpts = getGlobalOptions(program);
      
      try {
        const config = await initContext(globalOpts);
        const result = await executeMetrics(config, options);
        
        // Handle export
        if (options.export === 'csv') {
          const csv = metricsToCSV(result);
          const filename = `metrics-${formatDate(new Date())}.csv`;
          fs.writeFileSync(filename, csv);
          if (!globalOpts.json) {
            console.log(`Metrics exported to ${filename}`);
          } else {
            console.log(JSON.stringify({ exported: filename }));
          }
          return;
        }
        
        output(result, globalOpts.json, formatMetricsResult);
      } catch (error: any) {
        handleError(error, globalOpts.json);
      }
    });
}
