/**
 * Error Collector - Categorizes, analyzes, and tracks errors
 */

import { getExecutions } from '../database/index.js';
import { hoursAgo, daysAgo } from '../utils/time.js';
import type {
  ErrorCategory,
  LifecycleTool,
  ExecutionRecord,
} from '../types/index.js';

/**
 * Pattern for detecting error categories
 */
interface ErrorPattern {
  category: ErrorCategory;
  patterns: (string | RegExp)[];
  priority: number; // Higher priority patterns are checked first
}

/**
 * Error frequency data
 */
export interface ErrorFrequency {
  category: ErrorCategory;
  count: number;
  percentage: number;
  lastOccurrence: Date | null;
  affectedTools: LifecycleTool[];
  affectedProjects: string[];
}

/**
 * Error trend data
 */
export interface ErrorTrend {
  category: ErrorCategory;
  currentPeriod: number;
  previousPeriod: number;
  change: number;
  changePercent: number;
  trend: 'increasing' | 'stable' | 'decreasing';
}

/**
 * Error analysis result
 */
export interface ErrorAnalysis {
  totalErrors: number;
  totalExecutions: number;
  errorRate: number;
  byCategory: ErrorFrequency[];
  byTool: Record<LifecycleTool, number>;
  byProject: Record<string, number>;
  trends: ErrorTrend[];
  mostCommon: ErrorCategory | null;
  recommendations: string[];
}

/**
 * Error detection patterns - ordered by priority
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  // API key issues (highest priority)
  {
    category: 'api_key_missing',
    patterns: [
      /api[_\s]?key/i,
      /apikey/i,
      /ANTHROPIC_API_KEY/,
      /OPENAI_API_KEY/,
      /authentication.*required/i,
      /unauthorized.*api/i,
    ],
    priority: 100,
  },
  // Rate limiting
  {
    category: 'api_rate_limit',
    patterns: [
      /rate[_\s]?limit/i,
      /ratelimit/i,
      /429/,
      /too many requests/i,
      /quota exceeded/i,
      /throttl/i,
    ],
    priority: 95,
  },
  // Timeout
  {
    category: 'timeout',
    patterns: [
      /timeout/i,
      /timed?\s?out/i,
      /ETIMEDOUT/,
      /deadline exceeded/i,
    ],
    priority: 90,
  },
  // Network errors
  {
    category: 'network_error',
    patterns: [
      /network/i,
      /ECONNREFUSED/,
      /ENOTFOUND/,
      /ECONNRESET/,
      /fetch failed/i,
      /connection refused/i,
      /dns/i,
      /socket/i,
    ],
    priority: 85,
  },
  // Permission errors
  {
    category: 'permission_denied',
    patterns: [
      /EPERM/,
      /EACCES/,
      /permission denied/i,
      /access denied/i,
      /forbidden/i,
      /not authorized/i,
    ],
    priority: 80,
  },
  // File not found
  {
    category: 'file_not_found',
    patterns: [
      /ENOENT/,
      /no such file/i,
      /file not found/i,
      /does not exist/i,
      /cannot find/i,
      /missing file/i,
    ],
    priority: 75,
  },
  // Git errors
  {
    category: 'git_error',
    patterns: [
      /git.*error/i,
      /fatal:.*git/i,
      /not a git repository/i,
      /merge conflict/i,
      /checkout failed/i,
      /push failed/i,
      /pull failed/i,
    ],
    priority: 70,
  },
  // Config errors
  {
    category: 'config_invalid',
    patterns: [
      /config.*invalid/i,
      /invalid.*config/i,
      /configuration error/i,
      /missing.*config/i,
      /malformed.*config/i,
    ],
    priority: 65,
  },
  // Parse/syntax errors
  {
    category: 'parse_error',
    patterns: [
      /parse error/i,
      /syntax error/i,
      /SyntaxError/,
      /JSON.*parse/i,
      /unexpected token/i,
      /invalid.*syntax/i,
    ],
    priority: 60,
  },
  // Validation errors
  {
    category: 'validation_error',
    patterns: [
      /validation.*error/i,
      /validation.*failed/i,
      /invalid.*input/i,
      /schema.*error/i,
      /type.*error/i,
    ],
    priority: 55,
  },
  // General API errors (lower priority)
  {
    category: 'api_error',
    patterns: [
      /api.*error/i,
      /APIError/,
      /500/,
      /502/,
      /503/,
      /internal server error/i,
      /service unavailable/i,
    ],
    priority: 50,
  },
];

/**
 * Error Collector class
 */
export class ErrorCollector {

