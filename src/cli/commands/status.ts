/**
 * Status command - Show current status of the lifecycle observer
 */

import { Command } from 'commander';
import { getGlobalOptions, initContext, output, handleError } from '../index.js';
import { getMetricsSnapshot } from '../../database/repositories/metrics.js';
import { getAlerts } from '../../database/repositories/alerts.js';
import { getImprovements } from '../../database/repositories/improvements.js';
import type { 
  LifecycleObserverConfig,
  MetricsSnapshot,
  Alert,
  ImprovementSuggestion,
  LifecycleTool,
} from '../../types/index.js';

interface StatusOptions {
  project?: string;
}

interface ProjectStatus {
  name: string;
  healthScore: number;
  successRate: number;
  avgDuration: number;
  activeAlerts: number;
  openImprovements: number;
}

interface StatusResult {
  timestamp: Date;
  overall: {
    healthScore: number;
    totalProjects: number;
    enabledProjects: number;
    totalExecutions: number;
    successRate: number;
    avgDuration: number;
  };
  alerts: {
    active: number;
    critical: number;
    acknowledged: number;
    recentAlerts: Array<{
      id: string;
      severity: string;
      title: string;
      project?: string;
      triggeredAt: Date;
    }>;
  };
  improvements: {
    open: number;
    urgent: number;
    inProgress: number;
    recentImprovements: Array<{
      id: string;
      severity: string;
      title: string;
      type: string;
    }>;
  };
  tools: Array<{
    name: string;
    executions: number;
    successRate: number;
    avgDuration: number;
  }>;
  projects?: ProjectStatus[];
}

/**
 * Calculate health score (0-100)
 */
function calculateHealthScore(
  successRate: number,
  activeAlerts: number,
  openImprovements: number
): number {
  let score = 100;
  
  // Success rate factor (up to -40 points)
  score -= (1 - successRate) * 40;
  
  // Active alerts factor (up to -30 points)
  score -= Math.min(activeAlerts * 10, 30);
  
  // Open improvements factor (up to -30 points)
  score -= Math.min(openImprovements * 3, 30);
  
  return Math.max(0, Math.round(score));
}

/**
 * Get status for a specific project
 */
