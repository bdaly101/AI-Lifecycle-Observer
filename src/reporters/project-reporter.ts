/**
 * Project Reporter - Generates FUTURE-IMPROVEMENTS.md for individual projects
 */

import * as path from 'path';
import { getLogger } from '../utils/logger.js';
import { writeFileSafe, ensureDir } from '../utils/fs.js';
import {
  generateFutureImprovements,
  getVersion,
  type FutureImprovementsData,
} from './markdown-generator.js';
import { getImprovements } from '../database/repositories/improvements.js';
import { getAlerts } from '../database/repositories/alerts.js';
import { getMetricsSnapshot } from '../database/repositories/metrics.js';
import type {
  LifecycleObserverConfig,
  ImprovementSuggestion,
  ImprovementType,
  TrendDirection,
  ProjectConfig,
} from '../types/index.js';

const logger = getLogger();

/**
 * Options for generating a project report
 */
export interface ProjectReportOptions {
  /** Project to generate report for */
  project: ProjectConfig;
  /** Path to output the report */
  outputPath?: string;
  /** Whether to actually write the file (false for dry-run) */
  write?: boolean;
}

/**
 * Result of generating a project report
 */
export interface ProjectReportResult {
  /** Project name */
  project: string;
  /** Generated markdown content */
  content: string;
  /** Path where the report was written (if write=true) */
  outputPath?: string;
  /** Whether the file was written */
  written: boolean;
  /** Error if any */
  error?: string;
}

/**
 * Project Reporter class
 */
export class ProjectReporter {
  private config: LifecycleObserverConfig;

  constructor(config: LifecycleObserverConfig) {
    this.config = config;
  }

  /**
   * Generate a report for a single project
   */
  async generateReport(options: ProjectReportOptions): Promise<ProjectReportResult> {
    const { project, write = true } = options;
    const projectName = project.name;

    try {
      logger.info(`[ProjectReporter] Generating report for ${projectName}...`);

      // Get improvements for this project
      const allImprovements = getImprovements({
        projects: [projectName],
        statuses: ['open', 'in_progress'],
      });

      // Categorize improvements by type
      const improvementsByType = this.categorizeImprovements(allImprovements);

      // Get urgent issues (high/urgent severity)
      const urgentIssues = allImprovements.filter(
        (i) => i.severity === 'urgent' || i.severity === 'high'
      );

      // Get recently resolved improvements
      const recentlyResolved = getImprovements({
        projects: [projectName],
        statuses: ['resolved'],
        limit: 10,
      }).sort((a, b) => {
        const aTime = a.statusUpdatedAt?.getTime() ?? 0;
        const bTime = b.statusUpdatedAt?.getTime() ?? 0;
        return bTime - aTime;
      });

      // Get metrics
      const metrics = await this.getProjectMetrics(projectName);

      // Get active alerts for this project
      const alerts = getAlerts({
        projects: [projectName],
        statuses: ['active'],
      });

      // Build template data
      const data: FutureImprovementsData = {
        projectName,
        lastUpdated: new Date(),
        urgentIssues,
        performanceImprovements: improvementsByType.performance,
        securityImprovements: improvementsByType.security,
        reliabilityImprovements: improvementsByType.reliability,
        featureSuggestions: improvementsByType.feature,
        documentationImprovements: improvementsByType.documentation,
        integrationImprovements: improvementsByType.integration,
        metrics: {
          successRate: metrics.successRate,
          successRateTrend: metrics.successRateTrend,
          avgDuration: metrics.avgDuration,
          targetDuration: metrics.targetDuration,
          durationTrend: metrics.durationTrend,
          openImprovements: allImprovements.length,
          activeAlerts: alerts.length,
        },
        recentlyResolved,
        version: getVersion(),
      };

      // Generate markdown
      const content = generateFutureImprovements(data);

      // Determine output path
      const outputPath = options.outputPath || path.join(
        project.path,
        this.config.reporting.futureImprovementsFilename
      );

      // Write file if requested
      let written = false;
      if (write) {
        try {
          await ensureDir(path.dirname(outputPath));
          await writeFileSafe(outputPath, content);
          written = true;
          logger.info(`[ProjectReporter] Wrote report to ${outputPath}`);
        } catch (writeError: any) {
          logger.error(`[ProjectReporter] Failed to write report: ${writeError.message}`);
          return {
            project: projectName,
            content,
            outputPath,
            written: false,
            error: writeError.message,
          };
        }
      }

      return {
        project: projectName,
        content,
        outputPath: written ? outputPath : undefined,
        written,
      };
    } catch (error: any) {
      logger.error(`[ProjectReporter] Error generating report for ${projectName}: ${error.message}`);
      return {
        project: projectName,
        content: '',
        written: false,
        error: error.message,
      };
    }
  }

