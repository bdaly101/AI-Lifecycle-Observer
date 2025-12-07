/**
 * Core module exports
 */

export {
  type DetectionRule,
  type RuleContext,
  type DetectionResult,
  type TriggeredImprovement,
  BUILTIN_RULES,
  getEnabledRules,
  getRuleById,
  getRulesByType,
  // Helper functions
  getAvgDuration,
  getSuccessRate,
  countErrorType,
  isIncreasingTrend,
  isDecreasingTrend,
  containsSecretPattern,
  detectIncompatibilityPattern,
  hasRepeatedApiKeyErrors,
  hasRepeatedRateLimitErrors,
} from './detection-rules.js';

export {
  ImprovementDetector,
  getImprovementDetector,
  createImprovementDetector,
  type DetectionOptions,
  type DetectionRunResult,
} from './improvement-detector.js';

