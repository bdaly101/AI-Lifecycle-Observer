/**
 * Detection Rules Engine - Rule-based improvement detection
 */

import type {
  ExecutionRecord,
  ImprovementType,
  ImprovementSeverity,
  ImprovementScope,
  LifecycleTool,
  EstimationLevel,
} from '../types/index.js';

/**
 * Context available for rule evaluation
 */
export interface RuleContext {
  /** The current execution being evaluated */
  execution: ExecutionRecord;
  /** Recent execution history for the same tool */
  toolHistory: ExecutionRecord[];
  /** Recent execution history for the same project */
  projectHistory: ExecutionRecord[];
  /** All recent executions across tools/projects */
  allHistory: ExecutionRecord[];
}

/**
 * Result of a detection rule evaluation
 */
export interface DetectionResult {
  /** Whether the rule triggered */
  triggered: boolean;
  /** Confidence level 0-1 */
  confidence?: number;
  /** Additional context for the detection */
  context?: string;
}

/**
 * A detection rule definition
 */
export interface DetectionRule {
  /** Unique rule identifier (e.g., PERF-001-SLOW-EXECUTION) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description: string;
  /** Type of improvement this rule detects */
  type: ImprovementType;
  /** Default severity when triggered */
  severity: ImprovementSeverity;
  /** Default scope */
  scope: ImprovementScope;
  /** Suggested action when triggered */
  suggestedAction: string;
  /** Condition function that evaluates the rule */
  condition: (ctx: RuleContext) => DetectionResult | boolean;
  /** Whether this rule is enabled by default */
  enabled: boolean;
  /** Estimated impact if addressed */
  estimatedImpact: EstimationLevel;
  /** Estimated effort to address */
  estimatedEffort: EstimationLevel;
  /** Tags for categorization */
  tags: string[];
  /** Minimum history entries required to evaluate */
  minHistoryRequired?: number;
  /** Cooldown period in ms before this rule can trigger again */
  cooldownMs?: number;
}

/**
 * Triggered improvement from a rule
 */
export interface TriggeredImprovement {
  /** The rule that triggered */
  rule: DetectionRule;
  /** The execution that triggered it */
  execution: ExecutionRecord;
  /** Confidence level */
  confidence: number;
  /** Detection context */
  context?: string;
  /** Tools affected */
  affectedTools: LifecycleTool[];
  /** Projects affected */
  affectedProjects: string[];
}

// ============================================================================
// Helper Functions for Rule Conditions
// ============================================================================

/**
 * Calculate average duration from executions
 */
export function getAvgDuration(executions: ExecutionRecord[]): number {
  if (executions.length === 0) return 0;
  const total = executions.reduce((sum, e) => sum + e.duration, 0);
  return total / executions.length;
}

/**
 * Calculate success rate from executions
 */
export function getSuccessRate(executions: ExecutionRecord[]): number {
  if (executions.length === 0) return 1;
  const successCount = executions.filter((e) => e.status === 'success').length;
  return successCount / executions.length;
}

/**
 * Count occurrences of a specific error type
 */
export function countErrorType(
  executions: ExecutionRecord[],
  errorType: string | undefined
): number {
  if (!errorType) return 0;
  return executions.filter((e) => e.errorType === errorType).length;
}

/**
 * Check if there's an increasing trend in values
 */
export function isIncreasingTrend(values: number[], threshold = 0.1): boolean {
  if (values.length < 3) return false;

  // Simple linear regression
  const n = values.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i]!;
    sumXY += i * values[i]!;
    sumX2 += i * i;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const avgY = sumY / n;

  // Return true if slope represents >threshold% increase per step
  return slope > avgY * threshold;
}

/**
 * Check if there's a decreasing trend in values
 */
export function isDecreasingTrend(values: number[], threshold = 0.1): boolean {
  if (values.length < 3) return false;
  return isIncreasingTrend(
    values.map((v) => -v),
    threshold
  );
}

/**
 * Check if a string contains secret-like patterns
 */
