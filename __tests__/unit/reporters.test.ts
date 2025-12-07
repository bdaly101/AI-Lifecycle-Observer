/**
 * Unit tests for reporters module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateFutureImprovements,
  generateLifecycleImprovements,
  generateUrgentIssues,
  calculateAge,
  getVersion,
  type FutureImprovementsData,
  type LifecycleImprovementsData,
  type UrgentIssuesData,
} from '../../src/reporters/markdown-generator.js';
import type { ImprovementSuggestion, Alert } from '../../src/types/index.js';

// Helper to create mock improvement
function createMockImprovement(overrides: Partial<ImprovementSuggestion> = {}): ImprovementSuggestion {
  return {
    id: 'imp-test-123',
    type: 'performance',
    severity: 'medium',
    scope: 'tool',
    title: 'Test Improvement',
    description: 'Test description',
    suggestedAction: 'Do something',
    affectedTools: ['ai-pr-dev'],
    affectedProjects: ['test-project'],
    detectedAt: new Date('2024-12-07T10:00:00Z'),
    detectedBy: 'rule',
    status: 'open',
    ...overrides,
  };
}

// Helper to create mock alert
function createMockAlert(overrides: Partial<Alert> = {}): Alert {
  return {
    id: 'alert-test-123',
    category: 'tool_failure',
    severity: 'error',
    status: 'active',
    title: 'Test Alert',
    message: 'Test alert message',
    triggeredAt: new Date('2024-12-07T10:00:00Z'),
    triggeredBy: 'test-rule',
    context: {},
    notificationsSent: [],
    ...overrides,
  };
}

describe('markdown-generator', () => {
  describe('generateFutureImprovements', () => {
    it('should generate markdown with project name and last updated', () => {
      const data: FutureImprovementsData = {
        projectName: 'test-project',
        lastUpdated: new Date('2024-12-07T12:00:00Z'),
        urgentIssues: [],
        performanceImprovements: [],
        securityImprovements: [],
        reliabilityImprovements: [],
        featureSuggestions: [],
        documentationImprovements: [],
        integrationImprovements: [],
        metrics: {
          successRate: 0.95,
          successRateTrend: 'stable',
          avgDuration: 5000,
          targetDuration: 4000,
          durationTrend: 'improving',
          openImprovements: 0,
          activeAlerts: 0,
        },
        recentlyResolved: [],
        version: '1.0.0',
      };

      const result = generateFutureImprovements(data);

      expect(result).toContain('# Future Improvements - test-project');
      expect(result).toContain('Auto-updated by Lifecycle Observer Agent');
      expect(result).toContain('2024-12-07');
    });

    it('should show urgent issues in table format', () => {
      const data: FutureImprovementsData = {
        projectName: 'test-project',
        lastUpdated: new Date(),
        urgentIssues: [
          createMockImprovement({ severity: 'urgent', title: 'Urgent Issue 1' }),
          createMockImprovement({ severity: 'high', title: 'High Priority Issue' }),
        ],
        performanceImprovements: [],
        securityImprovements: [],
        reliabilityImprovements: [],
        featureSuggestions: [],
        documentationImprovements: [],
        integrationImprovements: [],
        metrics: {
          successRate: 0.8,
          successRateTrend: 'degrading',
          avgDuration: 10000,
          targetDuration: 5000,
          durationTrend: 'degrading',
          openImprovements: 2,
          activeAlerts: 1,
        },
        recentlyResolved: [],
        version: '1.0.0',
      };

      const result = generateFutureImprovements(data);

      expect(result).toContain('Urgent Issue 1');
      expect(result).toContain('High Priority Issue');
      expect(result).toContain('| ID | Issue | Severity | Detected | Status |');
    });

    it('should show "No urgent issues detected" when empty', () => {
      const data: FutureImprovementsData = {
        projectName: 'test-project',
        lastUpdated: new Date(),
        urgentIssues: [],
        performanceImprovements: [],
        securityImprovements: [],
        reliabilityImprovements: [],
        featureSuggestions: [],
        documentationImprovements: [],
        integrationImprovements: [],
        metrics: {
          successRate: 0.99,
          successRateTrend: 'improving',
          avgDuration: 2000,
          targetDuration: 3000,
          durationTrend: 'improving',
          openImprovements: 0,
          activeAlerts: 0,
        },
        recentlyResolved: [],
        version: '1.0.0',
      };

      const result = generateFutureImprovements(data);

      expect(result).toContain('No urgent issues detected');
    });

    it('should show performance improvements section', () => {
      const data: FutureImprovementsData = {
        projectName: 'test-project',
        lastUpdated: new Date(),
        urgentIssues: [],
        performanceImprovements: [
          createMockImprovement({
            type: 'performance',
            title: 'Slow Database Query',
            detectionContext: 'Detected slow query pattern',
            suggestedAction: 'Add database index',
          }),
        ],
        securityImprovements: [],
        reliabilityImprovements: [],
        featureSuggestions: [],
        documentationImprovements: [],
        integrationImprovements: [],
        metrics: {
          successRate: 0.95,
          successRateTrend: 'stable',
          avgDuration: 5000,
          targetDuration: 4000,
          durationTrend: 'stable',
          openImprovements: 1,
          activeAlerts: 0,
        },
        recentlyResolved: [],
        version: '1.0.0',
      };

      const result = generateFutureImprovements(data);

      expect(result).toContain('## 📈 Performance Improvements');
      expect(result).toContain('Slow Database Query');
      expect(result).toContain('Add database index');
    });

    it('should show metrics summary table', () => {
      const data: FutureImprovementsData = {
        projectName: 'test-project',
        lastUpdated: new Date(),
        urgentIssues: [],
        performanceImprovements: [],
        securityImprovements: [],
        reliabilityImprovements: [],
        featureSuggestions: [],
        documentationImprovements: [],
        integrationImprovements: [],
        metrics: {
          successRate: 0.92,
          successRateTrend: 'improving',
          avgDuration: 3500,
          targetDuration: 3000,
          durationTrend: 'stable',
          openImprovements: 5,
          activeAlerts: 2,
        },
        recentlyResolved: [],
        version: '1.0.0',
      };

      const result = generateFutureImprovements(data);

      expect(result).toContain('## 📊 Metrics Summary');
      expect(result).toContain('Success Rate');
      expect(result).toContain('92.0%');
      expect(result).toContain('Open Improvements');
    });

    it('should show recently resolved improvements', () => {
      const data: FutureImprovementsData = {
        projectName: 'test-project',
        lastUpdated: new Date(),
        urgentIssues: [],
        performanceImprovements: [],
        securityImprovements: [],
        reliabilityImprovements: [],
        featureSuggestions: [],
        documentationImprovements: [],
        integrationImprovements: [],
        metrics: {
          successRate: 0.95,
          successRateTrend: 'stable',
          avgDuration: 5000,
          targetDuration: 4000,
          durationTrend: 'stable',
          openImprovements: 0,
          activeAlerts: 0,
        },
        recentlyResolved: [
          createMockImprovement({
            status: 'resolved',
            statusUpdatedAt: new Date('2024-12-06T10:00:00Z'),
            title: 'Fixed Memory Leak',
          }),
        ],
        version: '1.0.0',
      };

      const result = generateFutureImprovements(data);

      expect(result).toContain('## 📝 Improvement History');
      expect(result).toContain('Fixed Memory Leak');
      expect(result).toContain('Resolved');
    });
  });

  describe('generateLifecycleImprovements', () => {
    it('should generate lifecycle overview', () => {
      const data: LifecycleImprovementsData = {
        lastUpdated: new Date('2024-12-07T12:00:00Z'),
        stats: {
          totalProjects: 5,
          totalExecutions: 100,
          overallSuccessRate: 0.95,
          activeAlerts: 2,
          openImprovements: 10,
        },
        criticalAlerts: [],
        toolMetrics: [
          { tool: 'ai-pr-dev', executions: 30, successRate: 0.9, avgDuration: 5000 },
          { tool: 'ai-test-generator', executions: 20, successRate: 0.95, avgDuration: 8000 },
        ],
        crossProjectPatterns: [],
        successRateTrend: [
          { date: '2024-12-01', rate: 0.9 },
          { date: '2024-12-02', rate: 0.92 },
        ],
        weeklyStats: {
          improvementsDetected: 5,
          improvementsResolved: 3,
          resolutionRate: 0.6,
        },
        recommendations: ['Review ai-pr-dev failures'],
        projectStatuses: [],
        version: '1.0.0',
      };

      const result = generateLifecycleImprovements(data);

      expect(result).toContain('# Dev Lifecycle Improvements');
      expect(result).toContain('Total Projects | 5');
      expect(result).toContain('Total Executions | 100');
      expect(result).toContain('95.0%');
    });

    it('should show tool performance summary', () => {
      const data: LifecycleImprovementsData = {
        lastUpdated: new Date(),
        stats: {
          totalProjects: 3,
          totalExecutions: 50,
          overallSuccessRate: 0.92,
          activeAlerts: 0,
          openImprovements: 5,
        },
        criticalAlerts: [],
        toolMetrics: [
          { tool: 'ai-pr-dev', executions: 20, successRate: 0.85, avgDuration: 5000 },
          { tool: 'ai-test-generator', executions: 30, successRate: 0.97, avgDuration: 10000 },
        ],
        crossProjectPatterns: [],
        successRateTrend: [],
        weeklyStats: {
          improvementsDetected: 2,
          improvementsResolved: 2,
          resolutionRate: 1.0,
        },
        recommendations: [],
        projectStatuses: [],
        version: '1.0.0',
      };

      const result = generateLifecycleImprovements(data);

      expect(result).toContain('## 📊 Tool Performance Summary');
      expect(result).toContain('ai-pr-dev');
      expect(result).toContain('ai-test-generator');
      expect(result).toContain('85.0%');
      expect(result).toContain('97.0%');
    });

    it('should show cross-project patterns', () => {
      const data: LifecycleImprovementsData = {
        lastUpdated: new Date(),
        stats: {
          totalProjects: 3,
          totalExecutions: 50,
          overallSuccessRate: 0.9,
          activeAlerts: 1,
          openImprovements: 3,
        },
        criticalAlerts: [],
        toolMetrics: [],
        crossProjectPatterns: [
          createMockImprovement({
            scope: 'lifecycle',
            title: 'API Rate Limiting Across Projects',
            description: 'Multiple projects hitting rate limits',
            affectedProjects: ['project-a', 'project-b', 'project-c'],
          }),
        ],
        successRateTrend: [],
        weeklyStats: {
          improvementsDetected: 1,
          improvementsResolved: 0,
          resolutionRate: 0,
        },
        recommendations: [],
        projectStatuses: [],
        version: '1.0.0',
      };

      const result = generateLifecycleImprovements(data);

      expect(result).toContain('## 🔄 Cross-Project Patterns');
      expect(result).toContain('API Rate Limiting Across Projects');
      expect(result).toContain('project-a, project-b, project-c');
    });
  });

  describe('generateUrgentIssues', () => {
    it('should show critical alerts', () => {
      const data: UrgentIssuesData = {
        lastUpdated: new Date(),
        criticalAlerts: [
          {
            ...createMockAlert({
              severity: 'critical',
              title: 'Database Connection Failed',
              message: 'Unable to connect to production database',
              project: 'main-api',
            }),
            age: '2h',
          },
        ],
        warnings: [],
        urgentImprovements: [],
        recentlyResolved: [],
        version: '1.0.0',
      };

      const result = generateUrgentIssues(data);

      expect(result).toContain('# Urgent Issues');
      expect(result).toContain('## 🚨 Active Critical Alerts');
      expect(result).toContain('Database Connection Failed');
      expect(result).toContain('main-api');
    });

    it('should show "No critical alerts" when empty', () => {
      const data: UrgentIssuesData = {
        lastUpdated: new Date(),
        criticalAlerts: [],
        warnings: [],
        urgentImprovements: [],
        recentlyResolved: [],
        version: '1.0.0',
      };

      const result = generateUrgentIssues(data);

      expect(result).toContain('No critical alerts active');
    });

    it('should show urgent improvements', () => {
      const data: UrgentIssuesData = {
        lastUpdated: new Date(),
        criticalAlerts: [],
        warnings: [],
        urgentImprovements: [
          createMockImprovement({
            severity: 'urgent',
            type: 'security',
            title: 'Secret Exposed in Logs',
            description: 'API key found in application logs',
            suggestedAction: 'Rotate the API key and sanitize logs',
          }),
        ],
        recentlyResolved: [],
        version: '1.0.0',
      };

      const result = generateUrgentIssues(data);

      expect(result).toContain('## 🔴 Urgent Improvements');
      expect(result).toContain('Secret Exposed in Logs');
      expect(result).toContain('Rotate the API key');
    });

    it('should show recently resolved issues', () => {
      const data: UrgentIssuesData = {
        lastUpdated: new Date(),
        criticalAlerts: [],
        warnings: [],
        urgentImprovements: [],
        recentlyResolved: [
          {
            id: 'alert-resolved-1',
            title: 'Memory Leak Fixed',
            resolvedAt: new Date('2024-12-06T15:00:00Z'),
            resolution: 'Increased memory limit and fixed leak in worker process',
          },
        ],
        version: '1.0.0',
      };

      const result = generateUrgentIssues(data);

      expect(result).toContain('## 📅 Recently Resolved');
      expect(result).toContain('Memory Leak Fixed');
      expect(result).toContain('Increased memory limit');
    });
  });

  describe('calculateAge', () => {
    it('should return days for old dates', () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const age = calculateAge(twoDaysAgo);
      expect(age).toBe('2d');
    });

    it('should return hours for recent dates', () => {
      const threeHoursAgo = new Date();
      threeHoursAgo.setHours(threeHoursAgo.getHours() - 3);

      const age = calculateAge(threeHoursAgo);
      expect(age).toBe('3h');
    });

    it('should return minutes for very recent dates', () => {
      const tenMinutesAgo = new Date();
      tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

      const age = calculateAge(tenMinutesAgo);
      expect(age).toBe('10m');
    });

    it('should return "<1m" for very new dates', () => {
      const now = new Date();

      const age = calculateAge(now);
      expect(age).toBe('<1m');
    });
  });

  describe('getVersion', () => {
    it('should return a version string', () => {
      const version = getVersion();
      expect(version).toBe('1.0.0');
    });
  });
});

