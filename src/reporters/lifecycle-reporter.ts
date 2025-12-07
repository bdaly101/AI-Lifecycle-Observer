/**
 * Lifecycle Reporter - Generates DEV-LIFECYCLE-IMPROVEMENTS.md with cross-project insights
 */

import * as path from 'path';
import { getLogger } from '../utils/logger.js';
import { writeFileSafe, ensureDir } from '../utils/fs.js';
import { formatDate, daysAgo } from '../utils/time.js';
import {
  generateLifecycleImprovements,
  generateUrgentIssues,
  calculateAge,
  getVersion,
  type LifecycleImprovementsData,
  type UrgentIssuesData,
} from './markdown-generator.js';
import { getImprovements } from '../database/repositories/improvements.js';
import { getAlerts } from '../database/repositories/alerts.js';
import { getMetricsSnapshot, getDailyMetrics } from '../database/repositories/metrics.js';
import type {
  LifecycleObserverConfig,
  ImprovementSuggestion,
  LifecycleTool,
} from '../types/index.js';

const logger = getLogger();

/**
 * Options for generating lifecycle reports
 */
export interface LifecycleReportOptions {
  /** Path to output the lifecycle improvements report */
  lifecycleOutputPath?: string;
  /** Path to output the urgent issues report */
  urgentOutputPath?: string;
  /** Whether to actually write files (false for dry-run) */
  write?: boolean;
  /** Generate lifecycle improvements report */
  generateLifecycle?: boolean;
  /** Generate urgent issues report */
  generateUrgent?: boolean;
}

/**
 * Result of generating lifecycle reports
 */
export interface LifecycleReportResult {
  /** Lifecycle improvements report result */
  lifecycle?: {
    content: string;
    outputPath?: string;
    written: boolean;
    error?: string;
  };
  /** Urgent issues report result */
  urgent?: {
    content: string;
    outputPath?: string;
    written: boolean;
    error?: string;
  };
}

/**
 * Lifecycle Reporter class - generates cross-project reports
 */
export class LifecycleReporter {
  private config: LifecycleObserverConfig;

  constructor(config: LifecycleObserverConfig) {
    this.config = config;
  }

  /**
   * Generate lifecycle-wide reports
   */
  async generateReports(options: LifecycleReportOptions = {}): Promise<LifecycleReportResult> {
    const {
      write = true,
      generateLifecycle = true,
      generateUrgent = true,
    } = options;

    const result: LifecycleReportResult = {};

    if (generateLifecycle) {
      result.lifecycle = await this.generateLifecycleReport(options, write);
    }

    if (generateUrgent) {
      result.urgent = await this.generateUrgentReport(options, write);
    }

    return result;
  }

  /**
   * Generate the lifecycle improvements report
   */
  private async generateLifecycleReport(
    options: LifecycleReportOptions,
    write: boolean
  ): Promise<{ content: string; outputPath?: string; written: boolean; error?: string }> {
    try {
      logger.info('[LifecycleReporter] Generating lifecycle improvements report...');

      // Get overall stats
      const stats = await this.getOverallStats();

      // Get critical alerts
      const criticalAlerts = getAlerts({
        severities: ['critical'],
        statuses: ['active'],
      });

      // Get tool metrics
      const toolMetrics = await this.getToolMetrics();

      // Get cross-project patterns
      const crossProjectPatterns = await this.getCrossProjectPatterns();

      // Get success rate trend for the last 7 days
      const successRateTrend = await this.getSuccessRateTrend();

      // Get weekly stats
      const weeklyStats = await this.getWeeklyStats();

      // Get recommendations
      const recommendations = await this.generateRecommendations(
        stats,
        toolMetrics,
        crossProjectPatterns
      );

      // Get per-project status
      const projectStatuses = await this.getProjectStatuses();

      // Build template data
      const data: LifecycleImprovementsData = {
        lastUpdated: new Date(),
        stats,
        criticalAlerts,
        toolMetrics,
        crossProjectPatterns,
        successRateTrend,
        weeklyStats,
        recommendations,
        projectStatuses,
        version: getVersion(),
      };

      // Generate markdown
      const content = generateLifecycleImprovements(data);

      // Determine output path
      const outputPath = options.lifecycleOutputPath || path.join(
        this.config.projectsDir,
        'DEV-LIFECYCLE-IMPROVEMENTS.md'
      );

      // Write file if requested
      let written = false;
      if (write) {
        try {
          await ensureDir(path.dirname(outputPath));
          await writeFileSafe(outputPath, content);
          written = true;
          logger.info(`[LifecycleReporter] Wrote lifecycle report to ${outputPath}`);
        } catch (writeError: any) {
          logger.error(`[LifecycleReporter] Failed to write lifecycle report: ${writeError.message}`);
          return { content, outputPath, written: false, error: writeError.message };
        }
      }

      return { content, outputPath: written ? outputPath : undefined, written };
    } catch (error: any) {
      logger.error(`[LifecycleReporter] Error generating lifecycle report: ${error.message}`);
      return { content: '', written: false, error: error.message };
    }
  }