function getProjectStatus(
  config: LifecycleObserverConfig,
  projectName: string,
  alerts: Alert[],
  improvements: ImprovementSuggestion[],
  metrics: MetricsSnapshot
): ProjectStatus | null {
  const project = config.projects.find(p => p.name === projectName);
  if (!project) return null;

  const projectAlerts = alerts.filter(a => a.project === projectName);
  const projectImprovements = improvements.filter(i => 
    i.affectedProjects.includes(projectName)
  );
  
  const projectMetrics = metrics.byProject[projectName] || {
    executions: 0,
    successRate: 0,
    avgDuration: 0,
  };

  return {
    name: projectName,
    healthScore: calculateHealthScore(
      projectMetrics.successRate,
      projectAlerts.length,
      projectImprovements.length
    ),
    successRate: projectMetrics.successRate,
    avgDuration: projectMetrics.avgDuration,
    activeAlerts: projectAlerts.length,
    openImprovements: projectImprovements.length,
  };
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
 * Get health score color/icon
 */
function getHealthIcon(score: number): string {
  if (score >= 90) return '🟢';
  if (score >= 70) return '🟡';
  if (score >= 50) return '🟠';
  return '🔴';
}

/**
 * Format status result for display
 */
function formatStatusResult(result: StatusResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║              LIFECYCLE OBSERVER STATUS                       ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');
  
  // Overall health
  const healthIcon = getHealthIcon(result.overall.healthScore);
  lines.push(`  ${healthIcon} Health Score: ${result.overall.healthScore}/100`);
  lines.push('');
  
  // Summary metrics
  lines.push('  📊 Summary');
  lines.push('  ─────────────────────────────────────────');
  lines.push(`     Projects:    ${result.overall.enabledProjects}/${result.overall.totalProjects} enabled`);
  lines.push(`     Executions:  ${result.overall.totalExecutions}`);
  lines.push(`     Success Rate: ${formatPercent(result.overall.successRate)}`);
  lines.push(`     Avg Duration: ${formatDuration(result.overall.avgDuration)}`);
  lines.push('');
  
  // Alerts
  lines.push('  🚨 Alerts');
  lines.push('  ─────────────────────────────────────────');
  if (result.alerts.active > 0) {
    lines.push(`     Active: ${result.alerts.active} (${result.alerts.critical} critical)`);
    for (const alert of result.alerts.recentAlerts.slice(0, 3)) {
      const icon = alert.severity === 'critical' ? '🔴' : alert.severity === 'error' ? '🟠' : '🟡';
      lines.push(`     ${icon} ${alert.title}`);
    }
  } else {
    lines.push('     ✅ No active alerts');
  }
  lines.push('');
  
  // Improvements
  lines.push('  📈 Improvements');
  lines.push('  ─────────────────────────────────────────');
  if (result.improvements.open > 0) {
    lines.push(`     Open: ${result.improvements.open} (${result.improvements.urgent} urgent)`);
    for (const imp of result.improvements.recentImprovements.slice(0, 3)) {
      const icon = imp.severity === 'urgent' ? '🔴' : imp.severity === 'high' ? '🟠' : '🟡';
      lines.push(`     ${icon} ${imp.title}`);
    }
  } else {
    lines.push('     ✅ No open improvements');
  }
  lines.push('');
  
  // Tool status
  if (result.tools.length > 0) {
    lines.push('  🛠️  Tools');
    lines.push('  ─────────────────────────────────────────');
    for (const tool of result.tools) {
      if (tool.executions > 0) {
        const status = tool.successRate >= 0.9 ? '✅' : tool.successRate >= 0.7 ? '🟡' : '🔴';
        lines.push(`     ${status} ${tool.name}: ${formatPercent(tool.successRate)} (${tool.executions} runs)`);
      }
    }
    lines.push('');
  }
  
  // Project status (if available)
  if (result.projects && result.projects.length > 0) {
    lines.push('  📁 Projects');
    lines.push('  ─────────────────────────────────────────');
    for (const project of result.projects) {
      const icon = getHealthIcon(project.healthScore);
      lines.push(`     ${icon} ${project.name}: ${project.healthScore}/100`);
      lines.push(`        Alerts: ${project.activeAlerts} | Improvements: ${project.openImprovements}`);
    }
    lines.push('');
  }
  
  lines.push(`  Last updated: ${result.timestamp.toLocaleString()}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Execute the status command
 */
async function executeStatus(
  config: LifecycleObserverConfig,
  options: StatusOptions
): Promise<StatusResult> {
  // Get metrics
  const metrics = getMetricsSnapshot({ period: 'weekly' });
  
  // Get active alerts
  const activeAlerts = getAlerts({ statuses: ['active'] });
  const acknowledgedAlerts = getAlerts({ statuses: ['acknowledged'] });
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical');
  
  // Get open improvements
  const openImprovements = getImprovements({ statuses: ['open', 'in_progress'] });
  const urgentImprovements = openImprovements.filter(i => i.severity === 'urgent');
  const inProgressImprovements = openImprovements.filter(i => i.status === 'in_progress');
  
  // Get enabled projects
  const enabledProjects = config.projects.filter(p => p.enabled);
  
  // Calculate overall health score
  const overallHealthScore = calculateHealthScore(
    metrics.successRate,
    activeAlerts.length,
    openImprovements.length
  );
  
  // Build tool metrics
  const tools: LifecycleTool[] = [
    'ai-pr-dev',
    'ai-feature-builder',
    'ai-test-generator',
    'ai-docs-generator',
    'ai-sql-dev',
  ];
  
  const toolMetrics = tools.map(tool => {
    const tm = metrics.byTool[tool];
    return {
      name: tool,
      executions: tm?.executions ?? 0,
      successRate: tm?.successRate ?? 0,
      avgDuration: tm?.avgDuration ?? 0,
    };
  });
  
  // Build result
  const result: StatusResult = {
    timestamp: new Date(),
    overall: {
      healthScore: overallHealthScore,
      totalProjects: config.projects.length,
      enabledProjects: enabledProjects.length,
      totalExecutions: metrics.totalExecutions,
      successRate: metrics.successRate,
      avgDuration: metrics.avgDuration,
    },
    alerts: {
      active: activeAlerts.length,
      critical: criticalAlerts.length,
      acknowledged: acknowledgedAlerts.length,
      recentAlerts: activeAlerts.slice(0, 5).map(a => ({
        id: a.id,
        severity: a.severity,
        title: a.title,
        project: a.project,
        triggeredAt: a.triggeredAt,
      })),
    },
    improvements: {
      open: openImprovements.length,
      urgent: urgentImprovements.length,
      inProgress: inProgressImprovements.length,
      recentImprovements: openImprovements.slice(0, 5).map(i => ({
        id: i.id,
        severity: i.severity,
        title: i.title,
        type: i.type,
      })),
    },
    tools: toolMetrics,
  };
  
  // Add project details if requested or showing all
  if (options.project) {
    const projectStatus = getProjectStatus(
      config,
      options.project,
      activeAlerts,
      openImprovements,
      metrics
    );
    if (projectStatus) {
      result.projects = [projectStatus];
    }
  } else {
    // Show all project statuses
    result.projects = enabledProjects.map(p => 
      getProjectStatus(config, p.name, activeAlerts, openImprovements, metrics)
    ).filter((p): p is ProjectStatus => p !== null);
  }
  
  return result;
}

/**
 * Register the status command with the program
 */
export function registerStatusCommand(program: Command): void {
  program
    .command('status')
    .description('Show current status')
    .option('-p, --project <name>', 'Show status for specific project')
    .action(async (options: StatusOptions) => {
      const globalOpts = getGlobalOptions(program);
      
      try {
        const config = await initContext(globalOpts);
        const result = await executeStatus(config, options);
        output(result, globalOpts.json, formatStatusResult);
      } catch (error: any) {
        handleError(error, globalOpts.json);
      }
    });
}
