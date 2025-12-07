/**
 * Improvement Detector - Core engine for detecting improvements
 */

import {
  getEnabledRules,
  getRuleById,
  type DetectionRule,
  type RuleContext,
  type TriggeredImprovement,
} from './detection-rules.js';
import {
  getExecutions,
  getRecentExecutions,
  insertImprovement,
  getImprovements,
} from '../database/index.js';
import { getLogger } from '../utils/logger.js';
import { daysAgo, hoursAgo } from '../utils/time.js';
import type {
  ExecutionRecord,
  ImprovementSuggestion,
  CreateImprovementData,
  LifecycleTool,
} from '../types/index.js';

/**
 * Options for running detection
 */
export interface DetectionOptions {
  /** Only run specific rule IDs */
  ruleIds?: string[];
  /** Only check executions since this date */
  since?: Date;
  /** Limit to specific tools */
  tools?: LifecycleTool[];
  /** Limit to specific projects */
  projects?: string[];
  /** Skip deduplication check */
  skipDeduplication?: boolean;
  /** Dry run - don't persist improvements */
  dryRun?: boolean;
}

/**
 * Result of running detection
 */
export interface DetectionRunResult {
  /** When detection was run */
  timestamp: Date;
  /** Number of executions analyzed */
  executionsAnalyzed: number;
  /** Number of rules evaluated */
  rulesEvaluated: number;
  /** Triggered improvements */
  triggered: TriggeredImprovement[];
  /** New improvements created (empty if dry run) */
  created: ImprovementSuggestion[];
  /** Improvements that were deduplicated (not created) */
  deduplicated: number;
}

/**
 * Rule cooldown tracking
 */
interface CooldownEntry {
  ruleId: string;
  triggeredAt: Date;
  tool?: LifecycleTool;
  project?: string;
}

/**
 * Improvement Detector class
 */
export class ImprovementDetector {
  private logger = getLogger();
  private cooldowns: CooldownEntry[] = [];

  /**
   * Run detection on a single execution
   */
  async detectForExecution(
    execution: ExecutionRecord,
    options?: DetectionOptions
  ): Promise<TriggeredImprovement[]> {
    const rules = this.getRulesToRun(options?.ruleIds);
    const context = await this.buildContext(execution);
    const triggered: TriggeredImprovement[] = [];

    for (const rule of rules) {
      // Check minimum history requirement
      if (rule.minHistoryRequired && context.toolHistory.length < rule.minHistoryRequired) {
        continue;
      }

      // Check cooldown
      if (this.isInCooldown(rule, execution.tool, execution.project)) {
        continue;
      }

      try {
        const result = rule.condition(context);
        const detectionResult = typeof result === 'boolean' ? { triggered: result } : result;

        if (detectionResult.triggered) {
          triggered.push({
            rule,
            execution,
            confidence: detectionResult.confidence ?? 0.8,
            context: detectionResult.context,
            affectedTools: [execution.tool],
            affectedProjects: [execution.project],
          });

          // Record cooldown
          this.recordCooldown(rule, execution.tool, execution.project);
        }
      } catch (error) {
        this.logger.warn({ error, ruleId: rule.id }, 'Rule evaluation failed');
      }
    }

    return triggered;
  }

  /**
   * Run detection on recent executions
   */
  async detectRecent(options?: DetectionOptions): Promise<DetectionRunResult> {
    const since = options?.since ?? hoursAgo(24);
    const executions = getExecutions({
      since,
      tools: options?.tools,
      projects: options?.projects,
    });

    return this.runDetection(executions, options);
  }

  /**
   * Run full detection scan
   */
  async runFullScan(options?: DetectionOptions): Promise<DetectionRunResult> {
    const since = options?.since ?? daysAgo(30);
    const executions = getExecutions({
      since,
      tools: options?.tools,
      projects: options?.projects,
    });

    return this.runDetection(executions, options);
  }

  /**
   * Run detection on a set of executions
   */
  private async runDetection(
    executions: ExecutionRecord[],
    options?: DetectionOptions
  ): Promise<DetectionRunResult> {
    const rules = this.getRulesToRun(options?.ruleIds);
    const allTriggered: TriggeredImprovement[] = [];
    const created: ImprovementSuggestion[] = [];
    let deduplicated = 0;

    this.logger.info(
      { executionCount: executions.length, ruleCount: rules.length },
      'Starting improvement detection'
    );

    // Process each execution
    for (const execution of executions) {
      const triggered = await this.detectForExecution(execution, options);
      allTriggered.push(...triggered);
    }

    // Deduplicate and create improvements
    for (const triggered of allTriggered) {
      const isDuplicate =
        !options?.skipDeduplication && (await this.isDuplicateImprovement(triggered));

      if (isDuplicate) {
        deduplicated++;
        continue;
      }

      if (!options?.dryRun) {
        const improvement = this.createImprovementFromTriggered(triggered);
        const saved = insertImprovement(improvement);
        created.push(saved);
        this.logger.info(
          { improvementId: saved.id, ruleId: triggered.rule.id },
          'Created improvement'
        );
      }
    }

    return {
      timestamp: new Date(),
      executionsAnalyzed: executions.length,
      rulesEvaluated: rules.length,
      triggered: allTriggered,
      created,
      deduplicated,
    };
  }

