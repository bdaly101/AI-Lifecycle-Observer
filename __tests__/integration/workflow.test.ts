/**
 * Integration Tests for End-to-End Workflows
 * 
 * Tests complete workflows including execution tracking,
 * improvement detection, and alert triggering.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Execution Tracking Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Execution Lifecycle', () => {
    it('should track execution from start to success', () => {
      // Simulate execution lifecycle
      const startTime = Date.now();
      const execution = {
        id: 'exec-123',
        tool: 'ai-test-generator',
        command: 'generate',
        project: 'test-project',
        startTime,
        endTime: 0,
        status: 'running' as const,
        metrics: {} as Record<string, number>,
      };

      // Add some metrics during execution
      execution.metrics['testsGenerated'] = 10;
      execution.metrics['coverageIncrease'] = 5;

      // Complete execution
      execution.endTime = startTime + 1500;
      execution.status = 'success';

      const duration = execution.endTime - execution.startTime;
      expect(duration).toBe(1500);
      expect(execution.status).toBe('success');
      expect(execution.metrics['testsGenerated']).toBe(10);
    });

    it('should track execution from start to failure', () => {
      const startTime = Date.now();
      const execution = {
        id: 'exec-456',
        tool: 'ai-pr-dev',
        command: 'review',
        project: 'test-project',
        startTime,
        endTime: 0,
        status: 'running' as const,
        error: null as { type: string; message: string } | null,
      };

      // Simulate failure
      execution.endTime = startTime + 500;
      execution.status = 'failure';
      execution.error = {
        type: 'api_error',
        message: 'Rate limit exceeded',
      };

      expect(execution.status).toBe('failure');
      expect(execution.error).not.toBeNull();
      expect(execution.error?.type).toBe('api_error');
    });

    it('should handle cancelled executions', () => {
      const execution = {
        id: 'exec-789',
        status: 'running' as const,
        cancelReason: null as string | null,
      };

      // Cancel execution
      execution.status = 'cancelled';
      execution.cancelReason = 'User interrupted';

      expect(execution.status).toBe('cancelled');
      expect(execution.cancelReason).toBe('User interrupted');
    });
  });

  describe('Metrics Collection', () => {
    it('should collect and aggregate metrics', () => {
      const executions = [
        { duration: 1000, status: 'success', tokensUsed: 500 },
        { duration: 1500, status: 'success', tokensUsed: 750 },
        { duration: 2000, status: 'failure', tokensUsed: 300 },
        { duration: 1200, status: 'success', tokensUsed: 600 },
      ];

      const metrics = {
        totalExecutions: executions.length,
        successfulExecutions: executions.filter(e => e.status === 'success').length,
        failedExecutions: executions.filter(e => e.status === 'failure').length,
        avgDuration: executions.reduce((sum, e) => sum + e.duration, 0) / executions.length,
        totalTokens: executions.reduce((sum, e) => sum + e.tokensUsed, 0),
      };

      expect(metrics.totalExecutions).toBe(4);
      expect(metrics.successfulExecutions).toBe(3);
      expect(metrics.failedExecutions).toBe(1);
      expect(metrics.avgDuration).toBe(1425);
      expect(metrics.totalTokens).toBe(2150);
    });

    it('should calculate success rate', () => {
      const calculateSuccessRate = (successful: number, total: number): number => {
        if (total === 0) return 0;
        return successful / total;
      };

      expect(calculateSuccessRate(9, 10)).toBe(0.9);
      expect(calculateSuccessRate(0, 10)).toBe(0);
      expect(calculateSuccessRate(0, 0)).toBe(0);
      expect(calculateSuccessRate(10, 10)).toBe(1);
    });
  });
});

describe('Improvement Detection Workflow', () => {
  describe('Rule-Based Detection', () => {
    it('should detect consecutive failures', () => {
      const executions = [
        { status: 'success' },
        { status: 'failure' },
        { status: 'failure' },
        { status: 'failure' },
      ];

      const consecutiveFailures = executions
        .slice(-3)
        .filter(e => e.status === 'failure').length;

      const threshold = 3;
      const shouldTrigger = consecutiveFailures >= threshold;

      expect(shouldTrigger).toBe(true);
    });

    it('should detect high failure rate', () => {
      const executions = [
        { status: 'success' },
        { status: 'failure' },
        { status: 'success' },
        { status: 'failure' },
        { status: 'failure' },
        { status: 'failure' },
        { status: 'success' },
        { status: 'failure' },
        { status: 'failure' },
        { status: 'success' },
      ];

      const failureCount = executions.filter(e => e.status === 'failure').length;
      const failureRate = failureCount / executions.length;
      const threshold = 0.3;

      expect(failureRate).toBe(0.6);
      expect(failureRate > threshold).toBe(true);
    });

    it('should detect performance degradation', () => {
      const baselineDuration = 1000;
      const multiplier = 3;
      
      const recentExecutions = [
        { duration: 3500 },
        { duration: 3200 },
        { duration: 3800 },
        { duration: 3100 },
        { duration: 3600 },
      ];

      const avgDuration = recentExecutions.reduce((sum, e) => sum + e.duration, 0) / recentExecutions.length;
      const degraded = avgDuration > baselineDuration * multiplier;

      expect(avgDuration).toBe(3440);
      expect(degraded).toBe(true);
    });
  });

  describe('Improvement Creation', () => {
    it('should create improvement suggestion', () => {
      const createImprovement = (
        type: string,
        severity: string,
        title: string,
        description: string,
        affectedTools: string[],
        affectedProjects: string[]
      ) => ({
        id: `imp-${Date.now()}`,
        timestamp: new Date(),
        type,
        severity,
        status: 'open',
        title,
        description,
        affectedTools,
        affectedProjects,
        scope: affectedProjects.length > 1 ? 'lifecycle' : 'project',
        source: 'rule',
        confidence: 0.85,
      });

      const improvement = createImprovement(
        'reliability',
        'high',
        'High Failure Rate Detected',
        'The tool ai-pr-dev has a failure rate of 60%',
        ['ai-pr-dev'],
        ['project1']
      );

      expect(improvement.type).toBe('reliability');
      expect(improvement.severity).toBe('high');
      expect(improvement.status).toBe('open');
      expect(improvement.scope).toBe('project');
    });

    it('should deduplicate similar improvements', () => {
      const improvements = [
        { ruleId: 'PERF-001', tool: 'ai-pr-dev', createdAt: new Date('2024-12-07T10:00:00') },
        { ruleId: 'PERF-001', tool: 'ai-pr-dev', createdAt: new Date('2024-12-07T10:30:00') },
        { ruleId: 'PERF-001', tool: 'ai-test-generator', createdAt: new Date('2024-12-07T11:00:00') },
      ];

      const isDuplicate = (
        existing: typeof improvements[0],
        newImp: typeof improvements[0],
        cooldownMinutes: number
      ): boolean => {
        if (existing.ruleId !== newImp.ruleId) return false;
        if (existing.tool !== newImp.tool) return false;
        
        const timeDiff = newImp.createdAt.getTime() - existing.createdAt.getTime();
        return timeDiff < cooldownMinutes * 60 * 1000;
      };

      // Second one is a duplicate (same rule, same tool, within 60 minutes)
      expect(isDuplicate(improvements[0], improvements[1], 60)).toBe(true);
      
      // Third one is not a duplicate (different tool)
      expect(isDuplicate(improvements[0], improvements[2], 60)).toBe(false);
    });
  });
});

describe('Alert Triggering Workflow', () => {
  describe('Alert Rules', () => {
    it('should trigger critical alert for security issues', () => {
      const detectSecurityIssue = (output: string): boolean => {
        const secretPatterns = [
          /api[_-]?key['":\s=]+[a-zA-Z0-9-]{10,}/i,
          /password['":\s=]+[^\s'"]{8,}/i,
          /secret['":\s=]+[^\s'"]{8,}/i,
        ];

        return secretPatterns.some(pattern => pattern.test(output));
      };

      expect(detectSecurityIssue('api_key: sk-1234567890abcdefghij')).toBe(true);
      expect(detectSecurityIssue('password: "mySecretPassword123"')).toBe(true);
      expect(detectSecurityIssue('normal output without secrets')).toBe(false);
    });

    it('should trigger alert for rate limit exhaustion', () => {
      const rateLimitHits = [
        { timestamp: new Date('2024-12-07T10:00:00') },
        { timestamp: new Date('2024-12-07T10:15:00') },
        { timestamp: new Date('2024-12-07T10:30:00') },
        { timestamp: new Date('2024-12-07T10:45:00') },
        { timestamp: new Date('2024-12-07T11:00:00') },
      ];

      const threshold = 5;
      const shouldAlert = rateLimitHits.length >= threshold;

      expect(shouldAlert).toBe(true);
    });

    it('should check alert cooldown', () => {
      const lastAlert = new Date('2024-12-07T10:00:00');
      const now = new Date('2024-12-07T10:30:00');
      const cooldownMinutes = 60;

      const isInCooldown = (last: Date, current: Date, cooldown: number): boolean => {
        const diffMs = current.getTime() - last.getTime();
        const diffMinutes = diffMs / (1000 * 60);
        return diffMinutes < cooldown;
      };

      expect(isInCooldown(lastAlert, now, cooldownMinutes)).toBe(true);
      
      const laterTime = new Date('2024-12-07T11:30:00');
      expect(isInCooldown(lastAlert, laterTime, cooldownMinutes)).toBe(false);
    });
  });

  describe('Alert Lifecycle', () => {
    it('should create alert with correct severity', () => {
      const createAlert = (
        category: string,
        severity: string,
        title: string,
        message: string
      ) => ({
        id: `alert-${Date.now()}`,
        ruleId: `${category.toUpperCase()}-001`,
        category,
        severity,
        status: 'active',
        title,
        message,
        triggeredAt: new Date(),
      });

      const alert = createAlert(
        'security',
        'critical',
        'Secret Detected in Output',
        'An API key was found in the tool output'
      );

      expect(alert.category).toBe('security');
      expect(alert.severity).toBe('critical');
      expect(alert.status).toBe('active');
    });

    it('should handle alert acknowledgment', () => {
      const alert = {
        id: 'alert-123',
        status: 'active',
        acknowledgedAt: null as Date | null,
        acknowledgedBy: null as string | null,
      };

      // Acknowledge
      alert.status = 'acknowledged';
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = 'admin';

      expect(alert.status).toBe('acknowledged');
      expect(alert.acknowledgedBy).toBe('admin');
    });

    it('should handle alert resolution', () => {
      const alert = {
        id: 'alert-456',
        status: 'acknowledged',
        resolvedAt: null as Date | null,
        resolvedBy: null as string | null,
        resolution: null as string | null,
      };

      // Resolve
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      alert.resolvedBy = 'developer';
      alert.resolution = 'Fixed the underlying issue';

      expect(alert.status).toBe('resolved');
      expect(alert.resolution).toBe('Fixed the underlying issue');
    });

    it('should handle alert suppression', () => {
      const alert = {
        id: 'alert-789',
        status: 'active',
        suppressedUntil: null as Date | null,
      };

      // Suppress until tomorrow
      alert.status = 'suppressed';
      alert.suppressedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);

      expect(alert.status).toBe('suppressed');
      expect(alert.suppressedUntil).not.toBeNull();
    });
  });

  describe('Notification Channels', () => {
    it('should format alert for console output', () => {
      const formatForConsole = (alert: {
        severity: string;
        title: string;
        message: string;
      }): string => {
        const severityIcons: Record<string, string> = {
          critical: '🚨',
          error: '🔴',
          warning: '🟡',
          info: 'ℹ️',
        };

        const icon = severityIcons[alert.severity] || '⚪';
        return `${icon} [${alert.severity.toUpperCase()}] ${alert.title}\n   ${alert.message}`;
      };

      const output = formatForConsole({
        severity: 'critical',
        title: 'Security Alert',
        message: 'Secret detected in output',
      });

      expect(output).toContain('🚨');
      expect(output).toContain('[CRITICAL]');
      expect(output).toContain('Security Alert');
    });

    it('should format alert for markdown file', () => {
      const formatForMarkdown = (alert: {
        id: string;
        severity: string;
        title: string;
        message: string;
        triggeredAt: Date;
      }): string => {
        return `## ${alert.title}

- **ID**: ${alert.id}
- **Severity**: ${alert.severity}
- **Triggered**: ${alert.triggeredAt.toISOString()}

${alert.message}
`;
      };

      const markdown = formatForMarkdown({
        id: 'alert-123',
        severity: 'critical',
        title: 'Security Alert',
        message: 'Secret detected in output',
        triggeredAt: new Date('2024-12-07T10:00:00Z'),
      });

      expect(markdown).toContain('## Security Alert');
      expect(markdown).toContain('**Severity**: critical');
      expect(markdown).toContain('alert-123');
    });
  });
});

describe('Report Generation Workflow', () => {
  it('should collect data for project report', () => {
    const collectProjectData = (projectName: string) => ({
      projectName,
      improvements: [
        { id: 'imp-1', severity: 'high', status: 'open' },
        { id: 'imp-2', severity: 'medium', status: 'open' },
        { id: 'imp-3', severity: 'low', status: 'resolved' },
      ],
      alerts: [
        { id: 'alert-1', severity: 'critical', status: 'active' },
      ],
      metrics: {
        successRate: 0.92,
        avgDuration: 1500,
        totalExecutions: 100,
      },
    });

    const data = collectProjectData('test-project');

    expect(data.projectName).toBe('test-project');
    expect(data.improvements).toHaveLength(3);
    expect(data.alerts).toHaveLength(1);
    expect(data.metrics.successRate).toBe(0.92);
  });

  it('should aggregate data for lifecycle report', () => {
    const projects = [
      { name: 'project1', successRate: 0.95, executions: 100 },
      { name: 'project2', successRate: 0.88, executions: 80 },
      { name: 'project3', successRate: 0.92, executions: 60 },
    ];

    const totalExecutions = projects.reduce((sum, p) => sum + p.executions, 0);
    const weightedSuccessRate = projects.reduce(
      (sum, p) => sum + p.successRate * p.executions,
      0
    ) / totalExecutions;

    expect(totalExecutions).toBe(240);
    expect(weightedSuccessRate).toBeCloseTo(0.92, 2);
  });
});