  /**
   * Generate the urgent issues report
   */
  private async generateUrgentReport(
    options: LifecycleReportOptions,
    write: boolean
  ): Promise<{ content: string; outputPath?: string; written: boolean; error?: string }> {
    try {
      logger.info('[LifecycleReporter] Generating urgent issues report...');

      // Get critical alerts with age
      const criticalAlerts = getAlerts({
        severities: ['critical'],
        statuses: ['active'],
      }).map((alert) => ({
        ...alert,
        age: calculateAge(alert.triggeredAt),
      }));

      // Get warning-level alerts
      const warnings = getAlerts({
        severities: ['warning'],
        statuses: ['active'],
      }).map((alert) => ({
        ...alert,
        age: calculateAge(alert.triggeredAt),
      }));

      // Get urgent improvements
      const urgentImprovements = getImprovements({
        severities: ['urgent'],
        statuses: ['open', 'in_progress'],
      });

      // Get recently resolved (last 7 days)
      const sevenDaysAgo = daysAgo(7);
      const recentlyResolved = getAlerts({
        statuses: ['resolved'],
        since: sevenDaysAgo,
      }).map((alert) => ({
        id: alert.id,
        title: alert.title,
        resolvedAt: alert.resolvedAt!,
        resolution: alert.resolution || 'No resolution provided',
      }));

      // Build template data
      const data: UrgentIssuesData = {
        lastUpdated: new Date(),
        criticalAlerts,
        warnings,
        urgentImprovements,
        recentlyResolved,
        version: getVersion(),
      };

      // Generate markdown
      const content = generateUrgentIssues(data);

      // Determine output path
      const outputPath = options.urgentOutputPath || path.join(
        this.config.projectsDir,
        'URGENT-ISSUES.md'
      );

      // Write file if requested
      let written = false;
      if (write) {
        try {
          await ensureDir(path.dirname(outputPath));
          await writeFileSafe(outputPath, content);
          written = true;
          logger.info(`[LifecycleReporter] Wrote urgent issues report to ${outputPath}`);
        } catch (writeError: any) {
          logger.error(`[LifecycleReporter] Failed to write urgent report: ${writeError.message}`);
          return { content, outputPath, written: false, error: writeError.message };
        }
      }

      return { content, outputPath: written ? outputPath : undefined, written };
    } catch (error: any) {
      logger.error(`[LifecycleReporter] Error generating urgent report: ${error.message}`);
      return { content: '', written: false, error: error.message };
    }
  }