  /**
   * Generate reports for all configured projects
   */
  async generateAllReports(write = true): Promise<ProjectReportResult[]> {
    const results: ProjectReportResult[] = [];

    for (const project of this.config.projects) {
      if (!project.enabled) {
        logger.debug(`[ProjectReporter] Skipping disabled project: ${project.name}`);
        continue;
      }

      const result = await this.generateReport({ project, write });
      results.push(result);
    }

    return results;
  }

  /**
   * Categorize improvements by type
   */
  private categorizeImprovements(
    improvements: ImprovementSuggestion[]
  ): Record<ImprovementType, ImprovementSuggestion[]> {
    const result: Record<ImprovementType, ImprovementSuggestion[]> = {
      performance: [],
      reliability: [],
      usability: [],
      security: [],
      feature: [],
      documentation: [],
      integration: [],
    };

    for (const improvement of improvements) {
      result[improvement.type].push(improvement);
    }

    // Sort each category by severity (urgent > high > medium > low)
    const severityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };

    for (const type of Object.keys(result) as ImprovementType[]) {
      result[type].sort((a, b) => {
        return (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
      });
    }

    return result;
  }

  /**
   * Get metrics for a project
   */
  private async getProjectMetrics(project: string): Promise<{
    successRate: number;
    successRateTrend: TrendDirection;
    avgDuration: number;
    targetDuration: number;
    durationTrend: TrendDirection;
  }> {
    // Get current metrics
    const currentMetrics = getMetricsSnapshot({
      period: 'weekly',
      projects: [project],
    });

    // Get previous week's metrics for trend calculation
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const previousMetrics = getMetricsSnapshot({
      period: 'weekly',
      projects: [project],
      since: twoWeeksAgo,
      until: oneWeekAgo,
    });

    // Calculate trends
    const successRateTrend = this.calculateTrend(
      previousMetrics.successRate,
      currentMetrics.successRate,
      true // higher is better
    );

    const durationTrend = this.calculateTrend(
      previousMetrics.avgDuration,
      currentMetrics.avgDuration,
      false // lower is better
    );

    // Calculate target duration (e.g., p50 or a fixed target)
    const targetDuration = Math.max(5000, currentMetrics.p50Duration * 0.8);

    return {
      successRate: currentMetrics.successRate,
      successRateTrend,
      avgDuration: currentMetrics.avgDuration,
      targetDuration,
      durationTrend,
    };
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(
    previous: number,
    current: number,
    higherIsBetter: boolean
  ): TrendDirection {
    if (previous === 0 || current === 0) return 'stable';

    const changePercent = ((current - previous) / previous) * 100;
    const threshold = 5; // 5% change threshold

    if (Math.abs(changePercent) < threshold) {
      return 'stable';
    }

    const isImproving = higherIsBetter ? changePercent > 0 : changePercent < 0;
    return isImproving ? 'improving' : 'degrading';
  }
}

// Singleton instance
let reporterInstance: ProjectReporter | null = null;

/**
 * Create a new ProjectReporter instance
 */
export function createProjectReporter(config: LifecycleObserverConfig): ProjectReporter {
  reporterInstance = new ProjectReporter(config);
  return reporterInstance;
}

/**
 * Get the current ProjectReporter instance
 */
export function getProjectReporter(): ProjectReporter {
  if (!reporterInstance) {
    throw new Error('ProjectReporter not initialized. Call createProjectReporter first.');
  }
  return reporterInstance;
}

