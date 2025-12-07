/**
 * Efficiency Analyzer - Tracks workflow patterns and identifies bottlenecks
 */

import { getExecutions } from '../database/index.js';
import { daysAgo } from '../utils/time.js';
import type {
  ExecutionRecord,
  LifecycleTool,
} from '../types/index.js';

/**
 * Time-based usage pattern
 */
export interface UsagePattern {
  /** Hour of day (0-23) */
  hour: number;
  /** Day of week (0-6, Sunday = 0) */
  dayOfWeek: number;
  /** Total executions */
  executions: number;
  /** Average duration */
  avgDuration: number;
  /** Success rate */
  successRate: number;
}

/**
 * Workflow sequence pattern
 */
export interface WorkflowSequence {
  /** Tools in sequence */
  tools: LifecycleTool[];
  /** Number of times this sequence occurred */
  count: number;
  /** Average total duration of sequence */
  avgTotalDuration: number;
  /** Success rate of complete sequence */
  successRate: number;
}

/**
 * Bottleneck analysis result
 */
export interface Bottleneck {
  /** Type of bottleneck */
  type: 'slow_tool' | 'frequent_failure' | 'high_variance' | 'underutilized';
  /** Tool affected */
  tool: LifecycleTool;
  /** Description */
  description: string;
  /** Impact severity (0-1) */
  severity: number;
  /** Supporting data */
  data: Record<string, number>;
}

/**
 * Tool utilization stats
 */
export interface ToolUtilization {
  /** Tool name */
  tool: LifecycleTool;
  /** Total executions */
  totalExecutions: number;
  /** Percentage of all executions */
  usagePercent: number;
  /** Average executions per day */
  dailyAvg: number;
  /** Days since last use */
  daysSinceLastUse: number;
  /** Is underutilized */
  underutilized: boolean;
}

/**
 * Efficiency analysis result
 */
export interface EfficiencyAnalysis {
  /** Analysis timestamp */
  timestamp: Date;
  /** Period analyzed */
  period: {
    start: Date;
    end: Date;
  };
  /** Total executions analyzed */
  totalExecutions: number;
  /** Overall metrics */
  overall: {
    successRate: number;
    avgDuration: number;
    totalDuration: number;
    executionsPerDay: number;
  };
  /** Tool utilization */
  toolUtilization: ToolUtilization[];
  /** Identified bottlenecks */
  bottlenecks: Bottleneck[];
  /** Usage patterns */
  usagePatterns: UsagePattern[];
  /** Workflow sequences */
  workflowSequences: WorkflowSequence[];
  /** Recommendations */
  recommendations: string[];
}

/**
 * Efficiency Analyzer class
 */
export class EfficiencyAnalyzer {
  /**
   * Run full efficiency analysis
   */
  analyze(options?: { periodDays?: number }): EfficiencyAnalysis {
    const periodDays = options?.periodDays ?? 30;
    const since = daysAgo(periodDays);
    const until = new Date();

    const executions = getExecutions({ since });

    if (executions.length === 0) {
      return this.emptyAnalysis(since, until);
    }

    // Calculate overall metrics
    const overall = this.calculateOverallMetrics(executions, periodDays);

    // Analyze tool utilization
    const toolUtilization = this.analyzeToolUtilization(executions, periodDays);

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(executions);

    // Analyze usage patterns
    const usagePatterns = this.analyzeUsagePatterns(executions);

    // Detect workflow sequences
    const workflowSequences = this.detectWorkflowSequences(executions);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      overall,
      toolUtilization,
      bottlenecks,
      usagePatterns
    );

