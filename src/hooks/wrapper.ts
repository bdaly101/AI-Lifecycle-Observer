/**
 * Tool wrapper for automatic execution tracking
 * 
 * This module provides a wrapper function that tools can use to
 * automatically track their executions with the lifecycle observer.
 */

import { getExecutionCollector, type ExecutionHandle, type StartOptions } from '../collectors/index.js';
import { getErrorCollector } from '../collectors/error-collector.js';
import { isDatabaseInitialized, initDatabase } from '../database/index.js';
import { loadConfig, expandPath } from '../config/index.js';
import { getLogger, initLogger } from '../utils/logger.js';
import type {
  LifecycleTool,
  ExecutionRecord,
  ExecutionResult,
  ExecutionContext,
  ErrorCategory,
} from '../types/index.js';

/**
 * Options for wrapping a tool function
 */
export interface WrapOptions {
  /** Metrics to capture from the result */
  captureMetrics?: string[];
  /** Whether to capture additional context */
  captureContext?: boolean;
  /** Project path (auto-detected if not provided) */
  projectPath?: string;
  /** Skip git context extraction */
  skipGitContext?: boolean;
  /** Pre-execution hook */
  preExecution?: (handle: ExecutionHandle) => void | Promise<void>;
  /** Post-execution hook */
  postExecution?: (record: ExecutionRecord) => void | Promise<void>;
  /** Custom error categorizer */
  categorizeError?: (error: unknown) => ErrorCategory;
  /** Enable lifecycle observer (default: true, respects env LIFECYCLE_OBSERVER_ENABLED) */
  enabled?: boolean;
}

/**
 * Result type with optional metrics
 */
export interface WrapResult<T> {
  result: T;
  metrics?: Record<string, number | string>;
}

/**
 * Check if the observer should be enabled
 */
function isObserverEnabled(options?: WrapOptions): boolean {
  // Explicit option takes precedence
  if (options?.enabled !== undefined) {
    return options.enabled;
  }

  // Check environment variable
  const envEnabled = process.env.LIFECYCLE_OBSERVER_ENABLED;
  if (envEnabled !== undefined) {
    return envEnabled.toLowerCase() !== 'false' && envEnabled !== '0';
  }

  // Default to enabled
  return true;
}

/**
 * Ensure the database is initialized
 */
function ensureDatabaseInitialized(): boolean {
  if (isDatabaseInitialized()) {
    return true;
  }

  try {
    const config = loadConfig();
    const dbPath = expandPath(config.database.path);
    initDatabase({ path: dbPath, migrate: true });
    initLogger({ level: config.logLevel });
    return true;
  } catch (error) {
    // If we can't initialize, just log and continue without tracking
    const logger = getLogger();
    logger.debug({ error }, 'Failed to initialize lifecycle observer database');
    return false;
  }
}

/**
 * Wrap a tool function for automatic execution tracking
 * 
 * @example
 * ```typescript
 * import { wrapTool } from 'lifecycle-observer/wrapper';
 * 
 * const wrappedGenerate = wrapTool('ai-test-generator', 'generate', async (options) => {
 *   // Original generate logic
 *   return { testsGenerated: 5 };
 * }, {
 *   captureMetrics: ['testsGenerated']
 * });
 * 
 * // Usage
 * const result = await wrappedGenerate({ staged: true });
 * ```
 */
export function wrapTool<TArgs extends unknown[], TResult>(
  tool: LifecycleTool,
  command: string,
  fn: (...args: TArgs) => Promise<TResult>,
  options?: WrapOptions
): (...args: TArgs) => Promise<TResult> {
  const wrapped = async (...args: TArgs): Promise<TResult> => {
    // Check if observer is enabled
    if (!isObserverEnabled(options)) {
      return fn(...args);
    }

    // Ensure database is ready
    if (!ensureDatabaseInitialized()) {
      // Fall back to running without tracking
      return fn(...args);
    }

    const collector = getExecutionCollector();
    const errorCollector = getErrorCollector();
    const logger = getLogger();

    // Start execution tracking
    const startOptions: StartOptions = {
      projectPath: options?.projectPath ?? process.cwd(),
      skipGitContext: options?.skipGitContext,
    };

    let handle: ExecutionHandle;
    try {
      handle = await collector.startExecution(tool, command, startOptions);
    } catch (error) {
      logger.debug({ error }, 'Failed to start execution tracking');
      return fn(...args);
    }

    // Run pre-execution hook
    if (options?.preExecution) {
      try {
        await options.preExecution(handle);
      } catch (error) {
        logger.debug({ error }, 'Pre-execution hook failed');
      }
    }

    try {
      // Execute the wrapped function
      const result = await fn(...args);

      // Extract metrics from result if configured
      if (options?.captureMetrics && result && typeof result === 'object') {
        for (const metricKey of options.captureMetrics) {
          const value = (result as Record<string, unknown>)[metricKey];
          if (typeof value === 'number' || typeof value === 'string') {
            collector.recordMetric(handle, metricKey, value);
          }
        }
      }

      // Complete execution successfully
      const record = collector.succeedExecution(handle);

      // Run post-execution hook
      if (options?.postExecution) {
        try {
          await options.postExecution(record);
        } catch (error) {
          logger.debug({ error }, 'Post-execution hook failed');
        }
      }

      return result;
    } catch (error) {
      // Categorize the error
      const errorCategory = options?.categorizeError
        ? options.categorizeError(error)
        : errorCollector.categorizeError(error);

      // Record the failure
      const record = collector.failExecution(handle, error, errorCategory);

      // Run post-execution hook
      if (options?.postExecution) {
        try {
          await options.postExecution(record);
        } catch (hookError) {
          logger.debug({ error: hookError }, 'Post-execution hook failed');
        }
      }

      // Re-throw the original error
      throw error;
    }
  };

  return wrapped;
}

