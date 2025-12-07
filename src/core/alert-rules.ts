/**
 * Alert Rules - Built-in rules for triggering alerts
 */

import {
  containsSecretPattern,
  getAvgDuration,
  getSuccessRate,
} from './detection-rules.js';
import type {
  AlertRule,
  AlertRuleContext,
  AlertCategory,
  AlertSeverity,
  ExecutionRecord,
} from '../types/index.js';

// ============================================================================
// Helper Functions for Alert Conditions
// ============================================================================

/**
 * Count rate limit errors in recent executions
 */
export function countRateLimitErrors(executions: ExecutionRecord[]): number {
  return executions.filter((e) => e.errorType === 'api_rate_limit').length;
}

/**
 * Count consecutive failures from the start of the array (most recent first)
 */
export function countConsecutiveFailures(executions: ExecutionRecord[]): number {
  let count = 0;
  for (const exec of executions) {
    if (exec.status === 'failure') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Count git operation failures
 */
export function countGitErrors(executions: ExecutionRecord[]): number {
  return executions.filter((e) => e.errorType === 'git_error').length;
}

/**
 * Check if any execution contains a secret in output
 */
export function hasSecretInOutput(executions: ExecutionRecord[]): boolean {
  return executions.some((e) => containsSecretPattern(e.metadata?.output));
}

/**
 * Calculate performance degradation percentage
 */
export function getPerformanceDegradation(
  recentAvg: number,
  baselineAvg: number
): number {
  if (baselineAvg === 0) return 0;
  return ((recentAvg - baselineAvg) / baselineAvg) * 100;
}

/**
 * Get the execution that triggered an alert condition
 */
export function getTriggeringExecution(
  executions: ExecutionRecord[],
  predicate: (e: ExecutionRecord) => boolean
): ExecutionRecord | undefined {
  return executions.find(predicate);
}

// ============================================================================
// Built-in Alert Rules
// ============================================================================

export const BUILTIN_ALERT_RULES: AlertRule[] = [
  // -------------------------------------------------------------------------
  // Security Alerts (Critical)
  // -------------------------------------------------------------------------
  {
    id: 'ALERT-SEC-001',
    name: 'Secret Detected',
    description: 'Potential secret or credential detected in tool output',
    enabled: true,
    category: 'security_breach',
    severity: 'critical',
    condition: (ctx: AlertRuleContext): boolean => {
      return hasSecretInOutput(ctx.recentExecutions);
    },
    messageTemplate: 'Potential secret detected in {{tool}} output. Immediate review required.',
    cooldownMs: 0, // No cooldown - always alert on secrets
  },

  // -------------------------------------------------------------------------
  // Reliability Alerts
  // -------------------------------------------------------------------------
  {
    id: 'ALERT-REL-001',
    name: 'Consecutive Failures',
    description: 'Tool has failed multiple times in a row',
    enabled: true,
    category: 'tool_failure',
    severity: 'critical',
    condition: (ctx: AlertRuleContext): boolean => {
      const consecutiveFailures = countConsecutiveFailures(ctx.recentExecutions);
      return consecutiveFailures >= ctx.thresholds.consecutiveFailures;
    },
    messageTemplate: '{{tool}} has failed {{count}} consecutive times',
    cooldownMs: 3600000, // 1 hour
    autoResolve: (ctx: AlertRuleContext): boolean => {
      // Auto-resolve when tool succeeds again
      const recent = ctx.recentExecutions[0];
      return recent?.status === 'success';
    },
  },

  {
    id: 'ALERT-REL-002',
    name: 'High Failure Rate',
    description: 'Tool failure rate exceeds threshold',
    enabled: true,
    category: 'tool_failure',
    severity: 'error',
    condition: (ctx: AlertRuleContext): boolean => {
      if (ctx.recentExecutions.length < 5) return false;
      const failureRate = 1 - getSuccessRate(ctx.recentExecutions);
      return failureRate >= ctx.thresholds.failureRateThreshold;
    },
    messageTemplate: '{{tool}} failure rate is {{percent}}% (threshold: {{threshold}}%)',
    cooldownMs: 7200000, // 2 hours
  },

  // -------------------------------------------------------------------------
  // API Alerts
  // -------------------------------------------------------------------------
  {
    id: 'ALERT-API-001',
    name: 'API Rate Limit',
    description: 'API rate limit has been hit multiple times',
    enabled: true,
    category: 'api_exhaustion',
    severity: 'error',
    condition: (ctx: AlertRuleContext): boolean => {
      const rateLimitHits = countRateLimitErrors(ctx.recentExecutions);
      return rateLimitHits >= ctx.thresholds.rateLimitHits;
    },
    messageTemplate: 'API rate limit hit {{count}} times in the last hour',
    cooldownMs: 1800000, // 30 minutes
  },

  {
    id: 'ALERT-API-002',
    name: 'API Failure Rate',
    description: 'API call failure rate is too high',
    enabled: true,
    category: 'api_exhaustion',
    severity: 'warning',
    condition: (ctx: AlertRuleContext): boolean => {
      const apiErrors = ctx.recentExecutions.filter(
        (e) => e.errorType === 'api_error' || e.errorType === 'api_rate_limit'
      ).length;
      if (ctx.recentExecutions.length < 5) return false;
      const failureRate = apiErrors / ctx.recentExecutions.length;
      return failureRate >= ctx.thresholds.apiFailureRateThreshold;
    },
    messageTemplate: 'API failure rate is {{percent}}%',
    cooldownMs: 3600000, // 1 hour
  },

  // -------------------------------------------------------------------------
  // Performance Alerts
  // -------------------------------------------------------------------------
  {
    id: 'ALERT-PERF-001',
    name: 'Performance Degradation',
    description: 'Tool execution time has significantly increased',
    enabled: true,
    category: 'performance_degradation',
    severity: 'warning',
    condition: (ctx: AlertRuleContext): boolean => {
      if (ctx.recentExecutions.length < 5) return false;
      const recentAvg = getAvgDuration(ctx.recentExecutions.slice(0, 5));
      const baselineAvg = ctx.aggregatedMetrics.avgDuration;
      if (baselineAvg === 0) return false;
      return recentAvg > baselineAvg * ctx.thresholds.avgDurationMultiplier;
    },
    messageTemplate: '{{tool}} performance degraded by {{percent}}%',
    cooldownMs: 7200000, // 2 hours
  },

  {
    id: 'ALERT-PERF-002',
    name: 'Execution Timeout',
    description: 'Tool execution exceeded timeout threshold',
    enabled: true,
    category: 'performance_degradation',
    severity: 'error',
    condition: (ctx: AlertRuleContext): boolean => {
      const recent = ctx.recentExecutions[0];
      return (
        recent?.status === 'timeout' ||
        (recent?.duration ?? 0) > ctx.thresholds.timeoutThreshold
      );
    },
    messageTemplate: '{{tool}} execution timed out after {{duration}}ms',
    cooldownMs: 1800000, // 30 minutes
  },

  // -------------------------------------------------------------------------
  // Integration Alerts
  // -------------------------------------------------------------------------
  {
    id: 'ALERT-INT-001',
    name: 'Git Operation Failures',
    description: 'Multiple git operations have failed',
    enabled: true,
    category: 'integration_break',
    severity: 'error',
    condition: (ctx: AlertRuleContext): boolean => {
      const gitErrors = countGitErrors(ctx.recentExecutions);
      return gitErrors >= ctx.thresholds.gitOperationFailures;
    },
    messageTemplate: 'Git operations failed {{count}} times in the last hour',
    cooldownMs: 3600000, // 1 hour
  },

  {
    id: 'ALERT-INT-002',
    name: 'Network Connectivity Issues',
    description: 'Multiple network-related failures detected',
    enabled: true,
    category: 'integration_break',
    severity: 'warning',
    condition: (ctx: AlertRuleContext): boolean => {
      const networkErrors = ctx.recentExecutions.filter(
        (e) => e.errorType === 'network_error' || e.errorType === 'timeout'
      ).length;
      return networkErrors >= 3;
    },
    messageTemplate: 'Network connectivity issues detected ({{count}} failures)',
    cooldownMs: 1800000, // 30 minutes
  },

  // -------------------------------------------------------------------------
  // Configuration Alerts
  // -------------------------------------------------------------------------
  {
    id: 'ALERT-CFG-001',
    name: 'Configuration Errors',
    description: 'Multiple configuration-related failures',
    enabled: true,
    category: 'config_invalid',
    severity: 'warning',
    condition: (ctx: AlertRuleContext): boolean => {
      const configErrors = ctx.recentExecutions.filter(
        (e) => e.errorType === 'config_invalid'
      ).length;
      return configErrors >= 2;
    },
    messageTemplate: 'Configuration errors detected in {{tool}} ({{count}} occurrences)',
    cooldownMs: 3600000, // 1 hour
  },

  {
    id: 'ALERT-CFG-002',
    name: 'Missing API Key',
    description: 'API key configuration is missing',
    enabled: true,
    category: 'config_invalid',
    severity: 'error',
    condition: (ctx: AlertRuleContext): boolean => {
      const recent = ctx.recentExecutions[0];
      return recent?.errorType === 'api_key_missing';
    },
    messageTemplate: 'API key not configured for {{tool}}',
    cooldownMs: 300000, // 5 minutes
  },
];

// ============================================================================
// Rule Management Functions
// ============================================================================

/**
 * Get all enabled alert rules
 */
export function getEnabledAlertRules(): AlertRule[] {
  return BUILTIN_ALERT_RULES.filter((rule) => rule.enabled);
}

/**
 * Get an alert rule by ID
 */
export function getAlertRuleById(id: string): AlertRule | undefined {
  return BUILTIN_ALERT_RULES.find((rule) => rule.id === id);
}

/**
 * Get alert rules by category
 */
export function getAlertRulesByCategory(category: AlertCategory): AlertRule[] {
  return BUILTIN_ALERT_RULES.filter((rule) => rule.category === category);
}

/**
 * Get alert rules by severity
 */
export function getAlertRulesBySeverity(severity: AlertSeverity): AlertRule[] {
  return BUILTIN_ALERT_RULES.filter((rule) => rule.severity === severity);
}

/**
 * Get critical alert rules
 */
export function getCriticalAlertRules(): AlertRule[] {
  return getAlertRulesBySeverity('critical');
}