  /**
   * Get overall statistics
   */
  private async getOverallStats(): Promise<{
    totalProjects: number;
    totalExecutions: number;
    overallSuccessRate: number;
    activeAlerts: number;
    openImprovements: number;
  }> {
    const enabledProjects = this.config.projects.filter((p) => p.enabled);
    const metrics = getMetricsSnapshot({ period: 'weekly' });
    const activeAlerts = getAlerts({ statuses: ['active'] });
    const openImprovements = getImprovements({ statuses: ['open', 'in_progress'] });

    return {
      totalProjects: enabledProjects.length,
      totalExecutions: metrics.totalExecutions,
      overallSuccessRate: metrics.successRate,
      activeAlerts: activeAlerts.length,
      openImprovements: openImprovements.length,
    };
  }

  /**
   * Get metrics per tool
   */
  private async getToolMetrics(): Promise<Array<{
    tool: string;
    executions: number;
    successRate: number;
    avgDuration: number;
  }>> {
    const metrics = getMetricsSnapshot({ period: 'weekly' });
    const tools: LifecycleTool[] = [
      'ai-pr-dev',
      'ai-feature-builder',
      'ai-test-generator',
      'ai-docs-generator',
      'ai-sql-dev',
    ];

    return tools.map((tool) => {
      const toolMetrics = metrics.byTool[tool];
      return {
        tool,
        executions: toolMetrics?.executions ?? 0,
        successRate: toolMetrics?.successRate ?? 0,
        avgDuration: toolMetrics?.avgDuration ?? 0,
      };
    });
  }

  /**
   * Get cross-project patterns (improvements that affect multiple projects)
   */
  private async getCrossProjectPatterns(): Promise<ImprovementSuggestion[]> {
    const improvements = getImprovements({
      scope: 'lifecycle',
      statuses: ['open', 'in_progress'],
    });

    // Also include improvements that affect multiple projects
    const bothScope = getImprovements({
      scope: 'both',
      statuses: ['open', 'in_progress'],
    });

    return [...improvements, ...bothScope].sort((a, b) => {
      const severityOrder: Record<string, number> = {
        urgent: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
    });
  }

  /**
   * Get success rate trend for the last 7 days
   */
  private async getSuccessRateTrend(): Promise<Array<{ date: string; rate: number }>> {
    const result: Array<{ date: string; rate: number }> = [];
    const today = new Date();

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = formatDate(date);

      const dailyMetrics = getDailyMetrics(dateStr, dateStr);

      if (dailyMetrics.length > 0) {
        const total = dailyMetrics.reduce((sum, m) => sum + m.totalExecutions, 0);
        const successful = dailyMetrics.reduce((sum, m) => sum + m.successfulExecutions, 0);
        result.push({
          date: dateStr,
          rate: total > 0 ? successful / total : 0,
        });
      } else {
        result.push({ date: dateStr, rate: 0 });
      }
    }

    return result;
  }

  /**
   * Get weekly stats for improvement resolution
   */
  private async getWeeklyStats(): Promise<{
    improvementsDetected: number;
    improvementsResolved: number;
    resolutionRate: number;
  }> {
    const oneWeekAgo = daysAgo(7);

    const detected = getImprovements({ since: oneWeekAgo }).length;
    const resolved = getImprovements({
      statuses: ['resolved'],
      since: oneWeekAgo,
    }).length;

    return {
      improvementsDetected: detected,
      improvementsResolved: resolved,
      resolutionRate: detected > 0 ? resolved / detected : 0,
    };
  }