  /**
   * Categorize an error based on its message and stack
   */
  categorizeError(error: Error | unknown): ErrorCategory {
    if (!(error instanceof Error)) {
      return 'unknown';
    }

    const searchText = `${error.name} ${error.message} ${error.stack ?? ''}`;

    // Sort patterns by priority (highest first)
    const sortedPatterns = [...ERROR_PATTERNS].sort((a, b) => b.priority - a.priority);

    for (const { category, patterns } of sortedPatterns) {
      for (const pattern of patterns) {
        if (typeof pattern === 'string') {
          if (searchText.toLowerCase().includes(pattern.toLowerCase())) {
            return category;
          }
        } else if (pattern.test(searchText)) {
          return category;
        }
      }
    }

    return 'unknown';
  }

  /**
   * Get error frequency analysis
   */
  getErrorFrequency(options?: {
    since?: Date;
    tool?: LifecycleTool;
    project?: string;
  }): ErrorFrequency[] {
    const { since = daysAgo(30), tool, project } = options ?? {};

    const executions = getExecutions({
      statuses: ['failure'],
      tools: tool ? [tool] : undefined,
      projects: project ? [project] : undefined,
      since,
    });

    const totalFailures = executions.length;
    if (totalFailures === 0) {
      return [];
    }

    // Group by error category
    const categoryMap = new Map<ErrorCategory, ExecutionRecord[]>();
    for (const exec of executions) {
      const category = exec.errorType ?? 'unknown';
      const existing = categoryMap.get(category) ?? [];
      existing.push(exec);
      categoryMap.set(category, existing);
    }

    // Build frequency data
    const frequencies: ErrorFrequency[] = [];
    for (const [category, records] of categoryMap) {
      const tools = new Set<LifecycleTool>();
      const projects = new Set<string>();
      let lastOccurrence: Date | null = null;

      for (const record of records) {
        tools.add(record.tool);
        projects.add(record.project);
        if (!lastOccurrence || record.timestamp > lastOccurrence) {
          lastOccurrence = record.timestamp;
        }
      }

      frequencies.push({
        category,
        count: records.length,
        percentage: (records.length / totalFailures) * 100,
        lastOccurrence,
        affectedTools: Array.from(tools),
        affectedProjects: Array.from(projects),
      });
    }

    // Sort by count descending
    return frequencies.sort((a, b) => b.count - a.count);
  }

  /**
   * Get error trends comparing two time periods
   */
  getErrorTrends(options?: {
    periodDays?: number;
    tool?: LifecycleTool;
    project?: string;
  }): ErrorTrend[] {
    const { periodDays = 7, tool, project } = options ?? {};

    const currentPeriodStart = daysAgo(periodDays);
    const previousPeriodStart = daysAgo(periodDays * 2);

    // Get errors for both periods
    const currentErrors = getExecutions({
      statuses: ['failure'],
      tools: tool ? [tool] : undefined,
      projects: project ? [project] : undefined,
      since: currentPeriodStart,
    });

    const previousErrors = getExecutions({
      statuses: ['failure'],
      tools: tool ? [tool] : undefined,
      projects: project ? [project] : undefined,
      since: previousPeriodStart,
      until: currentPeriodStart,
    });

    // Count by category for each period
    const currentCounts = new Map<ErrorCategory, number>();
    const previousCounts = new Map<ErrorCategory, number>();

    for (const exec of currentErrors) {
      const category = exec.errorType ?? 'unknown';
      currentCounts.set(category, (currentCounts.get(category) ?? 0) + 1);
    }

    for (const exec of previousErrors) {
      const category = exec.errorType ?? 'unknown';
      previousCounts.set(category, (previousCounts.get(category) ?? 0) + 1);
    }

    // Combine all categories
    const allCategories = new Set([...currentCounts.keys(), ...previousCounts.keys()]);

    // Build trend data
    const trends: ErrorTrend[] = [];
    for (const category of allCategories) {
      const current = currentCounts.get(category) ?? 0;
      const previous = previousCounts.get(category) ?? 0;
      const change = current - previous;
      const changePercent = previous > 0 ? (change / previous) * 100 : current > 0 ? 100 : 0;

      let trend: 'increasing' | 'stable' | 'decreasing';
      if (changePercent > 10) {
        trend = 'increasing';
      } else if (changePercent < -10) {
        trend = 'decreasing';
      } else {
        trend = 'stable';
      }

      trends.push({
        category,
        currentPeriod: current,
        previousPeriod: previous,
        change,
        changePercent,
        trend,
      });
    }

    // Sort by absolute change descending
    return trends.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  }