  /**
   * Get rules to run based on options
   */
  private getRulesToRun(ruleIds?: string[]): DetectionRule[] {
    if (ruleIds && ruleIds.length > 0) {
      return ruleIds
        .map((id) => getRuleById(id))
        .filter((rule): rule is DetectionRule => rule !== undefined);
    }
    return getEnabledRules();
  }

  /**
   * Build context for rule evaluation
   */
  private async buildContext(execution: ExecutionRecord): Promise<RuleContext> {
    const toolHistory = getRecentExecutions(execution.tool, undefined, 50);
    const projectHistory = getRecentExecutions(undefined, execution.project, 50);
    const allHistory = getRecentExecutions(undefined, undefined, 100);

    return {
      execution,
      toolHistory: toolHistory.filter((e) => e.id !== execution.id),
      projectHistory: projectHistory.filter((e) => e.id !== execution.id),
      allHistory: allHistory.filter((e) => e.id !== execution.id),
    };
  }

  /**
   * Check if a rule is in cooldown
   */
  private isInCooldown(
    rule: DetectionRule,
    tool: LifecycleTool,
    project: string
  ): boolean {
    if (!rule.cooldownMs) return false;

    const entry = this.cooldowns.find(
      (c) => c.ruleId === rule.id && c.tool === tool && c.project === project
    );

    if (!entry) return false;

    const elapsed = Date.now() - entry.triggeredAt.getTime();
    return elapsed < rule.cooldownMs;
  }

  /**
   * Record a cooldown entry
   */
  private recordCooldown(
    rule: DetectionRule,
    tool: LifecycleTool,
    project: string
  ): void {
    if (!rule.cooldownMs) return;

    // Remove old entry if exists
    this.cooldowns = this.cooldowns.filter(
      (c) => !(c.ruleId === rule.id && c.tool === tool && c.project === project)
    );

    // Add new entry
    this.cooldowns.push({
      ruleId: rule.id,
      triggeredAt: new Date(),
      tool,
      project,
    });

    // Cleanup old entries
    const now = Date.now();
    this.cooldowns = this.cooldowns.filter(
      (c) => now - c.triggeredAt.getTime() < 86400000 // 24 hours max
    );
  }

  /**
   * Check if an improvement would be a duplicate
   */
  private async isDuplicateImprovement(
    triggered: TriggeredImprovement
  ): Promise<boolean> {
    const recentImprovements = getImprovements({
      statuses: ['open', 'in_progress'],
      tools: triggered.affectedTools,
      since: daysAgo(7),
    });

    // Check if same rule already triggered for same tool/project
    return recentImprovements.some(
      (imp) =>
        imp.detectionContext?.includes(triggered.rule.id) &&
        imp.affectedTools.some((t) => triggered.affectedTools.includes(t)) &&
        imp.affectedProjects.some((p) => triggered.affectedProjects.includes(p))
    );
  }

  /**
   * Create improvement data from triggered result
   */
  private createImprovementFromTriggered(
    triggered: TriggeredImprovement
  ): CreateImprovementData {
    const { rule, execution, confidence, context } = triggered;

    return {
      type: rule.type,
      severity: rule.severity,
      scope: rule.scope,
      title: rule.name,
      description: `${rule.description}\n\n${context ?? ''}`.trim(),
      suggestedAction: rule.suggestedAction,
      affectedTools: triggered.affectedTools,
      affectedProjects: triggered.affectedProjects,
      detectedBy: 'rule',
      detectionContext: `Rule: ${rule.id}\nConfidence: ${(confidence * 100).toFixed(0)}%\nExecution: ${execution.id}`,
      estimatedImpact: rule.estimatedImpact,
      estimatedEffort: rule.estimatedEffort,
      tags: rule.tags,
    };
  }

  /**
   * Clear cooldowns (for testing)
   */
  clearCooldowns(): void {
    this.cooldowns = [];
  }
}

/**
 * Singleton instance
 */
let detectorInstance: ImprovementDetector | null = null;

/**
 * Get the singleton ImprovementDetector instance
 */
export function getImprovementDetector(): ImprovementDetector {
  if (!detectorInstance) {
    detectorInstance = new ImprovementDetector();
  }
  return detectorInstance;
}

/**
 * Create a new ImprovementDetector instance (for testing)
 */
export function createImprovementDetector(): ImprovementDetector {
  return new ImprovementDetector();
}

