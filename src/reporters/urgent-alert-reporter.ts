/**
 * Urgent Alert Reporter - Orchestrates notification channels
 */

import { getLogger } from '../utils/logger.js';
import type { Alert, AlertNotification } from '../types/index.js';
import type {
  NotificationChannel,
  NotificationResult,
} from './notification-channel.js';
import { resultToNotification } from './notification-channel.js';
import { ConsoleChannel, type ConsoleChannelOptions } from './console-channel.js';
import { FileChannel, type FileChannelOptions } from './file-channel.js';
import { GitHubChannel, type GitHubChannelOptions } from './github-channel.js';

/**
 * Configuration for the alert reporter
 */
export interface AlertReporterConfig {
  /** Console channel options */
  console?: ConsoleChannelOptions;
  /** File channel options */
  file?: FileChannelOptions;
  /** GitHub channel options */
  github?: GitHubChannelOptions;
  /** Custom notification channels */
  customChannels?: NotificationChannel[];
  /** Whether to fail fast on channel errors (default: false) */
  failFast?: boolean;
  /** Callback after all notifications sent */
  onComplete?: (alert: Alert, results: NotificationResult[]) => void;
}

/**
 * Result of sending all notifications for an alert
 */
export interface AlertReportResult {
  /** Alert that was reported */
  alert: Alert;
  /** Results from each channel */
  channelResults: NotificationResult[];
  /** Overall success (all enabled channels succeeded) */
  success: boolean;
  /** Number of successful notifications */
  successCount: number;
  /** Number of failed notifications */
  failureCount: number;
  /** Notifications that can be recorded to the alert */
  notifications: AlertNotification[];
}

/**
 * Urgent Alert Reporter - sends alerts through configured channels
 */
export class UrgentAlertReporter {
  private logger = getLogger();
  private channels: NotificationChannel[] = [];
  private failFast: boolean;
  private onComplete?: (alert: Alert, results: NotificationResult[]) => void;

  constructor(config?: AlertReporterConfig) {
    this.failFast = config?.failFast ?? false;
    this.onComplete = config?.onComplete;

    // Initialize default channels
    this.channels.push(new ConsoleChannel(config?.console));
    this.channels.push(new FileChannel(config?.file));
    this.channels.push(new GitHubChannel(config?.github));

    // Add custom channels
    if (config?.customChannels) {
      this.channels.push(...config.customChannels);
    }
  }

  /**
   * Report an alert through all enabled channels
   */
  async report(alert: Alert): Promise<AlertReportResult> {
    const channelResults: NotificationResult[] = [];
    const notifications: AlertNotification[] = [];
    let successCount = 0;
    let failureCount = 0;

    this.logger.info(
      { alertId: alert.id, severity: alert.severity, enabledChannels: this.getEnabledChannelNames() },
      'Reporting alert'
    );

    for (const channel of this.channels) {
      if (!channel.isEnabled()) {
        this.logger.debug({ channel: channel.name }, 'Channel disabled, skipping');
        continue;
      }

      try {
        const result = await channel.send(alert);
        channelResults.push(result);
        notifications.push(resultToNotification(result));

        if (result.success) {
          successCount++;
          this.logger.debug({ channel: channel.name, alertId: alert.id }, 'Notification sent');
        } else {
          failureCount++;
          this.logger.warn(
            { channel: channel.name, alertId: alert.id, error: result.error },
            'Notification failed'
          );

          if (this.failFast) {
            break;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        failureCount++;

        channelResults.push({
          success: false,
          channel: channel.name,
          error: errorMessage,
        });

        notifications.push({
          channel: channel.name,
          sentAt: new Date(),
          success: false,
          error: errorMessage,
        });

        this.logger.error(
          { channel: channel.name, alertId: alert.id, error: errorMessage },
          'Channel threw error'
        );

        if (this.failFast) {
          break;
        }
      }
    }

    const success = failureCount === 0 && successCount > 0;

    // Call completion callback
    if (this.onComplete) {
      try {
        this.onComplete(alert, channelResults);
      } catch (error) {
        this.logger.error({ error }, 'Error in onComplete callback');
      }
    }

    this.logger.info(
      { alertId: alert.id, success, successCount, failureCount },
      'Alert reporting complete'
    );

    return {
      alert,
      channelResults,
      success,
      successCount,
      failureCount,
      notifications,
    };
  }

  /**
   * Report multiple alerts
   */
  async reportMany(alerts: Alert[]): Promise<AlertReportResult[]> {
    const results: AlertReportResult[] = [];

    for (const alert of alerts) {
      const result = await this.report(alert);
      results.push(result);
    }

    return results;
  }

  /**
   * Add a notification channel
   */
  addChannel(channel: NotificationChannel): void {
    this.channels.push(channel);
    this.logger.info({ channel: channel.name }, 'Added notification channel');
  }

  /**
   * Remove a notification channel by name
   */
  removeChannel(name: string): boolean {
    const index = this.channels.findIndex((c) => c.name === name);
    if (index >= 0) {
      this.channels.splice(index, 1);
      this.logger.info({ channel: name }, 'Removed notification channel');
      return true;
    }
    return false;
  }

  /**
   * Get a channel by name
   */
  getChannel(name: string): NotificationChannel | undefined {
    return this.channels.find((c) => c.name === name);
  }

  /**
   * Get all channel names
   */
  getChannelNames(): string[] {
    return this.channels.map((c) => c.name);
  }

  /**
   * Get enabled channel names
   */
  getEnabledChannelNames(): string[] {
    return this.channels.filter((c) => c.isEnabled()).map((c) => c.name);
  }

  /**
   * Check if any channels are enabled
   */
  hasEnabledChannels(): boolean {
    return this.channels.some((c) => c.isEnabled());
  }
}

/**
 * Singleton instance
 */
let reporterInstance: UrgentAlertReporter | null = null;

/**
 * Get the singleton UrgentAlertReporter instance
 */
export function getAlertReporter(config?: AlertReporterConfig): UrgentAlertReporter {
  if (!reporterInstance) {
    reporterInstance = new UrgentAlertReporter(config);
  }
  return reporterInstance;
}

/**
 * Create a new UrgentAlertReporter instance (for testing)
 */
export function createAlertReporter(config?: AlertReporterConfig): UrgentAlertReporter {
  return new UrgentAlertReporter(config);
}

