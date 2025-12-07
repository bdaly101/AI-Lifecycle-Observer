/**
 * AI-PR-Dev Integration
 * 
 * Pre-configured integration for the AI-PR-Dev tool.
 * Wraps PR review operations with automatic execution tracking.
 */

import { wrapTool, type WrapOptions } from '../hooks/wrapper.js';
import type { LifecycleTool } from '../types/index.js';

const TOOL_NAME: LifecycleTool = 'ai-pr-dev';

/**
 * Metrics captured from PR reviews
 */
export interface PRReviewMetrics {
  /** Number of files reviewed */
  filesReviewed?: number;
  /** Number of comments added */
  commentsAdded?: number;
  /** Number of tokens used by AI */
  tokensUsed?: number;
  /** Number of issues found */
  issuesFound?: number;
  /** Number of suggestions made */
  suggestionsMade?: number;
  /** Lines of code reviewed */
  linesReviewed?: number;
}

/**
 * Result from a PR review operation
 */
export interface PRReviewResult extends PRReviewMetrics {
  /** Whether the review was successful */
  success: boolean;
  /** PR number */
  prNumber?: number;
  /** Repository name */
  repository?: string;
  /** Review summary */
  summary?: string;
  /** Any additional data */
  [key: string]: unknown;
}

/**
 * Options for AI-PR-Dev integration
 */
export interface PRDevIntegrationOptions extends Omit<WrapOptions, 'captureMetrics'> {
  /** Which metrics to capture (default: all) */
  metrics?: (keyof PRReviewMetrics)[];
}

/**
 * Default metrics to capture
 */
const DEFAULT_METRICS: (keyof PRReviewMetrics)[] = [
  'filesReviewed',
  'commentsAdded',
  'tokensUsed',
  'issuesFound',
  'suggestionsMade',
];

/**
 * Create a wrapped PR review function
 * 
 * @example
 * ```typescript
 * import { createPRDevIntegration } from 'lifecycle-observer';
 * 
 * // In your AI-PR-Dev webhook handler
 * const wrappedReview = createPRDevIntegration(
 *   'review',
 *   async (event) => {
 *     // Your existing review logic
 *     const review = await performReview(event.pull_request);
 *     return {
 *       success: true,
 *       filesReviewed: review.files.length,
 *       commentsAdded: review.comments.length,
 *       tokensUsed: review.tokensUsed,
 *       prNumber: event.pull_request.number,
 *     };
 *   }
 * );
 * 
 * webhooks.on('pull_request.opened', wrappedReview);
 * ```
 */
export function createPRDevIntegration<TArgs extends unknown[]>(
  command: string,
  fn: (...args: TArgs) => Promise<PRReviewResult>,
  options?: PRDevIntegrationOptions
): (...args: TArgs) => Promise<PRReviewResult> {
  const metrics = options?.metrics ?? DEFAULT_METRICS;
  
  return wrapTool(
    TOOL_NAME,
    command,
    fn,
    {
      ...options,
      captureMetrics: metrics as string[],
    }
  );
}

/**
 * Pre-configured wrapper for common PR operations
 */
export const prDevOperations = {
  /**
   * Wrap a PR review function
   */
  review: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<PRReviewResult>,
    options?: PRDevIntegrationOptions
  ) => createPRDevIntegration('review', fn, options),

  /**
   * Wrap a PR check function
   */
  check: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<PRReviewResult>,
    options?: PRDevIntegrationOptions
  ) => createPRDevIntegration('check', fn, options),

  /**
   * Wrap a PR fix function
   */
  fix: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<PRReviewResult>,
    options?: PRDevIntegrationOptions
  ) => createPRDevIntegration('fix', fn, options),
};

