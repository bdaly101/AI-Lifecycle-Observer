/**
 * Alert Manager - Core class for managing alerts
 */

import {
  getEnabledAlertRules,
  getAlertRuleById,
  countConsecutiveFailures,
  countRateLimitErrors,
  countGitErrors,
  getPerformanceDegradation,
} from './alert-rules.js';
import { getAvgDuration } from './detection-rules.js';
import {
  insertAlert,
  getAlertById,
  getActiveAlerts as getActiveAlertsFromDb,
  getCriticalAlerts as getCriticalAlertsFromDb,
  acknowledgeAlert as acknowledgeAlertInDb,
  resolveAlert as resolveAlertInDb,
  suppressAlert as suppressAlertInDb,
  addAlertNotification,
  isRuleInCooldown,
} from '../database/index.js';
import { getLogger } from '../utils/logger.js';
import type {
  Alert,
  AlertRule,
  AlertRuleContext,
  AlertThresholds,
  CreateAlertData,
  AlertNotification,
  LifecycleTool,
  ExecutionRecord,
  MetricsSnapshot,
} from '../types/index.js';

/**
 * Default alert thresholds
 */
export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  // Tool-level thresholds
  consecutiveFailures: 3,
  failureRateThreshold: 0.3,
  failureRateWindow: 86400000, // 24 hours
  avgDurationMultiplier: 3,
  timeoutThreshold: 300000, // 5 minutes

  // Security thresholds
  secretsDetected: true,
  permissionEscalation: true,
  unprotectedBranchPush: true,

  // API thresholds
  apiFailureRateThreshold: 0.5,
  apiFailureRateWindow: 3600000, // 1 hour
  rateLimitHits: 5,

  // Git operation thresholds
  gitOperationFailures: 5,
  gitOperationWindow: 3600000, // 1 hour

  // Coverage thresholds
  coverageDropThreshold: 0.05,
  minimumCoverage: 0.7,
};

/**
 * Result of checking alert rules
 */
export interface AlertCheckResult {
  /** Rule that triggered */
  rule: AlertRule;
  /** Context at time of check */
  context: AlertRuleContext;
  /** Rendered message */
  message: string;
  /** Related execution IDs */
  relatedExecutions: string[];
}

/**
 * Options for alert manager
 */
export interface AlertManagerOptions {
  /** Custom thresholds */
  thresholds?: Partial<AlertThresholds>;
  /** Notification handler */
  onAlert?: (alert: Alert) => void | Promise<void>;
}

/**
 * Alert Manager class
 */
export class AlertManager {
  private logger = getLogger();
  private thresholds: AlertThresholds;
  private onAlert?: (alert: Alert) => void | Promise<void>;

  constructor(options?: AlertManagerOptions) {
    this.thresholds = { ...DEFAULT_ALERT_THRESHOLDS, ...options?.thresholds };
    this.onAlert = options?.onAlert;
  }

  /**
   * Check all alert rules against the given context
   */
  async checkRules(
    recentExecutions: ExecutionRecord[],
    aggregatedMetrics: MetricsSnapshot,
    options?: { tool?: LifecycleTool; project?: string }
  ): Promise<Alert[]> {
    const rules = getEnabledAlertRules();
    const triggeredAlerts: Alert[] = [];

    const context: AlertRuleContext = {
      recentExecutions,
      aggregatedMetrics,
      thresholds: this.thresholds,
      tool: options?.tool,
      project: options?.project,
    };

    for (const rule of rules) {
      try {
        // Check cooldown
        if (rule.cooldownMs > 0 && isRuleInCooldown(rule.id, rule.cooldownMs)) {
          this.logger.debug({ ruleId: rule.id }, 'Alert rule in cooldown, skipping');
          continue;
        }

        // Evaluate condition
        const triggered = await Promise.resolve(rule.condition(context));

        if (triggered) {
          // Build message from template
          const message = this.renderMessage(rule.messageTemplate, {
            tool: options?.tool ?? 'Unknown tool',
            project: options?.project ?? 'Unknown project',
            count: this.getCountForRule(rule.id, context),
            percent: this.getPercentForRule(rule.id, context),
            threshold: this.getThresholdForRule(rule.id),
            duration: recentExecutions[0]?.duration ?? 0,
          });

          // Get related executions
          const relatedExecutions = this.getRelatedExecutions(rule.id, context);

          // Create alert
          const alert = await this.triggerAlert({
            category: rule.category,
            severity: rule.severity,
            title: rule.name,
            message,
            tool: options?.tool,
            project: options?.project,
            triggeredBy: rule.id,
            context: {
              ruleId: rule.id,
              ruleName: rule.name,
              thresholds: this.thresholds,
            },
            relatedExecutions,
          });

          triggeredAlerts.push(alert);
          this.logger.info({ alertId: alert.id, ruleId: rule.id }, 'Alert triggered');
        }
      } catch (error) {
        this.logger.error({ error, ruleId: rule.id }, 'Error checking alert rule');
      }
    }

    return triggeredAlerts;
  }

