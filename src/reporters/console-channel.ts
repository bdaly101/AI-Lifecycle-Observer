/**
 * Console Notification Channel - Outputs alerts to the console with colors
 */

import type { Alert } from '../types/index.js';
import type {
  NotificationChannel,
  NotificationResult,
  ChannelOptions,
} from './notification-channel.js';
import {
  formatSeverity,
  formatCategory,
  formatAlertDate,
} from './notification-channel.js';

/**
 * ANSI color codes
 */
const Colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgYellow: '\x1b[43m',
} as const;

/**
 * Get color for severity level
 */
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return Colors.bgRed + Colors.white + Colors.bright;
    case 'error':
      return Colors.red + Colors.bright;
    case 'warning':
      return Colors.yellow;
    case 'info':
      return Colors.blue;
    default:
      return Colors.white;
  }
}

/**
 * Console channel options
 */
export interface ConsoleChannelOptions extends ChannelOptions {
  /** Use colors in output (default: true) */
  useColors?: boolean;
  /** Show detailed context (default: false) */
  showContext?: boolean;
  /** Custom output function (default: console.log) */
  output?: (message: string) => void;
}

/**
 * Console notification channel
 */
export class ConsoleChannel implements NotificationChannel {
  readonly name = 'console';
  private enabled: boolean;
  private useColors: boolean;
  private showContext: boolean;
  private output: (message: string) => void;

  constructor(options?: ConsoleChannelOptions) {
    this.enabled = options?.enabled ?? true;
    this.useColors = options?.useColors ?? true;
    this.showContext = options?.showContext ?? false;
    this.output = options?.output ?? console.log;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async send(alert: Alert): Promise<NotificationResult> {
    if (!this.enabled) {
      return {
        success: false,
        channel: this.name,
        error: 'Channel is disabled',
      };
    }

    try {
      const message = this.formatAlert(alert);
      this.output(message);

      return {
        success: true,
        channel: this.name,
      };
    } catch (error) {
      return {
        success: false,
        channel: this.name,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Format an alert for console output
   */
  private formatAlert(alert: Alert): string {
    const c = this.useColors ? Colors : { reset: '', bright: '', dim: '', red: '', green: '', yellow: '', blue: '', magenta: '', cyan: '', white: '', bgRed: '', bgYellow: '' };
    const severityColor = this.useColors ? getSeverityColor(alert.severity) : '';

    const lines: string[] = [
      '',
      `${c.bright}═══════════════════════════════════════════════════════════════${c.reset}`,
      `${severityColor} ${formatSeverity(alert.severity)} ${c.reset}`,
      `${c.bright}═══════════════════════════════════════════════════════════════${c.reset}`,
      '',
      `${c.bright}Title:${c.reset}    ${alert.title}`,
      `${c.bright}Category:${c.reset} ${formatCategory(alert.category)}`,
      `${c.bright}Message:${c.reset}  ${alert.message}`,
      '',
    ];

    if (alert.tool) {
      lines.push(`${c.dim}Tool:${c.reset}     ${alert.tool}`);
    }

    if (alert.project) {
      lines.push(`${c.dim}Project:${c.reset}  ${alert.project}`);
    }

    lines.push(`${c.dim}Time:${c.reset}     ${formatAlertDate(alert.triggeredAt)}`);
    lines.push(`${c.dim}Alert ID:${c.reset} ${alert.id}`);

    if (alert.relatedExecutions && alert.relatedExecutions.length > 0) {
      lines.push(`${c.dim}Related:${c.reset}  ${alert.relatedExecutions.length} execution(s)`);
    }

    if (this.showContext && alert.context && Object.keys(alert.context).length > 0) {
      lines.push('');
      lines.push(`${c.bright}Context:${c.reset}`);
      for (const [key, value] of Object.entries(alert.context)) {
        lines.push(`  ${c.dim}${key}:${c.reset} ${JSON.stringify(value)}`);
      }
    }

    lines.push('');
    lines.push(`${c.dim}───────────────────────────────────────────────────────────────${c.reset}`);
    lines.push('');

    return lines.join('\n');
  }
}

/**
 * Create a console notification channel
 */
export function createConsoleChannel(options?: ConsoleChannelOptions): ConsoleChannel {
  return new ConsoleChannel(options);
}

