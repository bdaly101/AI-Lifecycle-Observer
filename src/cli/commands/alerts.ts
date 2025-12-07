/**
 * Alerts command - Manage alerts
 */

import { Command } from 'commander';
import { getGlobalOptions, initContext, output, handleError } from '../index.js';
import { 
  getAlerts, 
  acknowledgeAlert, 
  resolveAlert,
  updateAlert,
  getAlertById,
} from '../../database/repositories/alerts.js';
import { formatDateTime } from '../../utils/time.js';
import type { 
  LifecycleObserverConfig,
  AlertSeverity,
  AlertStatus,
} from '../../types/index.js';

interface AlertsListOptions {
  all?: boolean;
  severity?: AlertSeverity;
  status?: AlertStatus;
  project?: string;
  limit?: number;
}

interface AlertsListResult {
  timestamp: Date;
  total: number;
  alerts: Array<{
    id: string;
    category: string;
    severity: string;
    status: string;
    title: string;
    message: string;
    project?: string;
    tool?: string;
    triggeredAt: Date;
    age: string;
  }>;
}

interface AlertActionResult {
  success: boolean;
  action: string;
  alertId: string;
  message: string;
}

/**
 * Calculate age string from a date
 */
function calculateAge(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d`;
  if (diffHours > 0) return `${diffHours}h`;
  if (diffMinutes > 0) return `${diffMinutes}m`;
  return '<1m';
}

/**
 * Get severity icon
 */
function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical': return '🚨';
    case 'error': return '🔴';
    case 'warning': return '🟡';
    case 'info': return 'ℹ️';
    default: return '⚪';
  }
}

/**
 * Get status icon
 */
function getStatusIcon(status: string): string {
  switch (status) {
    case 'active': return '🔔';
    case 'acknowledged': return '👀';
    case 'resolved': return '✅';
    case 'suppressed': return '🔇';
    default: return '❓';
  }
}

/**
 * Format alerts list for display
 */
function formatAlertsListResult(result: AlertsListResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║                        ALERTS                                ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');
  
  if (result.alerts.length === 0) {
    lines.push('  ✅ No alerts found.');
    lines.push('');
    return lines.join('\n');
  }
  
  lines.push(`  Total: ${result.total} alert(s)`);
  lines.push('');
  
  for (const alert of result.alerts) {
    const sevIcon = getSeverityIcon(alert.severity);
    const statusIcon = getStatusIcon(alert.status);
    
    lines.push(`  ${sevIcon} ${alert.title}`);
    lines.push(`     ID: ${alert.id}`);
    lines.push(`     Status: ${statusIcon} ${alert.status} | Severity: ${alert.severity}`);
    lines.push(`     Category: ${alert.category}`);
    if (alert.project) {
      lines.push(`     Project: ${alert.project}`);
    }
    if (alert.tool) {
      lines.push(`     Tool: ${alert.tool}`);
    }
    lines.push(`     Triggered: ${formatDateTime(alert.triggeredAt)} (${alert.age} ago)`);
    lines.push(`     Message: ${alert.message.substring(0, 100)}${alert.message.length > 100 ? '...' : ''}`);
    lines.push('');
  }
  
  lines.push('  Commands:');
  lines.push('    lifecycle-observer alerts ack <id>           - Acknowledge an alert');
  lines.push('    lifecycle-observer alerts resolve <id>       - Resolve an alert');
  lines.push('    lifecycle-observer alerts suppress <id>      - Suppress an alert');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Format action result for display
 */
function formatActionResult(result: AlertActionResult): string {
  const lines: string[] = [];
  lines.push('');
  if (result.success) {
    lines.push(`✅ ${result.message}`);
  } else {
    lines.push(`❌ ${result.message}`);
  }
  lines.push('');
  return lines.join('\n');
}

/**
 * Execute alerts list
 */
async function executeAlertsList(
  _config: LifecycleObserverConfig,
  options: AlertsListOptions
): Promise<AlertsListResult> {
  const filter: {
    statuses?: AlertStatus[];
    severities?: AlertSeverity[];
    projects?: string[];
    limit?: number;
  } = {};
  
  // By default, only show active alerts
  if (!options.all) {
    filter.statuses = ['active'];
  } else if (options.status) {
    filter.statuses = [options.status];
  }
  
  if (options.severity) {
    filter.severities = [options.severity];
  }
  
  if (options.project) {
    filter.projects = [options.project];
  }
  
  filter.limit = options.limit || 50;
  
  const alerts = getAlerts(filter);
  
  return {
    timestamp: new Date(),
    total: alerts.length,
    alerts: alerts.map(a => ({
      id: a.id,
      category: a.category,
      severity: a.severity,
      status: a.status,
      title: a.title,
      message: a.message,
      project: a.project,
      tool: a.tool,
      triggeredAt: a.triggeredAt,
      age: calculateAge(a.triggeredAt),
    })),
  };
}

/**
 * Execute acknowledge alert
 */
async function executeAck(alertId: string): Promise<AlertActionResult> {
  const alert = getAlertById(alertId);
  
  if (!alert) {
    return {
      success: false,
      action: 'acknowledge',
      alertId,
      message: `Alert not found: ${alertId}`,
    };
  }
  
  if (alert.status !== 'active') {
    return {
      success: false,
      action: 'acknowledge',
      alertId,
      message: `Alert is not active (current status: ${alert.status})`,
    };
  }
  
  const username = process.env.USER || 'cli-user';
  const updated = acknowledgeAlert(alertId, username);
  
  if (updated) {
    return {
      success: true,
      action: 'acknowledge',
      alertId,
      message: `Alert "${alert.title}" acknowledged by ${username}`,
    };
  }
  
  return {
    success: false,
    action: 'acknowledge',
    alertId,
    message: 'Failed to acknowledge alert',
  };
}

/**
 * Execute resolve alert
 */
async function executeResolve(
  alertId: string,
  resolution?: string
): Promise<AlertActionResult> {
  const alert = getAlertById(alertId);
  
  if (!alert) {
    return {
      success: false,
      action: 'resolve',
      alertId,
      message: `Alert not found: ${alertId}`,
    };
  }
  
  if (alert.status === 'resolved') {
    return {
      success: false,
      action: 'resolve',
      alertId,
      message: 'Alert is already resolved',
    };
  }
  
  const username = process.env.USER || 'cli-user';
  const resolutionText = resolution || 'Resolved via CLI';
  const updated = resolveAlert(alertId, username, resolutionText);
  
  if (updated) {
    return {
      success: true,
      action: 'resolve',
      alertId,
      message: `Alert "${alert.title}" resolved by ${username}`,
    };
  }
  
  return {
    success: false,
    action: 'resolve',
    alertId,
    message: 'Failed to resolve alert',
  };
}

/**
 * Execute suppress alert
 */
async function executeSuppress(
  alertId: string,
  untilStr: string
): Promise<AlertActionResult> {
  const alert = getAlertById(alertId);
  
  if (!alert) {
    return {
      success: false,
      action: 'suppress',
      alertId,
      message: `Alert not found: ${alertId}`,
    };
  }
  
  // Parse the until date
  const until = new Date(untilStr);
  if (isNaN(until.getTime())) {
    return {
      success: false,
      action: 'suppress',
      alertId,
      message: `Invalid date format: ${untilStr}. Use ISO format (e.g., 2025-12-08)`,
    };
  }
  
  const updated = updateAlert(alertId, {
    status: 'suppressed',
    suppressedUntil: until,
  });
  
  if (updated) {
    return {
      success: true,
      action: 'suppress',
      alertId,
      message: `Alert "${alert.title}" suppressed until ${formatDateTime(until)}`,
    };
  }
  
  return {
    success: false,
    action: 'suppress',
    alertId,
    message: 'Failed to suppress alert',
  };
}

/**
 * Register the alerts command with the program
 */
export function registerAlertsCommand(program: Command): void {
  const alertsCmd = program
    .command('alerts')
    .description('Manage alerts');
  
  // Default: list alerts
  alertsCmd
    .option('-a, --all', 'Show all alerts (not just active)', false)
    .option('-s, --severity <level>', 'Filter by severity: info, warning, error, critical')
    .option('--status <status>', 'Filter by status: active, acknowledged, resolved, suppressed')
    .option('-p, --project <name>', 'Filter by project')
    .option('-l, --limit <number>', 'Limit number of results', parseInt)
    .action(async (options: AlertsListOptions) => {
      const globalOpts = getGlobalOptions(program);
      
      try {
        const config = await initContext(globalOpts);
        const result = await executeAlertsList(config, options);
        output(result, globalOpts.json, formatAlertsListResult);
      } catch (error: any) {
        handleError(error, globalOpts.json);
      }
    });
  
  // Acknowledge subcommand
  alertsCmd
    .command('ack <id>')
    .description('Acknowledge an alert')
    .action(async (id: string) => {
      const globalOpts = getGlobalOptions(program);
      
      try {
        await initContext(globalOpts);
        const result = await executeAck(id);
        output(result, globalOpts.json, formatActionResult);
        if (!result.success) {
          process.exit(1);
        }
      } catch (error: any) {
        handleError(error, globalOpts.json);
      }
    });
  
  // Resolve subcommand
  alertsCmd
    .command('resolve <id>')
    .description('Resolve an alert')
    .option('-r, --resolution <text>', 'Resolution description')
    .action(async (id: string, options: { resolution?: string }) => {
      const globalOpts = getGlobalOptions(program);
      
      try {
        await initContext(globalOpts);
        const result = await executeResolve(id, options.resolution);
        output(result, globalOpts.json, formatActionResult);
        if (!result.success) {
          process.exit(1);
        }
      } catch (error: any) {
        handleError(error, globalOpts.json);
      }
    });
  
  // Suppress subcommand
  alertsCmd
    .command('suppress <id>')
    .description('Suppress an alert')
    .requiredOption('-u, --until <date>', 'Suppress until date (ISO format)')
    .action(async (id: string, options: { until: string }) => {
      const globalOpts = getGlobalOptions(program);
      
      try {
        await initContext(globalOpts);
        const result = await executeSuppress(id, options.until);
        output(result, globalOpts.json, formatActionResult);
        if (!result.success) {
          process.exit(1);
        }
      } catch (error: any) {
        handleError(error, globalOpts.json);
      }
    });
}
