/**
 * AI-Test-Generator Integration
 * 
 * Pre-configured integration for the AI-Test-Generator tool.
 * Wraps test generation operations with automatic execution tracking.
 */

import { wrapTool, type WrapOptions } from '../hooks/wrapper.js';
import type { LifecycleTool } from '../types/index.js';

const TOOL_NAME: LifecycleTool = 'ai-test-generator';

/**
 * Metrics captured from test generation
 */
export interface TestGenerateMetrics {
  /** Number of tests generated */
  testsGenerated?: number;
  /** Coverage increase percentage */
  coverageIncrease?: number;
  /** Number of test files created */
  testFilesCreated?: number;
  /** Number of TODOs added */
  todosAdded?: number;
  /** Number of tokens used by AI */
  tokensUsed?: number;
  /** Lines of test code added */
  testLinesAdded?: number;
  /** Number of mocks created */
  mocksCreated?: number;
}

/**
 * Result from a test generation operation
 */
export interface TestGenerateResult extends TestGenerateMetrics {
  /** Whether the generation was successful */
  success: boolean;
  /** Target file or directory */
  targetPath?: string;
  /** Test framework used */
  testFramework?: string;
  /** Generation summary */
  summary?: string;
  /** Any additional data */
  [key: string]: unknown;
}

/**
 * Options for AI-Test-Generator integration
 */
export interface TestGeneratorIntegrationOptions extends Omit<WrapOptions, 'captureMetrics'> {
  /** Which metrics to capture (default: all) */
  metrics?: (keyof TestGenerateMetrics)[];
}

/**
 * Default metrics to capture
 */
const DEFAULT_METRICS: (keyof TestGenerateMetrics)[] = [
  'testsGenerated',
  'coverageIncrease',
  'testFilesCreated',
  'todosAdded',
  'tokensUsed',
];

/**
 * Create a wrapped test generator function
 * 
 * @example
 * ```typescript
 * import { createTestGeneratorIntegration } from 'lifecycle-observer';
 * 
 * // In your AI-Test-Generator generate command
 * const wrappedGenerate = createTestGeneratorIntegration(
 *   'generate',
 *   async (options) => {
 *     // Your existing generation logic
 *     const result = await generateTests(options);
 *     return {
 *       success: true,
 *       testsGenerated: result.tests.length,
 *       testFilesCreated: result.newFiles.length,
 *       coverageIncrease: result.coverageDelta,
 *       todosAdded: result.todos.length,
 *       targetPath: options.target,
 *     };
 *   }
 * );
 * 
 * export const generate = wrappedGenerate;
 * ```
 */
export function createTestGeneratorIntegration<TArgs extends unknown[]>(
  command: string,
  fn: (...args: TArgs) => Promise<TestGenerateResult>,
  options?: TestGeneratorIntegrationOptions
): (...args: TArgs) => Promise<TestGenerateResult> {
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
 * Pre-configured wrapper for common test generator operations
 */
export const testGeneratorOperations = {
  /**
   * Wrap a generate function
   */
  generate: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<TestGenerateResult>,
    options?: TestGeneratorIntegrationOptions
  ) => createTestGeneratorIntegration('generate', fn, options),

  /**
   * Wrap a coverage function
   */
  coverage: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<TestGenerateResult>,
    options?: TestGeneratorIntegrationOptions
  ) => createTestGeneratorIntegration('coverage', fn, options),

  /**
   * Wrap a fix function (fixing failing tests)
   */
  fix: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<TestGenerateResult>,
    options?: TestGeneratorIntegrationOptions
  ) => createTestGeneratorIntegration('fix', fn, options),
};

