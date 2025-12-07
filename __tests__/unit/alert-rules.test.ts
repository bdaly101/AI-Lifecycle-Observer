/**
 * Unit tests for alert rules
 */

import { describe, it, expect } from 'vitest';
import {
  BUILTIN_ALERT_RULES,
  getEnabledAlertRules,
  getAlertRuleById,
  getAlertRulesByCategory,
  getAlertRulesBySeverity,
  getCriticalAlertRules,
  countRateLimitErrors,
  countConsecutiveFailures,
  countGitErrors,
  hasSecretInOutput,
  getPerformanceDegradation,
} from '../../src/core/alert-rules.js';
import type { ExecutionRecord, AlertRuleContext, MetricsSnapshot } from '../../src/types/index.js';

// Helper to create mock executions
function createMockExecution(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    id: 'test-exec-' + Math.random().toString(36).slice(2),
    timestamp: new Date(),
    tool: 'ai-test-generator',
    project: 'test-project',
    projectPath: '/test/path',
    command: 'generate',
    duration: 1000,
    status: 'success',
    context: { gitBranch: 'main' },
    ...overrides,
  };
}

// Helper to create mock metrics snapshot
function createMockMetrics(overrides: Partial<MetricsSnapshot> = {}): MetricsSnapshot {
  return {
    timestamp: new Date(),
    period: 'daily',
    totalExecutions: 100,
    successfulExecutions: 90,
    failedExecutions: 10,
    successRate: 0.9,
    avgDuration: 1000,
    p50Duration: 800,
    p95Duration: 2000,
    p99Duration: 3000,
    byTool: {},
    byProject: {},
    totalTokensUsed: 0,
    totalApiCalls: 0,
    avgTokensPerExecution: 0,
    improvementsDetected: 0,
    improvementsResolved: 0,
    openImprovements: 0,
    urgentImprovements: 0,
    alertsTriggered: 0,
    alertsResolved: 0,
    activeAlerts: 0,
    criticalAlerts: 0,
    ...overrides,
  };
}

// Helper to create mock context
function createMockContext(
  executions: ExecutionRecord[],
  metrics?: Partial<MetricsSnapshot>
): AlertRuleContext {
  return {
    recentExecutions: executions,
    aggregatedMetrics: createMockMetrics(metrics),
    thresholds: {
      consecutiveFailures: 3,
      failureRateThreshold: 0.3,
      failureRateWindow: 86400000,
      avgDurationMultiplier: 3,
      timeoutThreshold: 300000,
      secretsDetected: true,
      permissionEscalation: true,
      unprotectedBranchPush: true,
      apiFailureRateThreshold: 0.5,
      apiFailureRateWindow: 3600000,
      rateLimitHits: 5,
      gitOperationFailures: 5,
      gitOperationWindow: 3600000,
      coverageDropThreshold: 0.05,
      minimumCoverage: 0.7,
    },
  };
}

