/**
 * Unit tests for detection rules
 */

import { describe, it, expect } from 'vitest';
import {
  getAvgDuration,
  getSuccessRate,
  countErrorType,
  isIncreasingTrend,
  isDecreasingTrend,
  containsSecretPattern,
  BUILTIN_RULES,
  getEnabledRules,
  getRuleById,
  getRulesByType,
} from '../../src/core/detection-rules.js';
import type { ExecutionRecord } from '../../src/types/index.js';

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

describe('Helper Functions', () => {
  describe('getAvgDuration', () => {
    it('should calculate average duration correctly', () => {
      const executions = [
        createMockExecution({ duration: 100 }),
        createMockExecution({ duration: 200 }),
        createMockExecution({ duration: 300 }),
      ];
      expect(getAvgDuration(executions)).toBe(200);
    });

    it('should return 0 for empty array', () => {
      expect(getAvgDuration([])).toBe(0);
    });
  });

  describe('getSuccessRate', () => {
    it('should calculate success rate correctly', () => {
      const executions = [
        createMockExecution({ status: 'success' }),
        createMockExecution({ status: 'success' }),
        createMockExecution({ status: 'failure' }),
        createMockExecution({ status: 'failure' }),
      ];
      expect(getSuccessRate(executions)).toBe(0.5);
    });

    it('should return 1 for empty array', () => {
      expect(getSuccessRate([])).toBe(1);
    });

    it('should return 1 for all successful', () => {
      const executions = [
        createMockExecution({ status: 'success' }),
        createMockExecution({ status: 'success' }),
      ];
      expect(getSuccessRate(executions)).toBe(1);
    });
  });

  describe('countErrorType', () => {
    it('should count matching error types', () => {
      const executions = [
        createMockExecution({ status: 'failure', errorType: 'api_rate_limit' }),
        createMockExecution({ status: 'failure', errorType: 'api_rate_limit' }),
        createMockExecution({ status: 'failure', errorType: 'git_error' }),
      ];
      expect(countErrorType(executions, 'api_rate_limit')).toBe(2);
    });

    it('should return 0 for undefined error type', () => {
      const executions = [createMockExecution({ status: 'failure', errorType: 'api_error' })];
      expect(countErrorType(executions, undefined)).toBe(0);
    });
  });

  describe('isIncreasingTrend', () => {
    it('should detect increasing trend', () => {
      expect(isIncreasingTrend([100, 150, 200, 250, 300])).toBe(true);
    });

    it('should not detect trend for flat values', () => {
      expect(isIncreasingTrend([100, 100, 100, 100, 100])).toBe(false);
    });

    it('should not detect trend for decreasing values', () => {
      expect(isIncreasingTrend([300, 250, 200, 150, 100])).toBe(false);
    });

    it('should return false for too few values', () => {
      expect(isIncreasingTrend([100, 200])).toBe(false);
    });
  });

  describe('isDecreasingTrend', () => {
    it('should detect decreasing trend', () => {
      expect(isDecreasingTrend([300, 250, 200, 150, 100])).toBe(true);
    });

    it('should not detect trend for increasing values', () => {
      expect(isDecreasingTrend([100, 150, 200, 250, 300])).toBe(false);
    });
  });

  describe('containsSecretPattern', () => {
    it('should detect API keys', () => {
      // Pattern requires sk- followed by 20+ alphanumeric chars
      expect(containsSecretPattern('api_key="sk-abc123def456abc123def456abc123"')).toBe(true);
      expect(containsSecretPattern('Bearer sk-1234567890abcdefghij1234567890')).toBe(true);
    });

    it('should detect AWS credentials', () => {
      expect(containsSecretPattern('AKIAIOSFODNN7EXAMPLE')).toBe(true);
    });

    it('should detect private keys', () => {
      expect(containsSecretPattern('-----BEGIN PRIVATE KEY-----')).toBe(true);
      expect(containsSecretPattern('-----BEGIN RSA PRIVATE KEY-----')).toBe(true);
    });

    it('should detect GitHub tokens', () => {
      // Pattern requires ghp_ followed by 36 alphanumeric chars
      expect(containsSecretPattern('ghp_abcdefghijklmnopqrstuvwxyz1234567890')).toBe(true);
    });

    it('should not trigger on normal text', () => {
      expect(containsSecretPattern('This is a normal log message')).toBe(false);
      expect(containsSecretPattern('api version 2.0')).toBe(false);
    });

    it('should handle non-string inputs', () => {
      expect(containsSecretPattern(null)).toBe(false);
      expect(containsSecretPattern(undefined)).toBe(false);
      expect(containsSecretPattern(123)).toBe(false);
    });
  });
});

