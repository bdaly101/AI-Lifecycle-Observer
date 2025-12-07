/**
 * AI module exports
 */

export {
  ClaudeClient,
  getClaudeClient,
  createClaudeClient,
  type AIRequestOptions,
  type AIResponse,
  type RetryConfig,
} from './claude-client.js';

export {
  ANALYSIS_SYSTEM_PROMPT,
  ANALYSIS_USER_PROMPT,
  buildAnalysisPrompt,
  generateExecutionSummary,
  formatExecutionForAI,
  generateErrorSummary,
  generateToolStats,
  formatOpenImprovements,
} from './analysis-prompts.js';

export {
  AIPatternDetector,
  getAIPatternDetector,
  createAIPatternDetector,
  type AIAnalysisOptions,
  type AIAnalysisResult,
} from './pattern-detector.js';

