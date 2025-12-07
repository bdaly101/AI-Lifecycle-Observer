/**
 * AI-SQL-Dev Integration
 * 
 * Pre-configured integration for the AI-SQL-Dev tool.
 * Wraps SQL/RLS generation operations with automatic execution tracking.
 */

import { wrapTool, type WrapOptions } from '../hooks/wrapper.js';
import type { LifecycleTool } from '../types/index.js';

const TOOL_NAME: LifecycleTool = 'ai-sql-dev';

/**
 * Metrics captured from SQL/RLS generation
 */
export interface SQLDevGenerateMetrics {
  /** Number of RLS policies generated */
  policiesGenerated?: number;
  /** Number of tables analyzed */
  tablesAnalyzed?: number;
  /** Number of migrations created */
  migrationsCreated?: number;
  /** Number of tokens used by AI */
  tokensUsed?: number;
  /** Number of security rules added */
  securityRulesAdded?: number;
  /** Lines of SQL generated */
  sqlLinesGenerated?: number;
  /** Number of functions created */
  functionsCreated?: number;
}

/**
 * Result from a SQL/RLS generation operation
 */
export interface SQLDevGenerateResult extends SQLDevGenerateMetrics {
  /** Whether the generation was successful */
  success: boolean;
  /** Target schema or table */
  targetSchema?: string;
  /** Database type (e.g., 'supabase', 'postgres') */
  databaseType?: string;
  /** Generation summary */
  summary?: string;
  /** Any additional data */
  [key: string]: unknown;
}

/**
 * Options for AI-SQL-Dev integration
 */
export interface SQLDevIntegrationOptions extends Omit<WrapOptions, 'captureMetrics'> {
  /** Which metrics to capture (default: all) */
  metrics?: (keyof SQLDevGenerateMetrics)[];
}

/**
 * Default metrics to capture
 */
const DEFAULT_METRICS: (keyof SQLDevGenerateMetrics)[] = [
  'policiesGenerated',
  'tablesAnalyzed',
  'migrationsCreated',
  'tokensUsed',
  'securityRulesAdded',
];

/**
 * Create a wrapped SQL dev function
 * 
 * @example
 * ```typescript
 * import { createSQLDevIntegration } from 'lifecycle-observer';
 * 
 * // In your AI-SQL-Dev generate command
 * const wrappedGenerate = createSQLDevIntegration(
 *   'generate',
 *   async (options) => {
 *     // Your existing generation logic
 *     const result = await generateRLS(options);
 *     return {
 *       success: true,
 *       policiesGenerated: result.policies.length,
 *       tablesAnalyzed: result.tables.length,
 *       migrationsCreated: result.migrations.length,
 *       tokensUsed: result.tokensUsed,
 *       targetSchema: options.schema,
 *     };
 *   }
 * );
 * 
 * export const generate = wrappedGenerate;
 * ```
 */
export function createSQLDevIntegration<TArgs extends unknown[]>(
  command: string,
  fn: (...args: TArgs) => Promise<SQLDevGenerateResult>,
  options?: SQLDevIntegrationOptions
): (...args: TArgs) => Promise<SQLDevGenerateResult> {
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
 * Pre-configured wrapper for common SQL dev operations
 */
export const sqlDevOperations = {
  /**
   * Wrap a generate function (RLS policies)
   */
  generate: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<SQLDevGenerateResult>,
    options?: SQLDevIntegrationOptions
  ) => createSQLDevIntegration('generate', fn, options),

  /**
   * Wrap an analyze function
   */
  analyze: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<SQLDevGenerateResult>,
    options?: SQLDevIntegrationOptions
  ) => createSQLDevIntegration('analyze', fn, options),

  /**
   * Wrap a migrate function
   */
  migrate: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<SQLDevGenerateResult>,
    options?: SQLDevIntegrationOptions
  ) => createSQLDevIntegration('migrate', fn, options),

  /**
   * Wrap a validate function
   */
  validate: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<SQLDevGenerateResult>,
    options?: SQLDevIntegrationOptions
  ) => createSQLDevIntegration('validate', fn, options),
};

