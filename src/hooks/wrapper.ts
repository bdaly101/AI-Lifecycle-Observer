/**
 * Tool wrapper for automatic execution tracking
 * 
 * This module provides a wrapper function that tools can use to
 * automatically track their executions with the lifecycle observer.
 */

import type {
  LifecycleTool,
  ExecutionRecord,
  ExecutionResult,
  ExecutionContext,
} from '../types/index.js';

/**
 * Options for wrapping a tool function
 */
export interface WrapOptions {
  /** Metrics to capture from the result */
  captureMetrics?: string[];
  /** Whether to capture stdout/stderr */
  captureOutput?: boolean;
  /** Custom context extractor */
  getContext?: () => Partial<ExecutionContext>;
}

/**
 * Execution handle returned when starting an execution
 */
export interface ExecutionHandle {
  id: string;
  tool: LifecycleTool;
  command: string;
  startTime: number;
  context: ExecutionContext;
  metadata: Record<string, unknown>;
}

// Note: Full implementation will be added in Phase 2 (Execution Tracking)
// This is a placeholder that allows the module to be imported

/**
 * Wrap a tool function for automatic execution tracking
 * 
 * @example
 * ```typescript
 * import { wrapTool } from 'lifecycle-observer/wrapper';
 * 
 * const wrappedGenerate = wrapTool('ai-test-generator', 'generate', async (options) => {
 *   // Original generate logic
 * });
 * ```
 */
export function wrapTool<T extends (...args: unknown[]) => Promise<unknown>>(
  tool: LifecycleTool,
  command: string,
  fn: T,
  _options?: WrapOptions
): T {
  // Placeholder implementation - returns the original function
  // Full tracking will be implemented in Phase 2
  const wrapped = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const startTime = Date.now();
    
    try {
      const result = await fn(...args);
      const duration = Date.now() - startTime;
      
      // Log execution (placeholder - will be replaced with actual tracking)
      if (process.env.LIFECYCLE_OBSERVER_DEBUG) {
        console.log(`[lifecycle-observer] ${tool}:${command} completed in ${duration}ms`);
      }
      
      return result as ReturnType<T>;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      if (process.env.LIFECYCLE_OBSERVER_DEBUG) {
        console.log(`[lifecycle-observer] ${tool}:${command} failed after ${duration}ms`);
      }
      
      throw error;
    }
  };

  return wrapped as T;
}

/**
 * Create an execution record from a handle and result
 */
export function createExecutionRecord(
  handle: ExecutionHandle,
  result: ExecutionResult
): Omit<ExecutionRecord, 'id'> {
  return {
    timestamp: new Date(handle.startTime),
    tool: handle.tool,
    project: '', // Will be determined from context
    projectPath: '', // Will be determined from context
    command: handle.command,
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

