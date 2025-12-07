/**
 * AI-Feature-Builder Integration
 * 
 * Pre-configured integration for the AI-Feature-Builder tool.
 * Wraps feature implementation operations with automatic execution tracking.
 */

import { wrapTool, type WrapOptions } from '../hooks/wrapper.js';
import type { LifecycleTool } from '../types/index.js';

const TOOL_NAME: LifecycleTool = 'ai-feature-builder';

/**
 * Metrics captured from feature implementations
 */
export interface FeatureImplementMetrics {
  /** Number of files created */
  filesCreated?: number;
  /** Number of files modified */
  filesModified?: number;
  /** Number of tests generated */
  testsGenerated?: number;
  /** Lines of code added */
  linesAdded?: number;
  /** Lines of code removed */
  linesRemoved?: number;
  /** Number of tokens used by AI */
  tokensUsed?: number;
  /** Number of components created */
  componentsCreated?: number;
}

/**
 * Result from a feature implementation
 */
export interface FeatureImplementResult extends FeatureImplementMetrics {
  /** Whether the implementation was successful */
  success: boolean;
  /** Feature name or ID */
  featureName?: string;
  /** Branch name */
  branchName?: string;
  /** Implementation summary */
  summary?: string;
  /** Any additional data */
  [key: string]: unknown;
}

/**
 * Options for AI-Feature-Builder integration
 */
export interface FeatureBuilderIntegrationOptions extends Omit<WrapOptions, 'captureMetrics'> {
  /** Which metrics to capture (default: all) */
  metrics?: (keyof FeatureImplementMetrics)[];
}

/**
 * Default metrics to capture
 */
const DEFAULT_METRICS: (keyof FeatureImplementMetrics)[] = [
  'filesCreated',
  'filesModified',
  'testsGenerated',
  'linesAdded',
  'tokensUsed',
];

/**
 * Create a wrapped feature builder function
 * 
 * @example
 * ```typescript
 * import { createFeatureBuilderIntegration } from 'lifecycle-observer';
 * 
 * // In your AI-Feature-Builder implement command
 * const wrappedImplement = createFeatureBuilderIntegration(
 *   'implement',
 *   async (options) => {
 *     // Your existing implementation logic
 *     const result = await implementFeature(options);
 *     return {
 *       success: true,
 *       filesCreated: result.newFiles.length,
 *       filesModified: result.modifiedFiles.length,
 *       testsGenerated: result.tests.length,
 *       linesAdded: result.stats.linesAdded,
 *       featureName: options.feature,
 *     };
 *   }
 * );
 * 
 * export const implement = wrappedImplement;
 * ```
 */
export function createFeatureBuilderIntegration<TArgs extends unknown[]>(
  command: string,
  fn: (...args: TArgs) => Promise<FeatureImplementResult>,
  options?: FeatureBuilderIntegrationOptions
): (...args: TArgs) => Promise<FeatureImplementResult> {
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
 * Pre-configured wrapper for common feature builder operations
 */
export const featureBuilderOperations = {
  /**
   * Wrap an implement function
   */
  implement: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<FeatureImplementResult>,
    options?: FeatureBuilderIntegrationOptions
  ) => createFeatureBuilderIntegration('implement', fn, options),

  /**
   * Wrap a refactor function
   */
  refactor: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<FeatureImplementResult>,
    options?: FeatureBuilderIntegrationOptions
  ) => createFeatureBuilderIntegration('refactor', fn, options),

  /**
   * Wrap a migrate function
   */
  migrate: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<FeatureImplementResult>,
    options?: FeatureBuilderIntegrationOptions
  ) => createFeatureBuilderIntegration('migrate', fn, options),
};