describe('Built-in Rules', () => {
  it('should have at least 10 built-in rules', () => {
    expect(BUILTIN_RULES.length).toBeGreaterThanOrEqual(10);
  });

  it('should have unique rule IDs', () => {
    const ids = BUILTIN_RULES.map((r) => r.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('should have all required rule properties', () => {
    for (const rule of BUILTIN_RULES) {
      expect(rule.id).toBeDefined();
      expect(rule.name).toBeDefined();
      expect(rule.description).toBeDefined();
      expect(rule.type).toBeDefined();
      expect(rule.severity).toBeDefined();
      expect(rule.scope).toBeDefined();
      expect(rule.suggestedAction).toBeDefined();
      expect(rule.condition).toBeInstanceOf(Function);
      expect(typeof rule.enabled).toBe('boolean');
    }
  });

  describe('getEnabledRules', () => {
    it('should return only enabled rules', () => {
      const enabled = getEnabledRules();
      expect(enabled.every((r) => r.enabled)).toBe(true);
    });
  });

  describe('getRuleById', () => {
    it('should find rule by ID', () => {
      const rule = getRuleById('PERF-001-SLOW-EXECUTION');
      expect(rule).toBeDefined();
      expect(rule?.name).toBe('Slow Execution Detection');
    });

    it('should return undefined for unknown ID', () => {
      expect(getRuleById('UNKNOWN-RULE')).toBeUndefined();
    });
  });

  describe('getRulesByType', () => {
    it('should return rules by type', () => {
      const performanceRules = getRulesByType('performance');
      expect(performanceRules.length).toBeGreaterThan(0);
      expect(performanceRules.every((r) => r.type === 'performance')).toBe(true);
    });
  });
});

describe('Rule Conditions', () => {
  describe('PERF-001-SLOW-EXECUTION', () => {
    const rule = getRuleById('PERF-001-SLOW-EXECUTION')!;

    it('should trigger when execution is 2x slower than average', () => {
      const execution = createMockExecution({ duration: 6000 });
      const history = [
        createMockExecution({ duration: 1000 }),
        createMockExecution({ duration: 2000 }),
        createMockExecution({ duration: 1500 }),
        createMockExecution({ duration: 1500 }),
        createMockExecution({ duration: 2000 }),
      ];

      const result = rule.condition({
        execution,
        toolHistory: history,
        projectHistory: history,
        allHistory: history,
      });

      expect(typeof result === 'boolean' ? result : result.triggered).toBe(true);
    });

    it('should not trigger for normal execution', () => {
      const execution = createMockExecution({ duration: 1500 });
      const history = [
        createMockExecution({ duration: 1000 }),
        createMockExecution({ duration: 2000 }),
        createMockExecution({ duration: 1500 }),
        createMockExecution({ duration: 1500 }),
        createMockExecution({ duration: 2000 }),
      ];

      const result = rule.condition({
        execution,
        toolHistory: history,
        projectHistory: history,
        allHistory: history,
      });

      expect(typeof result === 'boolean' ? result : result.triggered).toBe(false);
    });
  });

  describe('REL-001-REPEATED-ERROR', () => {
    const rule = getRuleById('REL-001-REPEATED-ERROR')!;

    it('should trigger when same error occurs 3+ times', () => {
      const execution = createMockExecution({
        status: 'failure',
        errorType: 'api_rate_limit',
      });
      const history = [
        createMockExecution({ status: 'failure', errorType: 'api_rate_limit' }),
        createMockExecution({ status: 'failure', errorType: 'api_rate_limit' }),
        createMockExecution({ status: 'failure', errorType: 'api_rate_limit' }),
      ];

      const result = rule.condition({
        execution,
        toolHistory: history,
        projectHistory: history,
        allHistory: history,
      });

      expect(typeof result === 'boolean' ? result : result.triggered).toBe(true);
    });
  });

  describe('SEC-001-SECRET-IN-OUTPUT', () => {
    const rule = getRuleById('SEC-001-SECRET-IN-OUTPUT')!;

    it('should trigger when secret pattern found in output', () => {
      const execution = createMockExecution({
        metadata: { output: 'API key: sk-abc123def456abc123def456abc123' },
      });

      const result = rule.condition({
        execution,
        toolHistory: [],
        projectHistory: [],
        allHistory: [],
      });

      expect(typeof result === 'boolean' ? result : result.triggered).toBe(true);
    });

    it('should not trigger for normal output', () => {
      const execution = createMockExecution({
        metadata: { output: 'Tests passed successfully' },
      });

      const result = rule.condition({
        execution,
        toolHistory: [],
        projectHistory: [],
        allHistory: [],
      });

      expect(typeof result === 'boolean' ? result : result.triggered).toBe(false);
    });
  });
});