  /**
   * Generate recommendations based on current state
   */
  private async generateRecommendations(
    stats: { totalProjects: number; totalExecutions: number; overallSuccessRate: number; activeAlerts: number; openImprovements: number },
    toolMetrics: Array<{ tool: string; executions: number; successRate: number; avgDuration: number }>,
    crossProjectPatterns: ImprovementSuggestion[]
  ): Promise<string[]> {
    const recommendations: string[] = [];

    // Check overall success rate
    if (stats.overallSuccessRate < 0.9) {
      recommendations.push(
        `Overall success rate is ${(stats.overallSuccessRate * 100).toFixed(1)}%. Consider investigating failing tools and improving error handling.`
      );
    }

    // Check for tools with low success rates
    for (const tool of toolMetrics) {
      if (tool.executions > 0 && tool.successRate < 0.8) {
        recommendations.push(
          `${tool.tool} has a ${(tool.successRate * 100).toFixed(1)}% success rate. Review recent failures and consider adding retry logic.`
        );
      }
    }

    // Check for active alerts
    if (stats.activeAlerts > 0) {
      recommendations.push(
        `There are ${stats.activeAlerts} active alerts. Review and acknowledge or resolve them.`
      );
    }

    // Check for open improvements
    if (stats.openImprovements > 10) {
      recommendations.push(
        `There are ${stats.openImprovements} open improvements. Consider prioritizing and addressing the most impactful ones.`
      );
    }

    // Check for cross-project patterns
    const urgentPatterns = crossProjectPatterns.filter((p) => p.severity === 'urgent');
    if (urgentPatterns.length > 0) {
      recommendations.push(
        `There are ${urgentPatterns.length} urgent cross-project patterns that need attention.`
      );
    }

    // If no specific recommendations, add a positive note
    if (recommendations.length === 0) {
      recommendations.push(
        'The dev lifecycle is in good health. Continue monitoring and addressing improvements as they arise.'
      );
    }

    return recommendations;
  }

  /**
   * Get status for each project
   */
  private async getProjectStatuses(): Promise<Array<{
    name: string;
    healthScore: number;
    successRate: number;
    openImprovements: number;
    activeAlerts: number;
    topIssues: ImprovementSuggestion[];
  }>> {
    const statuses: Array<{
      name: string;
      healthScore: number;
      successRate: number;
      openImprovements: number;
      activeAlerts: number;
      topIssues: ImprovementSuggestion[];
    }> = [];

    for (const project of this.config.projects) {
      if (!project.enabled) continue;

      const metrics = getMetricsSnapshot({
        period: 'weekly',
        projects: [project.name],
      });

      const alerts = getAlerts({
        projects: [project.name],
        statuses: ['active'],
      });
      const improvements = getImprovements({
        projects: [project.name],
        statuses: ['open', 'in_progress'],
      });

      // Calculate health score (0-100)
      const healthScore = this.calculateHealthScore(
        metrics.successRate,
        alerts.length,
        improvements.length
      );

      // Get top issues (urgent/high severity)
      const topIssues = improvements
        .filter((i) => i.severity === 'urgent' || i.severity === 'high')
        .slice(0, 3);

      statuses.push({
        name: project.name,
        healthScore,
        successRate: metrics.successRate,
        openImprovements: improvements.length,
        activeAlerts: alerts.length,
        topIssues,
      });
    }

    // Sort by health score (lowest first to highlight problematic projects)
    return statuses.sort((a, b) => a.healthScore - b.healthScore);
  }

  /**
   * Calculate a health score for a project (0-100)
   */
  private calculateHealthScore(
    successRate: number,
    activeAlerts: number,
    openImprovements: number
  ): number {
    let score = 100;

    // Success rate factor (up to -40 points)
    score -= (1 - successRate) * 40;

    // Active alerts factor (up to -30 points)
    score -= Math.min(activeAlerts * 10, 30);

    // Open improvements factor (up to -30 points)
    score -= Math.min(openImprovements * 3, 30);

    return Math.max(0, Math.round(score));
  }
}

// Singleton instance
let reporterInstance: LifecycleReporter | null = null;

/**
 * Create a new LifecycleReporter instance
 */
export function createLifecycleReporter(config: LifecycleObserverConfig): LifecycleReporter {
  reporterInstance = new LifecycleReporter(config);
  return reporterInstance;
}

/**
 * Get the current LifecycleReporter instance
 */
export function getLifecycleReporter(): LifecycleReporter {
  if (!reporterInstance) {
    throw new Error('LifecycleReporter not initialized. Call createLifecycleReporter first.');
  }
  return reporterInstance;
}