  /**
   * Trigger a new alert
   */
  async triggerAlert(data: CreateAlertData): Promise<Alert> {
    const alert = insertAlert(data);

    // Call notification handler if provided
    if (this.onAlert) {
      try {
        await this.onAlert(alert);
      } catch (error) {
        this.logger.error({ error, alertId: alert.id }, 'Error in alert notification handler');
      }
    }

    return alert;
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(id: string, by: string): Promise<void> {
    acknowledgeAlertInDb(id, by);
    this.logger.info({ alertId: id, by }, 'Alert acknowledged');
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(id: string, by: string, resolution: string): Promise<void> {
    resolveAlertInDb(id, by, resolution);
    this.logger.info({ alertId: id, by, resolution }, 'Alert resolved');
  }

  /**
   * Suppress an alert until a certain date
   */
  async suppressAlert(id: string, until: Date): Promise<void> {
    suppressAlertInDb(id, until);
    this.logger.info({ alertId: id, until }, 'Alert suppressed');
  }

  /**
   * Record a notification sent for an alert
   */
  async recordNotification(alertId: string, notification: AlertNotification): Promise<void> {
    addAlertNotification(alertId, notification);
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): Alert[] {
    return getActiveAlertsFromDb();
  }

  /**
   * Get critical alerts
   */
  getCriticalAlerts(): Alert[] {
    return getCriticalAlertsFromDb();
  }

  /**
   * Get alert by ID
   */
  getAlert(id: string): Alert | null {
    return getAlertById(id);
  }

  /**
   * Check for auto-resolvable alerts
   */
  async checkAutoResolve(
    recentExecutions: ExecutionRecord[],
    aggregatedMetrics: MetricsSnapshot
  ): Promise<Alert[]> {
    const activeAlerts = this.getActiveAlerts();
    const resolvedAlerts: Alert[] = [];

    for (const alert of activeAlerts) {
      const rule = getAlertRuleById(alert.triggeredBy);
      if (!rule?.autoResolve) continue;

      const context: AlertRuleContext = {
        recentExecutions,
        aggregatedMetrics,
        thresholds: this.thresholds,
        tool: alert.tool,
        project: alert.project,
      };

      try {
        const shouldResolve = await Promise.resolve(rule.autoResolve(context));
        if (shouldResolve) {
          await this.resolveAlert(alert.id, 'auto', 'Condition no longer met');
          resolvedAlerts.push(alert);
        }
      } catch (error) {
        this.logger.error({ error, alertId: alert.id }, 'Error checking auto-resolve');
      }
    }

    return resolvedAlerts;
  }

  /**
   * Render message template with variables
   */
  private renderMessage(
    template: string,
    variables: Record<string, string | number | undefined>
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = variables[key];
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Get count value for a specific rule
   */
  private getCountForRule(ruleId: string, context: AlertRuleContext): number {
    switch (ruleId) {
      case 'ALERT-REL-001':
        return countConsecutiveFailures(context.recentExecutions);
      case 'ALERT-API-001':
        return countRateLimitErrors(context.recentExecutions);
      case 'ALERT-INT-001':
        return countGitErrors(context.recentExecutions);
      case 'ALERT-INT-002':
        return context.recentExecutions.filter(
          (e) => e.errorType === 'network_error' || e.errorType === 'timeout'
        ).length;
      case 'ALERT-CFG-001':
        return context.recentExecutions.filter((e) => e.errorType === 'config_invalid').length;
      default:
        return 0;
    }
  }

  /**
   * Get percent value for a specific rule
   */
  private getPercentForRule(ruleId: string, context: AlertRuleContext): string {
    switch (ruleId) {
      case 'ALERT-REL-002': {
        const failures = context.recentExecutions.filter((e) => e.status === 'failure').length;
        const rate = context.recentExecutions.length > 0
          ? (failures / context.recentExecutions.length) * 100
          : 0;
        return rate.toFixed(1);
      }
      case 'ALERT-API-002': {
        const apiErrors = context.recentExecutions.filter(
          (e) => e.errorType === 'api_error' || e.errorType === 'api_rate_limit'
        ).length;
        const rate = context.recentExecutions.length > 0
          ? (apiErrors / context.recentExecutions.length) * 100
          : 0;
        return rate.toFixed(1);
      }
      case 'ALERT-PERF-001': {
        const recentAvg = getAvgDuration(context.recentExecutions.slice(0, 5));
        const degradation = getPerformanceDegradation(
          recentAvg,
          context.aggregatedMetrics.avgDuration
        );
        return degradation.toFixed(1);
      }
      default:
        return '0';
    }
  }

  /**
   * Get threshold value for a specific rule
   */
  private getThresholdForRule(ruleId: string): string {
    switch (ruleId) {
      case 'ALERT-REL-002':
        return (this.thresholds.failureRateThreshold * 100).toFixed(0);
      default:
        return '0';
    }
  }

  /**
   * Get related execution IDs for a rule
   */
  private getRelatedExecutions(ruleId: string, context: AlertRuleContext): string[] {
    switch (ruleId) {
      case 'ALERT-SEC-001':
        // Return executions with secrets
        return context.recentExecutions
          .filter((e) => e.metadata?.output)
          .map((e) => e.id);
      case 'ALERT-REL-001':
        // Return consecutive failures
        return context.recentExecutions
          .filter((e) => e.status === 'failure')
          .slice(0, this.thresholds.consecutiveFailures)
          .map((e) => e.id);
      case 'ALERT-API-001':
        // Return rate limit errors
        return context.recentExecutions
          .filter((e) => e.errorType === 'api_rate_limit')
          .map((e) => e.id);
      default:
        // Return most recent execution
        return context.recentExecutions.slice(0, 1).map((e) => e.id);
    }
  }
}

/**
 * Singleton instance
 */
let managerInstance: AlertManager | null = null;

/**
 * Get the singleton AlertManager instance
 */
export function getAlertManager(options?: AlertManagerOptions): AlertManager {
  if (!managerInstance) {
    managerInstance = new AlertManager(options);
  }
  return managerInstance;
}

/**
 * Create a new AlertManager instance (for testing)
 */
export function createAlertManager(options?: AlertManagerOptions): AlertManager {
  return new AlertManager(options);
}

