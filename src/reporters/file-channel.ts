/**
 * File Notification Channel - Logs alerts to markdown files
 */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { ensureDir } from '../utils/fs.js';
import type { Alert } from '../types/index.js';
import type {
  NotificationChannel,
  NotificationResult,
  ChannelOptions,
} from './notification-channel.js';
import {
  formatCategory,
  formatAlertDate,
} from './notification-channel.js';

/**
 * File channel options
 */
export interface FileChannelOptions extends ChannelOptions {
  /** Path to the log file (default: LIFECYCLE-URGENT-ISSUES.md) */
  filePath?: string;
  /** Maximum number of alerts to keep in file (default: 100) */
  maxAlerts?: number;
  /** Whether to prepend new alerts (default: true) */
  prependNew?: boolean;
}

/**
 * Default file path for urgent issues
 */
const DEFAULT_FILE_PATH = 'LIFECYCLE-URGENT-ISSUES.md';

/**
 * File header for the urgent issues markdown file
 */
const FILE_HEADER = `# Lifecycle Urgent Issues

> Auto-updated by Lifecycle Observer Agent
> This file tracks urgent alerts from the dev lifecycle tools

---

`;

/**
 * File notification channel - logs alerts to markdown
 */
export class FileChannel implements NotificationChannel {
  readonly name = 'file';
  private enabled: boolean;
  private filePath: string;
  private maxAlerts: number;
  private prependNew: boolean;

  constructor(options?: FileChannelOptions) {
    this.enabled = options?.enabled ?? true;
    this.filePath = options?.filePath ?? DEFAULT_FILE_PATH;
    this.maxAlerts = options?.maxAlerts ?? 100;
    this.prependNew = options?.prependNew ?? true;
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
      // Ensure directory exists
      const dir = dirname(this.filePath);
      if (dir && dir !== '.') {
        ensureDir(dir);
      }

      // Format the alert entry
      const entry = this.formatAlertEntry(alert);

      if (this.prependNew) {
        this.prependToFile(entry);
      } else {
        appendFileSync(this.filePath, entry + '\n');
      }

      return {
        success: true,
        channel: this.name,
        details: { filePath: this.filePath },
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
   * Format an alert as a markdown entry
   */
  private formatAlertEntry(alert: Alert): string {
    const severityEmoji = this.getSeverityEmoji(alert.severity);
    const lines: string[] = [
      `## ${severityEmoji} ${alert.title}`,
      '',
      `| Property | Value |`,
      `|----------|-------|`,
      `| **ID** | \`${alert.id}\` |`,
      `| **Severity** | ${alert.severity} |`,
      `| **Category** | ${formatCategory(alert.category)} |`,
      `| **Status** | ${alert.status} |`,
      `| **Triggered** | ${formatAlertDate(alert.triggeredAt)} |`,
    ];

    if (alert.tool) {
      lines.push(`| **Tool** | ${alert.tool} |`);
    }

    if (alert.project) {
      lines.push(`| **Project** | ${alert.project} |`);
    }

    lines.push('');
    lines.push(`**Message:** ${alert.message}`);
    lines.push('');

    if (alert.relatedExecutions && alert.relatedExecutions.length > 0) {
      lines.push(`**Related Executions:** ${alert.relatedExecutions.length}`);
      lines.push('');
      lines.push('```');
      lines.push(alert.relatedExecutions.join('\n'));
      lines.push('```');
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📋';
    }
  }

  /**
   * Prepend content to the file (after the header)
   */
  private prependToFile(entry: string): void {
    if (!existsSync(this.filePath)) {
      // Create new file with header and entry
      writeFileSync(this.filePath, FILE_HEADER + entry);
      return;
    }

    // Read existing content
    const existingContent = readFileSync(this.filePath, 'utf-8');

    // Check if file has our header
    if (existingContent.startsWith('# Lifecycle Urgent Issues')) {
      // Find the end of the header (after the first ---)
      const headerEndIndex = existingContent.indexOf('---');
      if (headerEndIndex !== -1) {
        const afterHeader = existingContent.substring(headerEndIndex + 3).trim();
        const entries = this.parseEntries(afterHeader);

        // Add new entry at the beginning and limit to maxAlerts
        entries.unshift(entry);
        const limitedEntries = entries.slice(0, this.maxAlerts);

        // Rebuild file
        const newContent = FILE_HEADER + limitedEntries.join('\n');
        writeFileSync(this.filePath, newContent);
        return;
      }
    }

    // If file doesn't have our header, prepend header and entry
    writeFileSync(this.filePath, FILE_HEADER + entry + '\n' + existingContent);
  }

  /**
   * Parse entries from file content
   */
  private parseEntries(content: string): string[] {
    // Split by ## to get individual alert entries
    const parts = content.split(/(?=^## )/m).filter((p) => p.trim());
    return parts.map((p) => p.trim() + '\n\n---\n');
  }
}

/**
 * Create a file notification channel
 */
export function createFileChannel(options?: FileChannelOptions): FileChannel {
  return new FileChannel(options);
}