    return {
      timestamp: new Date(),
      period: { start: since, end: until },
      totalExecutions: executions.length,
      overall,
      toolUtilization,
      bottlenecks,
      usagePatterns,
      workflowSequences,
      recommendations,
    };
  }

  /**
   * Calculate overall metrics
   */
  private calculateOverallMetrics(
    executions: ExecutionRecord[],
    periodDays: number
  ): EfficiencyAnalysis['overall'] {
    const successful = executions.filter((e) => e.status === 'success').length;
    const totalDuration = executions.reduce((sum, e) => sum + e.duration, 0);

    return {
      successRate: executions.length > 0 ? successful / executions.length : 0,
      avgDuration: executions.length > 0 ? totalDuration / executions.length : 0,
      totalDuration,
      executionsPerDay: executions.length / periodDays,
    };
  }

  /**
   * Analyze tool utilization
   */
  private analyzeToolUtilization(
    executions: ExecutionRecord[],
    periodDays: number
  ): ToolUtilization[] {
    const toolStats = new Map<
      LifecycleTool,
      { count: number; lastUsed: Date }
    >();

    for (const exec of executions) {
      const current = toolStats.get(exec.tool) ?? { count: 0, lastUsed: new Date(0) };
      current.count++;
      if (exec.timestamp > current.lastUsed) {
        current.lastUsed = exec.timestamp;
      }
      toolStats.set(exec.tool, current);
    }

    const total = executions.length;
    const now = new Date();
    const results: ToolUtilization[] = [];

    for (const [tool, stats] of toolStats) {
      const daysSinceLastUse = Math.floor(
        (now.getTime() - stats.lastUsed.getTime()) / (1000 * 60 * 60 * 24)
      );
      const dailyAvg = stats.count / periodDays;
      const usagePercent = total > 0 ? (stats.count / total) * 100 : 0;

      // Tool is underutilized if not used in 7+ days or less than 0.5 times per day
      const underutilized = daysSinceLastUse > 7 || dailyAvg < 0.5;

      results.push({
        tool,
        totalExecutions: stats.count,
        usagePercent,
        dailyAvg,
        daysSinceLastUse,
        underutilized,
      });
    }

    return results.sort((a, b) => b.totalExecutions - a.totalExecutions);
  }

  /**
   * Identify bottlenecks in the workflow
   */
  private identifyBottlenecks(executions: ExecutionRecord[]): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    // Group by tool
    const byTool = new Map<LifecycleTool, ExecutionRecord[]>();
    for (const exec of executions) {
      const current = byTool.get(exec.tool) ?? [];
      current.push(exec);
      byTool.set(exec.tool, current);
    }

    for (const [tool, toolExecs] of byTool) {
      if (toolExecs.length < 5) continue; // Need enough data

      const durations = toolExecs.map((e) => e.duration);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const failures = toolExecs.filter((e) => e.status === 'failure').length;
      const failureRate = failures / toolExecs.length;

      // Check for slow tool (avg > 30s)
      if (avgDuration > 30000) {
        bottlenecks.push({
          type: 'slow_tool',
          tool,
          description: `Average execution time is ${(avgDuration / 1000).toFixed(1)}s`,
          severity: Math.min(avgDuration / 60000, 1), // Max severity at 1 minute
          data: { avgDuration, executions: toolExecs.length },
        });
      }

      // Check for frequent failures (> 20% failure rate)
      if (failureRate > 0.2) {
        bottlenecks.push({
          type: 'frequent_failure',
          tool,
          description: `Failure rate is ${(failureRate * 100).toFixed(1)}%`,
          severity: failureRate,
          data: { failureRate, failures, total: toolExecs.length },
        });
      }

      // Check for high variance (std dev > 50% of mean)
      const variance =
        durations.reduce((sum, d) => sum + Math.pow(d - avgDuration, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);
      if (stdDev > avgDuration * 0.5) {
        bottlenecks.push({
          type: 'high_variance',
          tool,
          description: `Execution time varies significantly (±${(stdDev / 1000).toFixed(1)}s)`,
          severity: Math.min(stdDev / avgDuration, 1),
          data: { avgDuration, stdDev, coefficient: stdDev / avgDuration },
        });
      }
    }

    return bottlenecks.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Analyze time-based usage patterns
   */
  private analyzeUsagePatterns(executions: ExecutionRecord[]): UsagePattern[] {
    const patterns = new Map<
      string,
      { executions: number; totalDuration: number; successes: number }
    >();

    for (const exec of executions) {
      const date = exec.timestamp;
      const hour = date.getHours();
      const dayOfWeek = date.getDay();
      const key = `${dayOfWeek}-${hour}`;

      const current = patterns.get(key) ?? { executions: 0, totalDuration: 0, successes: 0 };
      current.executions++;
      current.totalDuration += exec.duration;
      if (exec.status === 'success') current.successes++;
      patterns.set(key, current);
    }

    const results: UsagePattern[] = [];
    for (const [key, data] of patterns) {
      const [dayOfWeek, hour] = key.split('-').map(Number);
      results.push({
        hour: hour!,
        dayOfWeek: dayOfWeek!,
        executions: data.executions,
        avgDuration: data.totalDuration / data.executions,
        successRate: data.successes / data.executions,
      });
    }

    return results.sort((a, b) => b.executions - a.executions);
  }

  /**
   * Detect common workflow sequences
   */
  private detectWorkflowSequences(executions: ExecutionRecord[]): WorkflowSequence[] {
    // Sort by timestamp
    const sorted = [...executions].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Find sequences (tools used within 10 minutes of each other in same project)
    const sequences = new Map<
      string,
      { count: number; totalDuration: number; successes: number }
    >();
    const sequenceWindow = 10 * 60 * 1000; // 10 minutes

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]!;
      const sequence: LifecycleTool[] = [current.tool];
      let totalDuration = current.duration;
      let allSuccess = current.status === 'success';

      // Look for following executions in same project within window
      for (let j = i + 1; j < sorted.length; j++) {
        const next = sorted[j]!;
        if (next.project !== current.project) continue;
        if (next.timestamp.getTime() - current.timestamp.getTime() > sequenceWindow) break;

        // Avoid self-loops
        if (sequence[sequence.length - 1] !== next.tool) {
          sequence.push(next.tool);
          totalDuration += next.duration;
          allSuccess = allSuccess && next.status === 'success';
        }
      }

      if (sequence.length >= 2) {
        const key = sequence.join('→');
        const current = sequences.get(key) ?? { count: 0, totalDuration: 0, successes: 0 };
        current.count++;
        current.totalDuration += totalDuration;
        if (allSuccess) current.successes++;
        sequences.set(key, current);
      }
    }

    const results: WorkflowSequence[] = [];
    for (const [key, data] of sequences) {
      if (data.count >= 2) {
        // Only include sequences that occurred at least twice
        results.push({
          tools: key.split('→') as LifecycleTool[],
          count: data.count,
          avgTotalDuration: data.totalDuration / data.count,
          successRate: data.successes / data.count,
        });
      }
    }

    return results.sort((a, b) => b.count - a.count).slice(0, 10);
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    overall: EfficiencyAnalysis['overall'],
    utilization: ToolUtilization[],
    bottlenecks: Bottleneck[],
    patterns: UsagePattern[]
  ): string[] {
    const recommendations: string[] = [];

    // Overall success rate
    if (overall.successRate < 0.9) {
      recommendations.push(
        `Overall success rate is ${(overall.successRate * 100).toFixed(1)}% - investigate common failure patterns`
      );
    }

    // Underutilized tools
    const underutilized = utilization.filter((u) => u.underutilized);
    if (underutilized.length > 0) {
      recommendations.push(
        `${underutilized.length} tool(s) appear underutilized: ${underutilized.map((u) => u.tool).join(', ')}`
      );
    }

    // Top bottlenecks
    for (const bottleneck of bottlenecks.slice(0, 3)) {
      switch (bottleneck.type) {
        case 'slow_tool':
          recommendations.push(`${bottleneck.tool}: ${bottleneck.description} - consider optimization`);
          break;
        case 'frequent_failure':
          recommendations.push(`${bottleneck.tool}: ${bottleneck.description} - investigate root cause`);
          break;
        case 'high_variance':
          recommendations.push(
            `${bottleneck.tool}: ${bottleneck.description} - inconsistent performance needs investigation`
          );
          break;
      }
    }

    // Low activity times
    const peakHours = patterns
      .filter((p) => p.executions >= 3)
      .sort((a, b) => b.executions - a.executions)
      .slice(0, 3);

    if (peakHours.length > 0) {
      const peakInfo = peakHours
        .map((p) => `${this.formatHour(p.hour)} on ${this.formatDay(p.dayOfWeek)}`)
        .join(', ');
      recommendations.push(`Peak usage times: ${peakInfo}`);
    }

    return recommendations;
  }

  /**
   * Format hour for display
   */
  private formatHour(hour: number): string {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h}${ampm}`;
  }

  /**
   * Format day for display
   */
  private formatDay(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] ?? 'Unknown';
  }

  /**
   * Return empty analysis result
   */
  private emptyAnalysis(start: Date, end: Date): EfficiencyAnalysis {
    return {
      timestamp: new Date(),
      period: { start, end },
      totalExecutions: 0,
      overall: {
        successRate: 0,
        avgDuration: 0,
        totalDuration: 0,
        executionsPerDay: 0,
      },
      toolUtilization: [],
      bottlenecks: [],
      usagePatterns: [],
      workflowSequences: [],
      recommendations: ['No execution data available for analysis'],
    };
  }
}

/**
 * Singleton instance
 */
let analyzerInstance: EfficiencyAnalyzer | null = null;

/**
 * Get the singleton EfficiencyAnalyzer instance
 */
export function getEfficiencyAnalyzer(): EfficiencyAnalyzer {
  if (!analyzerInstance) {
    analyzerInstance = new EfficiencyAnalyzer();
  }
  return analyzerInstance;
}

/**
 * Create a new EfficiencyAnalyzer instance (for testing)
 */
export function createEfficiencyAnalyzer(): EfficiencyAnalyzer {
  return new EfficiencyAnalyzer();
}

