/**
 * Notification Channel - Base interface for alert notifications
 */

import type { Alert, AlertNotification } from '../types/index.js';

/**
 * Result of sending a notification
 */
export interface NotificationResult {
  /** Whether the notification was sent successfully */
  success: boolean;
  /** Channel used */
  channel: string;
  /** Error message if failed */
  error?: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Notification channel interface
 */
export interface NotificationChannel {
  /** Unique name for this channel */
  readonly name: string;
  
  /** Whether this channel is enabled */
  isEnabled(): boolean;
  
  /**
   * Send a notification for an alert
   * @param alert The alert to notify about
   * @returns Result of the notification attempt
   */
  send(alert: Alert): Promise<NotificationResult>;
}

/**
 * Options for notification channels
 */
export interface ChannelOptions {
  /** Whether the channel is enabled */
  enabled?: boolean;
}

/**
 * Convert NotificationResult to AlertNotification
 */
export function resultToNotification(result: NotificationResult): AlertNotification {
  return {
    channel: result.channel,
    sentAt: new Date(),
    success: result.success,
    error: result.error,
  };
}

/**
 * Format alert severity for display
 */
export function formatSeverity(severity: string): string {
  const severityMap: Record<string, string> = {
    critical: '🚨 CRITICAL',
    error: '❌ ERROR',
    warning: '⚠️ WARNING',
    info: 'ℹ️ INFO',
  };
  return severityMap[severity] ?? severity.toUpperCase();
}

/**
 * Format alert category for display
 */
export function formatCategory(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format date for display
 */
export function formatAlertDate(date: Date): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Build a formatted alert summary
 */
export function buildAlertSummary(alert: Alert): string {
  const lines: string[] = [
    `Alert: ${alert.title}`,
    `Severity: ${alert.severity}`,
    `Category: ${formatCategory(alert.category)}`,
    `Message: ${alert.message}`,
  ];

  if (alert.tool) {
    lines.push(`Tool: ${alert.tool}`);
  }

  if (alert.project) {
    lines.push(`Project: ${alert.project}`);
  }

  lines.push(`Triggered: ${formatAlertDate(alert.triggeredAt)}`);
  lines.push(`ID: ${alert.id}`);

  return lines.join('\n');
}