describe('Alert Helper Functions', () => {
  describe('countRateLimitErrors', () => {
    it('should count rate limit errors', () => {
      const executions = [
        createMockExecution({ status: 'failure', errorType: 'api_rate_limit' }),
        createMockExecution({ status: 'success' }),
        createMockExecution({ status: 'failure', errorType: 'api_rate_limit' }),
        createMockExecution({ status: 'failure', errorType: 'git_error' }),
      ];
      expect(countRateLimitErrors(executions)).toBe(2);
    });

    it('should return 0 for no rate limit errors', () => {
      const executions = [
        createMockExecution({ status: 'success' }),
        createMockExecution({ status: 'failure', errorType: 'git_error' }),
      ];
      expect(countRateLimitErrors(executions)).toBe(0);
    });
  });

  describe('countConsecutiveFailures', () => {
    it('should count consecutive failures from the start', () => {
      const executions = [
        createMockExecution({ status: 'failure' }),
        createMockExecution({ status: 'failure' }),
        createMockExecution({ status: 'failure' }),
        createMockExecution({ status: 'success' }),
        createMockExecution({ status: 'failure' }),
      ];
      expect(countConsecutiveFailures(executions)).toBe(3);
    });

    it('should return 0 if first execution is success', () => {
      const executions = [
        createMockExecution({ status: 'success' }),
        createMockExecution({ status: 'failure' }),
        createMockExecution({ status: 'failure' }),
      ];
      expect(countConsecutiveFailures(executions)).toBe(0);
    });
  });

  describe('countGitErrors', () => {
    it('should count git errors', () => {
      const executions = [
        createMockExecution({ status: 'failure', errorType: 'git_error' }),
        createMockExecution({ status: 'failure', errorType: 'git_error' }),
        createMockExecution({ status: 'failure', errorType: 'api_error' }),
      ];
      expect(countGitErrors(executions)).toBe(2);
    });
  });

  describe('hasSecretInOutput', () => {
    it('should detect secret in output', () => {
      const executions = [
        createMockExecution({
          metadata: { output: 'API key: sk-abc123def456abc123def456abc123' },
        }),
      ];
      expect(hasSecretInOutput(executions)).toBe(true);
    });

    it('should return false for no secrets', () => {
      const executions = [
        createMockExecution({
          metadata: { output: 'Normal output without secrets' },
        }),
      ];
      expect(hasSecretInOutput(executions)).toBe(false);
    });
  });

  describe('getPerformanceDegradation', () => {
    it('should calculate performance degradation percentage', () => {
      expect(getPerformanceDegradation(2000, 1000)).toBe(100);
      expect(getPerformanceDegradation(1500, 1000)).toBe(50);
      expect(getPerformanceDegradation(1000, 1000)).toBe(0);
    });

    it('should return 0 for zero baseline', () => {
      expect(getPerformanceDegradation(2000, 0)).toBe(0);
    });
  });
});

describe('Built-in Alert Rules', () => {
  it('should have at least 10 built-in rules', () => {
    expect(BUILTIN_ALERT_RULES.length).toBeGreaterThanOrEqual(10);
  });

  it('should have unique rule IDs', () => {
    const ids = BUILTIN_ALERT_RULES.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have all required rule properties', () => {
    for (const rule of BUILTIN_ALERT_RULES) {
      expect(rule.id).toBeDefined();
      expect(rule.name).toBeDefined();
      expect(rule.description).toBeDefined();
      expect(rule.category).toBeDefined();
      expect(rule.severity).toBeDefined();
      expect(rule.condition).toBeInstanceOf(Function);
      expect(typeof rule.enabled).toBe('boolean');
      expect(typeof rule.cooldownMs).toBe('number');
    }
  });

  describe('getEnabledAlertRules', () => {
    it('should return only enabled rules', () => {
      const enabled = getEnabledAlertRules();
      expect(enabled.every((r) => r.enabled)).toBe(true);
    });
  });

  describe('getAlertRuleById', () => {
    it('should find rule by ID', () => {
      const rule = getAlertRuleById('ALERT-SEC-001');
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('Secret Detected');
    });

    it('should return undefined for unknown ID', () => {
      expect(getAlertRuleById('UNKNOWN-RULE')).toBeUndefined();
    });
  });

  describe('getAlertRulesByCategory', () => {
    it('should return rules by category', () => {
      const securityRules = getAlertRulesByCategory('security_breach');
      expect(securityRules.length).toBeGreaterThan(0);
      expect(securityRules.every((r) => r.category === 'security_breach')).toBe(true);
    });
  });

  describe('getAlertRulesBySeverity', () => {
    it('should return rules by severity', () => {
      const criticalRules = getAlertRulesBySeverity('critical');
      expect(criticalRules.length).toBeGreaterThan(0);
      expect(criticalRules.every((r) => r.severity === 'critical')).toBe(true);
    });
  });

  describe('getCriticalAlertRules', () => {
    it('should return only critical rules', () => {
      const criticalRules = getCriticalAlertRules();
      expect(criticalRules.every((r) => r.severity === 'critical')).toBe(true);
    });
  });
});