  /**
   * Analyze errors and generate recommendations
   */
  analyzeErrors(options?: {
    since?: Date;
    tool?: LifecycleTool;
    project?: string;
  }): ErrorAnalysis {
    const { since = daysAgo(30), tool, project } = options ?? {};

    const allExecutions = getExecutions({
      tools: tool ? [tool] : undefined,
      projects: project ? [project] : undefined,
      since,
    });

    const failedExecutions = allExecutions.filter((e) => e.status === 'failure');

    const totalExecutions = allExecutions.length;
    const totalErrors = failedExecutions.length;
    const errorRate = totalExecutions > 0 ? (totalErrors / totalExecutions) * 100 : 0;

    // Get frequency data
    const byCategory = this.getErrorFrequency({ since, tool, project });

    // Count by tool
    const byTool: Record<string, number> = {};
    for (const exec of failedExecutions) {
      byTool[exec.tool] = (byTool[exec.tool] ?? 0) + 1;
    }

    // Count by project
    const byProject: Record<string, number> = {};
    for (const exec of failedExecutions) {
      byProject[exec.project] = (byProject[exec.project] ?? 0) + 1;
    }

    // Get trends
    const trends = this.getErrorTrends({ tool, project });

    // Most common error
    const mostCommon = byCategory.length > 0 ? byCategory[0]?.category ?? null : null;

    // Generate recommendations
    const recommendations = this.generateRecommendations(byCategory, trends, errorRate);

    return {
      totalErrors,
      totalExecutions,
      errorRate,
      byCategory,
      byTool: byTool as Record<LifecycleTool, number>,
      byProject,
      trends,
      mostCommon,
      recommendations,
    };
  }

  /**
   * Check if a specific error category is recurring
   */
  isRecurringError(
    category: ErrorCategory,
    threshold = 3,
    windowHours = 24
  ): boolean {
    const since = hoursAgo(windowHours);
    const errors = getExecutions({
      statuses: ['failure'],
      errorTypes: [category],
      since,
    });

    return errors.length >= threshold;
  }

  /**
   * Get the most recent error of a category
   */
  getMostRecentError(category: ErrorCategory): ExecutionRecord | null {
    const errors = getExecutions({
      statuses: ['failure'],
      errorTypes: [category],
      limit: 1,
    });

    return errors[0] ?? null;
  }

  /**
   * Generate recommendations based on error analysis
   */
  private generateRecommendations(
    frequencies: ErrorFrequency[],
    trends: ErrorTrend[],
    errorRate: number
  ): string[] {
    const recommendations: string[] = [];

    // High error rate warning
    if (errorRate > 20) {
      recommendations.push(
        `High error rate (${errorRate.toFixed(1)}%) - consider investigating root causes`
      );
    }

    // Specific category recommendations
    for (const freq of frequencies.slice(0, 3)) {
      if (freq.count >= 3) {
        recommendations.push(...this.getRecommendationsForCategory(freq.category, freq.count));
      }
    }

    // Trend-based recommendations
    for (const trend of trends) {
      if (trend.trend === 'increasing' && trend.change >= 3) {
        recommendations.push(
          `${trend.category} errors are increasing (+${trend.change}) - needs attention`
        );
      }
    }

    return recommendations;
  }

  /**
   * Get specific recommendations for an error category
   */
  private getRecommendationsForCategory(category: ErrorCategory, count: number): string[] {
    const recommendations: string[] = [];

    switch (category) {
      case 'api_key_missing':
        recommendations.push('Centralize API key management across all tools');
        recommendations.push('Add API key validation before operations');
        break;

      case 'api_rate_limit':
        recommendations.push('Implement exponential backoff retry logic');
        recommendations.push('Consider adding request queuing');
        recommendations.push('Monitor API usage patterns');
        break;

      case 'timeout':
        recommendations.push('Review operation timeouts and increase if needed');
        recommendations.push('Add timeout configuration options');
        break;

      case 'network_error':
        recommendations.push('Add retry logic for transient network failures');
        recommendations.push('Check network connectivity in preflight checks');
        break;

      case 'git_error':
        recommendations.push('Validate git repository state before operations');
        recommendations.push('Add better error messages for common git issues');
        break;

      case 'config_invalid':
        recommendations.push('Add config validation on tool startup');
        recommendations.push('Provide config migration/upgrade tools');
        break;

      case 'file_not_found':
        recommendations.push('Validate file paths before operations');
        recommendations.push('Add better error messages with suggested fixes');
        break;

      case 'permission_denied':
        recommendations.push('Check file permissions in preflight');
        recommendations.push('Run with appropriate permissions');
        break;

      default:
        if (count >= 5) {
          recommendations.push(`Investigate recurring ${category} errors (${count} occurrences)`);
        }
    }

    return recommendations;
  }
}

/**
 * Singleton instance
 */
let errorCollectorInstance: ErrorCollector | null = null;

/**
 * Get the singleton ErrorCollector instance
 */
export function getErrorCollector(): ErrorCollector {
  if (!errorCollectorInstance) {
    errorCollectorInstance = new ErrorCollector();
  }
  return errorCollectorInstance;
}

/**
 * Create a new ErrorCollector instance (for testing)
 */
export function createErrorCollector(): ErrorCollector {
  return new ErrorCollector();
}