/**
 * Wrap a synchronous tool function for execution tracking
 * Note: This still returns a Promise to allow for async tracking
 */
export function wrapToolSync<TArgs extends unknown[], TResult>(
  tool: LifecycleTool,
  command: string,
  fn: (...args: TArgs) => TResult,
  options?: WrapOptions
): (...args: TArgs) => Promise<TResult> {
  const asyncFn = async (...args: TArgs): Promise<TResult> => {
    return fn(...args);
  };

  return wrapTool(tool, command, asyncFn, options);
}

/**
 * Create a tracked execution context manually
 * 
 * @example
 * ```typescript
 * import { createTrackedExecution } from 'lifecycle-observer/wrapper';
 * 
 * const { handle, complete, fail, recordMetric } = await createTrackedExecution(
 *   'ai-test-generator',
 *   'generate'
 * );
 * 
 * try {
 *   // Do work...
 *   recordMetric('testsGenerated', 5);
 *   complete();
 * } catch (error) {
 *   fail(error);
 * }
 * ```
 */
export async function createTrackedExecution(
  tool: LifecycleTool,
  command: string,
  options?: StartOptions
): Promise<{
  handle: ExecutionHandle;
  complete: (context?: Partial<ExecutionContext>, metadata?: Record<string, unknown>) => ExecutionRecord;
  fail: (error: unknown, category?: ErrorCategory) => ExecutionRecord;
  cancel: (reason?: string) => ExecutionRecord;
  recordMetric: (key: string, value: number | string) => void;
  updateContext: (context: Partial<ExecutionContext>) => void;
}> {
  // Ensure database is ready
  ensureDatabaseInitialized();

  const collector = getExecutionCollector();
  const errorCollector = getErrorCollector();

  const handle = await collector.startExecution(tool, command, options);

  return {
    handle,
    complete: (context?, metadata?) => collector.succeedExecution(handle, context, metadata),
    fail: (error, category?) => {
      const errorCategory = category ?? errorCollector.categorizeError(error);
      return collector.failExecution(handle, error, errorCategory);
    },
    cancel: (reason?) => collector.cancelExecution(handle, reason),
    recordMetric: (key, value) => collector.recordMetric(handle, key, value),
    updateContext: (context) => collector.updateContext(handle, context),
  };
}

/**
 * Decorator-style wrapper for class methods
 * 
 * @example
 * ```typescript
 * class TestGenerator {
 *   @tracked('ai-test-generator', 'generate')
 *   async generate(options: GenerateOptions): Promise<GenerateResult> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export function tracked(
  tool: LifecycleTool,
  command: string,
  options?: WrapOptions
) {
  return function <T extends (...args: unknown[]) => Promise<unknown>>(
    _target: object,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ): TypedPropertyDescriptor<T> {
    const originalMethod = descriptor.value;
    if (!originalMethod) {
      return descriptor;
    }

    descriptor.value = wrapTool(tool, command, originalMethod, options) as T;
    return descriptor;
  };
}

/**
 * Create an execution record from a handle and result
 * (Utility for manual tracking scenarios)
 */
export function createExecutionRecord(
  handle: ExecutionHandle,
  result: ExecutionResult
): Omit<ExecutionRecord, 'id'> {
  return {
    timestamp: new Date(handle.startTime),
    tool: handle.tool,
    project: handle.project,
    projectPath: handle.projectPath,
    command: handle.command,
    args: handle.args,
    duration: Date.now() - handle.startTime,
    status: result.status,
    errorType: result.errorType,
    errorMessage: result.errorMessage,
    errorStack: result.errorStack,
    context: {
      ...handle.context,
      ...result.additionalContext,
    },
    metadata: {
      ...handle.metadata,
      ...result.additionalMetadata,
    },
  };
}

// Re-export types for convenience
export type { ExecutionHandle, ExecutionRecord, ExecutionResult, ExecutionContext, ErrorCategory };