describe('Alert Rule Conditions', () => {
  describe('ALERT-SEC-001 - Secret Detected', () => {
    const rule = getAlertRuleById('ALERT-SEC-001')!;

    it('should trigger when secret detected in output', () => {
      const executions = [
        createMockExecution({
          metadata: { output: 'AKIAIOSFODNN7EXAMPLE' },
        }),
      ];
      const context = createMockContext(executions);
      expect(rule.condition(context)).toBe(true);
    });

    it('should not trigger for normal output', () => {
      const executions = [
        createMockExecution({
          metadata: { output: 'Normal build output' },
        }),
      ];
      const context = createMockContext(executions);
      expect(rule.condition(context)).toBe(false);
    });
  });

  describe('ALERT-REL-001 - Consecutive Failures', () => {
    const rule = getAlertRuleById('ALERT-REL-001')!;

    it('should trigger when 3+ consecutive failures', () => {
      const executions = [
        createMockExecution({ status: 'failure' }),
        createMockExecution({ status: 'failure' }),
        createMockExecution({ status: 'failure' }),
      ];
      const context = createMockContext(executions);
      expect(rule.condition(context)).toBe(true);
    });

    it('should not trigger for fewer than threshold failures', () => {
      const executions = [
        createMockExecution({ status: 'failure' }),
        createMockExecution({ status: 'failure' }),
        createMockExecution({ status: 'success' }),
      ];
      const context = createMockContext(executions);
      expect(rule.condition(context)).toBe(false);
    });

    it('should auto-resolve when tool succeeds', () => {
      const executions = [createMockExecution({ status: 'success' })];
      const context = createMockContext(executions);
      expect(rule.autoResolve?.(context)).toBe(true);
    });
  });

  describe('ALERT-API-001 - API Rate Limit', () => {
    const rule = getAlertRuleById('ALERT-API-001')!;

    it('should trigger when rate limit threshold exceeded', () => {
      const executions = Array.from({ length: 5 }, () =>
        createMockExecution({ status: 'failure', errorType: 'api_rate_limit' })
      );
      const context = createMockContext(executions);
      expect(rule.condition(context)).toBe(true);
    });

    it('should not trigger below threshold', () => {
      const executions = [
        createMockExecution({ status: 'failure', errorType: 'api_rate_limit' }),
        createMockExecution({ status: 'failure', errorType: 'api_rate_limit' }),
      ];
      const context = createMockContext(executions);
      expect(rule.condition(context)).toBe(false);
    });
  });

  describe('ALERT-PERF-001 - Performance Degradation', () => {
    const rule = getAlertRuleById('ALERT-PERF-001')!;

    it('should trigger when performance degraded significantly', () => {
      const executions = Array.from({ length: 5 }, () =>
        createMockExecution({ duration: 4000 })
      );
      const context = createMockContext(executions, { avgDuration: 1000 });
      expect(rule.condition(context)).toBe(true);
    });

    it('should not trigger for normal performance', () => {
      const executions = Array.from({ length: 5 }, () =>
        createMockExecution({ duration: 1000 })
      );
      const context = createMockContext(executions, { avgDuration: 1000 });
      expect(rule.condition(context)).toBe(false);
    });
  });

  describe('ALERT-CFG-002 - Missing API Key', () => {
    const rule = getAlertRuleById('ALERT-CFG-002')!;

    it('should trigger when API key is missing', () => {
      const executions = [
        createMockExecution({ status: 'failure', errorType: 'api_key_missing' }),
      ];
      const context = createMockContext(executions);
      expect(rule.condition(context)).toBe(true);
    });

    it('should not trigger for other errors', () => {
      const executions = [
        createMockExecution({ status: 'failure', errorType: 'git_error' }),
      ];
      const context = createMockContext(executions);
      expect(rule.condition(context)).toBe(false);
    });
  });
});