export function containsSecretPattern(text: unknown): boolean {
  if (typeof text !== 'string') return false;

  const secretPatterns = [
    // API keys
    /sk-[a-zA-Z0-9]{20,}/,
    /api[_-]?key[_-]?[:=]["']?[a-zA-Z0-9]{20,}/i,
    /bearer\s+[a-zA-Z0-9._-]{20,}/i,
    // AWS
    /AKIA[0-9A-Z]{16}/,
    /[a-zA-Z0-9/+]{40}/, // AWS secret access key
    // Private keys
    /-----BEGIN (?:RSA )?PRIVATE KEY-----/,
    // Passwords in common formats
    /password[_-]?[:=]["'][^"']{8,}/i,
    /passwd[_-]?[:=]["'][^"']{8,}/i,
    // Database URLs with credentials
    /(?:postgres|mysql|mongodb):\/\/[^:]+:[^@]+@/i,
    // GitHub tokens
    /ghp_[a-zA-Z0-9]{36}/,
    /gho_[a-zA-Z0-9]{36}/,
    /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/,
  ];

  return secretPatterns.some((pattern) => pattern.test(text));
}

/**
 * Detect potential tool incompatibility patterns
 */
export function detectIncompatibilityPattern(
  execution: ExecutionRecord,
  history: ExecutionRecord[]
): boolean {
  // Check if this tool frequently fails after another tool succeeds
  if (execution.status !== 'failure') return false;

  const recentSuccesses = history
    .filter(
      (e) =>
        e.status === 'success' &&
        e.tool !== execution.tool &&
        e.project === execution.project
    )
    .slice(0, 5);

  if (recentSuccesses.length === 0) return false;

  // Check if the same pattern (other tool success → this tool failure) appears multiple times
  const similarFailures = history.filter(
    (e) =>
      e.tool === execution.tool &&
      e.status === 'failure' &&
      e.project === execution.project
  );

  return similarFailures.length >= 2;
}

/**
 * Check for repeated API key errors
 */
export function hasRepeatedApiKeyErrors(
  executions: ExecutionRecord[],
  threshold = 2
): boolean {
  const apiKeyErrors = executions.filter((e) => e.errorType === 'api_key_missing');
  return apiKeyErrors.length >= threshold;
}

/**
 * Check for repeated rate limit errors
 */
export function hasRepeatedRateLimitErrors(
  executions: ExecutionRecord[],
  threshold = 3
): boolean {
  const rateLimitErrors = executions.filter((e) => e.errorType === 'api_rate_limit');
  return rateLimitErrors.length >= threshold;
}

// ============================================================================
// Built-in Detection Rules
// ============================================================================

export const BUILTIN_RULES: DetectionRule[] = [
  // -------------------------------------------------------------------------
  // Performance Rules
  // -------------------------------------------------------------------------
  {
    id: 'PERF-001-SLOW-EXECUTION',
    name: 'Slow Execution Detection',
    description:
      'Detects when an execution takes significantly longer than the average for this tool',
    type: 'performance',
    severity: 'medium',
    scope: 'tool',
    suggestedAction: 'Consider optimizing or caching frequently used operations',
    condition: (ctx) => {
      const avgDuration = getAvgDuration(ctx.toolHistory);
      if (avgDuration === 0) return false;
      const ratio = ctx.execution.duration / avgDuration;
      return {
        triggered: ratio > 2,
        confidence: Math.min(ratio / 3, 1),
        context: `Execution took ${ctx.execution.duration}ms vs average ${avgDuration.toFixed(0)}ms (${ratio.toFixed(1)}x slower)`,
      };
    },
    enabled: true,
    estimatedImpact: 'medium',
    estimatedEffort: 'medium',
    tags: ['performance', 'duration', 'optimization'],
    minHistoryRequired: 5,
  },

  {
    id: 'PERF-002-INCREASING-DURATION',
    name: 'Duration Trend Detection',
    description: 'Detects when execution times are trending upward over time',
    type: 'performance',
    severity: 'medium',
    scope: 'tool',
    suggestedAction:
      'Investigate what might be causing execution times to increase (data growth, code changes, etc.)',
    condition: (ctx) => {
      const durations = ctx.toolHistory.slice(-10).map((e) => e.duration);
      return {
        triggered: isIncreasingTrend(durations),
        confidence: 0.7,
        context: `Duration trend increasing over last ${durations.length} executions`,
      };
    },
    enabled: true,
    estimatedImpact: 'medium',
    estimatedEffort: 'high',
    tags: ['performance', 'trend', 'degradation'],
    minHistoryRequired: 5,
  },

  // -------------------------------------------------------------------------
  // Reliability Rules
  // -------------------------------------------------------------------------
  {
    id: 'REL-001-REPEATED-ERROR',
    name: 'Repeated Error Detection',
    description: 'Detects when the same error type occurs multiple times',
    type: 'reliability',
    severity: 'high',
    scope: 'tool',
    suggestedAction: 'Investigate and fix the recurring error pattern',
    condition: (ctx) => {
      if (ctx.execution.status !== 'failure' || !ctx.execution.errorType) return false;
      const errorCount = countErrorType(ctx.toolHistory, ctx.execution.errorType);
      return {
        triggered: errorCount >= 3,
        confidence: Math.min(errorCount / 5, 1),
        context: `Error type "${ctx.execution.errorType}" has occurred ${errorCount} times`,
      };
    },
    enabled: true,
    estimatedImpact: 'high',
    estimatedEffort: 'medium',
    tags: ['reliability', 'error', 'recurring'],
    minHistoryRequired: 3,
  },

  {
    id: 'REL-002-FLAKY-TOOL',
    name: 'Flaky Tool Detection',
    description: 'Detects when a tool has an inconsistent success rate',
    type: 'reliability',
    severity: 'high',
    scope: 'tool',
    suggestedAction:
      'Investigate why the tool fails intermittently - may need better error handling or retry logic',
    condition: (ctx) => {
      if (ctx.toolHistory.length < 10) return false;
      const successRate = getSuccessRate(ctx.toolHistory);
      return {
        triggered: successRate < 0.9 && successRate > 0.5,
        confidence: 1 - successRate,
        context: `Success rate is ${(successRate * 100).toFixed(1)}% (${ctx.toolHistory.filter((e) => e.status === 'failure').length} failures)`,
      };
    },
    enabled: true,
    estimatedImpact: 'high',
    estimatedEffort: 'high',
    tags: ['reliability', 'flaky', 'inconsistent'],
    minHistoryRequired: 10,
  },

  {
    id: 'REL-003-CONSECUTIVE-FAILURES',
    name: 'Consecutive Failures Detection',
    description: 'Detects when a tool fails multiple times in a row',
    type: 'reliability',
    severity: 'urgent',
    scope: 'tool',
    suggestedAction: 'Tool appears to be broken - immediate investigation required',
    condition: (ctx) => {
      const recent = ctx.toolHistory.slice(0, 3);
      const consecutiveFailures = recent.every((e) => e.status === 'failure');
      return {
        triggered: consecutiveFailures && recent.length >= 3,
        confidence: 0.95,
        context: `Last ${recent.length} executions all failed`,
      };
    },
    enabled: true,
    estimatedImpact: 'high',
    estimatedEffort: 'medium',
    tags: ['reliability', 'critical', 'broken'],
    minHistoryRequired: 3,
    cooldownMs: 3600000, // 1 hour
  },

  // -------------------------------------------------------------------------
  // Usability Rules
  // -------------------------------------------------------------------------
  {
    id: 'USE-001-API-KEY-FRICTION',
    name: 'API Key Friction Detection',
    description: 'Detects repeated API key configuration errors',
    type: 'usability',
    severity: 'high',
    scope: 'lifecycle',
    suggestedAction:
      'Centralize API key management - consider a shared config file or environment setup script',
    condition: (ctx) => {
      const apiKeyErrors = ctx.allHistory.filter(
        (e) => e.errorType === 'api_key_missing'
      );
      return {
        triggered: apiKeyErrors.length >= 2,
        confidence: Math.min(apiKeyErrors.length / 4, 1),
        context: `${apiKeyErrors.length} API key errors across ${new Set(apiKeyErrors.map((e) => e.tool)).size} tools`,
      };
    },
    enabled: true,
    estimatedImpact: 'high',
    estimatedEffort: 'low',
    tags: ['usability', 'config', 'api-key'],
    minHistoryRequired: 1,
  },

  {
    id: 'USE-002-CONFIG-MISSING',
    name: 'Missing Config Detection',
    description: 'Detects configuration-related errors',
    type: 'usability',
    severity: 'medium',
    scope: 'tool',
    suggestedAction:
      'Add default configuration or improve init command to set up required config',
    condition: (ctx) => {
      if (ctx.execution.errorType !== 'config_invalid') return false;
      return {
        triggered: true,
        confidence: 0.9,
        context: ctx.execution.errorMessage ?? 'Config error detected',
      };
    },
    enabled: true,
    estimatedImpact: 'medium',
    estimatedEffort: 'low',
    tags: ['usability', 'config', 'setup'],
  },

  {
    id: 'USE-003-RATE-LIMIT-FRICTION',
    name: 'Rate Limit Friction Detection',
    description: 'Detects repeated rate limit errors indicating need for better handling',
    type: 'usability',
    severity: 'medium',
    scope: 'tool',
    suggestedAction:
      'Implement retry logic with exponential backoff and request queuing',
    condition: (ctx) => {
      return {
        triggered: hasRepeatedRateLimitErrors(ctx.toolHistory),
        confidence: 0.85,
        context: 'Multiple rate limit errors suggest need for retry logic',
      };
    },
    enabled: true,
    estimatedImpact: 'medium',
    estimatedEffort: 'medium',
    tags: ['usability', 'rate-limit', 'retry'],
    minHistoryRequired: 3,
  },

  // -------------------------------------------------------------------------
  // Security Rules
  // -------------------------------------------------------------------------
  {
    id: 'SEC-001-SECRET-IN-OUTPUT',
    name: 'Secret Detection',
    description: 'Detects potential secret/credential exposure in output',
    type: 'security',
    severity: 'urgent',
    scope: 'both',
    suggestedAction:
      'Immediately investigate and rotate any exposed credentials. Add output filtering.',
    condition: (ctx) => {
      const output = ctx.execution.metadata?.output;
      const hasSecret = containsSecretPattern(output);
      return {
        triggered: hasSecret,
        confidence: 0.9,
        context: 'Potential secret pattern detected in execution output',
      };
    },
    enabled: true,
    estimatedImpact: 'high',
    estimatedEffort: 'medium',
    tags: ['security', 'secret', 'critical'],
    cooldownMs: 0, // Always alert
  },

  {
    id: 'SEC-002-PERMISSION-ERRORS',
    name: 'Permission Error Pattern',
    description: 'Detects repeated permission errors that might indicate privilege issues',
    type: 'security',
    severity: 'medium',
    scope: 'tool',
    suggestedAction:
      'Review file/directory permissions and ensure tool runs with appropriate privileges',
    condition: (ctx) => {
      const permErrors = ctx.toolHistory.filter(
        (e) => e.errorType === 'permission_denied'
      );
      return {
        triggered: permErrors.length >= 2,
        confidence: 0.75,
        context: `${permErrors.length} permission errors detected`,
      };
    },
    enabled: true,
    estimatedImpact: 'medium',
    estimatedEffort: 'low',
    tags: ['security', 'permissions'],
    minHistoryRequired: 2,
  },

  // -------------------------------------------------------------------------
  // Integration Rules
  // -------------------------------------------------------------------------
  {
    id: 'INT-001-TOOL-INCOMPATIBILITY',
    name: 'Tool Incompatibility Detection',
    description: 'Detects potential incompatibility between tools in the workflow',
    type: 'integration',
    severity: 'high',
    scope: 'lifecycle',
    suggestedAction:
      'Review tool interactions and add compatibility checks or handoff logic',
    condition: (ctx) => {
      return {
        triggered: detectIncompatibilityPattern(ctx.execution, ctx.allHistory),
        confidence: 0.7,
        context: 'Potential tool incompatibility detected in workflow',
      };
    },
    enabled: true,
    estimatedImpact: 'high',
    estimatedEffort: 'high',
    tags: ['integration', 'compatibility', 'workflow'],
    minHistoryRequired: 5,
  },

  {
    id: 'INT-002-GIT-ERRORS',
    name: 'Git Operation Failures',
    description: 'Detects repeated git-related errors',
    type: 'integration',
    severity: 'medium',
    scope: 'tool',
    suggestedAction:
      'Add git state validation before operations, improve error handling for common git issues',
    condition: (ctx) => {
      const gitErrors = ctx.toolHistory.filter((e) => e.errorType === 'git_error');
      return {
        triggered: gitErrors.length >= 2,
        confidence: 0.8,
        context: `${gitErrors.length} git-related errors detected`,
      };
    },
    enabled: true,
    estimatedImpact: 'medium',
    estimatedEffort: 'medium',
    tags: ['integration', 'git', 'vcs'],
    minHistoryRequired: 2,
  },
];

/**
 * Get all enabled rules
 */
export function getEnabledRules(): DetectionRule[] {
  return BUILTIN_RULES.filter((rule) => rule.enabled);
}

/**
 * Get a rule by ID
 */
export function getRuleById(id: string): DetectionRule | undefined {
  return BUILTIN_RULES.find((rule) => rule.id === id);
}

/**
 * Get rules by type
 */
export function getRulesByType(type: ImprovementType): DetectionRule[] {
  return BUILTIN_RULES.filter((rule) => rule.type === type);
}

