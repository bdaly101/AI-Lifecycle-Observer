/**
 * GitHub Notification Channel - Creates GitHub issues for alerts
 */

import { execSync } from 'child_process';
import type { Alert } from '../types/index.js';
import type {
  NotificationChannel,
  NotificationResult,
  ChannelOptions,
} from './notification-channel.js';
import { formatCategory, formatAlertDate } from './notification-channel.js';

/**
 * GitHub channel options
 */
export interface GitHubChannelOptions extends ChannelOptions {
  /** Repository owner (e.g., 'username' or 'org') */
  owner?: string;
  /** Repository name */
  repo?: string;
  /** Labels to add to issues (default: ['lifecycle-alert']) */
  labels?: string[];
  /** Assignees for issues */
  assignees?: string[];
  /** Only create issues for these severities (default: ['critical', 'error']) */
  severities?: string[];
  /** Use GitHub CLI (gh) instead of API (default: true) */
  useGhCli?: boolean;
}

/**
 * Default severities that trigger GitHub issues
 */
const DEFAULT_ISSUE_SEVERITIES = ['critical', 'error'];

/**
 * GitHub notification channel
 */
export class GitHubChannel implements NotificationChannel {
  readonly name = 'github';
  private enabled: boolean;
  private owner?: string;
  private repo?: string;
  private labels: string[];
  private assignees: string[];
  private severities: string[];
  private useGhCli: boolean;

  constructor(options?: GitHubChannelOptions) {
    this.enabled = options?.enabled ?? false; // Disabled by default - requires config
    this.owner = options?.owner;
    this.repo = options?.repo;
    this.labels = options?.labels ?? ['lifecycle-alert'];
    this.assignees = options?.assignees ?? [];
    this.severities = options?.severities ?? DEFAULT_ISSUE_SEVERITIES;
    this.useGhCli = options?.useGhCli ?? true;
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

    // Check if severity warrants a GitHub issue
    if (!this.severities.includes(alert.severity)) {
      return {
        success: true,
        channel: this.name,
        details: { skipped: true, reason: 'Severity not in configured list' },
      };
    }

    try {
      const title = this.formatIssueTitle(alert);
      const body = this.formatIssueBody(alert);

      if (this.useGhCli) {
        const issueUrl = await this.createIssueWithCli(title, body);
        return {
          success: true,
          channel: this.name,
          details: { issueUrl },
        };
      } else {
        // API-based creation would go here
        return {
          success: false,
          channel: this.name,
          error: 'API-based issue creation not implemented. Use gh CLI.',
        };
      }
    } catch (error) {
      return {
        success: false,
        channel: this.name,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Create issue using GitHub CLI
   */
  private async createIssueWithCli(title: string, body: string): Promise<string> {
    // Check if gh is available
    try {
      execSync('gh --version', { stdio: 'pipe' });
    } catch {
      throw new Error('GitHub CLI (gh) is not installed or not in PATH');
    }

    // Build command
    const args: string[] = ['gh', 'issue', 'create'];

    // Add repo if specified
    if (this.owner && this.repo) {
      args.push('--repo', `${this.owner}/${this.repo}`);
    }

    args.push('--title', title);
    args.push('--body', body);

    // Add labels
    for (const label of this.labels) {
      args.push('--label', label);
    }

    // Add assignees
    for (const assignee of this.assignees) {
      args.push('--assignee', assignee);
    }

    // Execute command
    try {
      const result = execSync(args.join(' '), {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Parse issue URL from output
      const urlMatch = result.match(/https:\/\/github\.com\/[^\s]+/);
      return urlMatch ? urlMatch[0] : result.trim();
    } catch (error: unknown) {
      const stderr = error instanceof Error && 'stderr' in error
        ? String((error as { stderr: unknown }).stderr)
        : '';
      
      if (stderr.includes('gh auth login')) {
        throw new Error('GitHub CLI not authenticated. Run "gh auth login" first.');
      }
      
      throw error;
    }
  }

  /**
   * Format issue title
   */
  private formatIssueTitle(alert: Alert): string {
    const severityPrefix = this.getSeverityPrefix(alert.severity);
    const toolInfo = alert.tool ? ` [${alert.tool}]` : '';
    return `${severityPrefix}${toolInfo} ${alert.title}`;
  }

  /**
   * Get severity prefix for issue title
   */
  private getSeverityPrefix(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🚨 CRITICAL:';
      case 'error':
        return '❌ ERROR:';
      case 'warning':
        return '⚠️ WARNING:';
      default:
        return '';
    }
  }

  /**
   * Format issue body
   */
  private formatIssueBody(alert: Alert): string {
    const lines: string[] = [
      '## Alert Details',
      '',
      `**Alert ID:** \`${alert.id}\``,
      `**Category:** ${formatCategory(alert.category)}`,
      `**Severity:** ${alert.severity}`,
      `**Status:** ${alert.status}`,
      `**Triggered:** ${formatAlertDate(alert.triggeredAt)}`,
      '',
    ];

    if (alert.tool) {
      lines.push(`**Tool:** ${alert.tool}`);
    }

    if (alert.project) {
      lines.push(`**Project:** ${alert.project}`);
    }

    lines.push('');
    lines.push('## Message');
    lines.push('');
    lines.push(alert.message);
    lines.push('');

    if (alert.relatedExecutions && alert.relatedExecutions.length > 0) {
      lines.push('## Related Executions');
      lines.push('');
      lines.push('```');
      lines.push(alert.relatedExecutions.join('\n'));
      lines.push('```');
      lines.push('');
    }

    if (alert.context && Object.keys(alert.context).length > 0) {
      lines.push('## Context');
      lines.push('');
      lines.push('```json');
      lines.push(JSON.stringify(alert.context, null, 2));
      lines.push('```');
      lines.push('');
    }

    lines.push('---');
    lines.push('');
    lines.push('*This issue was automatically created by [AI-Lifecycle-Observer](https://github.com/bdaly101/AI-Lifecycle-Observer)*');

    return lines.join('\n');
  }
}

/**
 * Create a GitHub notification channel
 */
export function createGitHubChannel(options?: GitHubChannelOptions): GitHubChannel {
  return new GitHubChannel(options);
}

