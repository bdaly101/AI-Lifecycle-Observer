/**
 * AI-Docs-Generator Integration
 * 
 * Pre-configured integration for the AI-Docs-Generator tool.
 * Wraps documentation generation operations with automatic execution tracking.
 */

import { wrapTool, type WrapOptions } from '../hooks/wrapper.js';
import type { LifecycleTool } from '../types/index.js';

const TOOL_NAME: LifecycleTool = 'ai-docs-generator';

/**
 * Metrics captured from documentation generation
 */
export interface DocsGenerateMetrics {
  /** Number of documentation files updated */
  docsUpdated?: number;
  /** Number of JSDoc comments added */
  jsdocsAdded?: number;
  /** Number of documentation sections generated */
  sectionsGenerated?: number;
  /** Number of tokens used by AI */
  tokensUsed?: number;
  /** Number of README files updated */
  readmesUpdated?: number;
  /** Number of API docs generated */
  apiDocsGenerated?: number;
  /** Lines of documentation added */
  docsLinesAdded?: number;
}

/**
 * Result from a documentation generation operation
 */
export interface DocsGenerateResult extends DocsGenerateMetrics {
  /** Whether the generation was successful */
  success: boolean;
  /** Target file or directory */
  targetPath?: string;
  /** Documentation format */
  format?: string;
  /** Generation summary */
  summary?: string;
  /** Any additional data */
  [key: string]: unknown;
}

/**
 * Options for AI-Docs-Generator integration
 */
export interface DocsGeneratorIntegrationOptions extends Omit<WrapOptions, 'captureMetrics'> {
  /** Which metrics to capture (default: all) */
  metrics?: (keyof DocsGenerateMetrics)[];
}

/**
 * Default metrics to capture
 */
const DEFAULT_METRICS: (keyof DocsGenerateMetrics)[] = [
  'docsUpdated',
  'jsdocsAdded',
  'sectionsGenerated',
  'tokensUsed',
  'readmesUpdated',
];

/**
 * Create a wrapped docs generator function
 * 
 * @example
 * ```typescript
 * import { createDocsGeneratorIntegration } from 'lifecycle-observer';
 * 
 * // In your AI-Docs-Generator generate command
 * const wrappedGenerate = createDocsGeneratorIntegration(
 *   'generate',
 *   async (options) => {
 *     // Your existing generation logic
 *     const result = await generateDocs(options);
 *     return {
 *       success: true,
 *       docsUpdated: result.updatedFiles.length,
 *       jsdocsAdded: result.jsdocCount,
 *       sectionsGenerated: result.sections.length,
 *       tokensUsed: result.tokensUsed,
 *       targetPath: options.target,
 *     };
 *   }
 * );
 * 
 * export const generate = wrappedGenerate;
 * ```
 */
export function createDocsGeneratorIntegration<TArgs extends unknown[]>(
  command: string,
  fn: (...args: TArgs) => Promise<DocsGenerateResult>,
  options?: DocsGeneratorIntegrationOptions
): (...args: TArgs) => Promise<DocsGenerateResult> {
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
 * Pre-configured wrapper for common docs generator operations
 */
export const docsGeneratorOperations = {
  /**
   * Wrap a generate function
   */
  generate: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<DocsGenerateResult>,
    options?: DocsGeneratorIntegrationOptions
  ) => createDocsGeneratorIntegration('generate', fn, options),

  /**
   * Wrap a jsdoc function
   */
  jsdoc: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<DocsGenerateResult>,
    options?: DocsGeneratorIntegrationOptions
  ) => createDocsGeneratorIntegration('jsdoc', fn, options),

  /**
   * Wrap a readme function
   */
  readme: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<DocsGenerateResult>,
    options?: DocsGeneratorIntegrationOptions
  ) => createDocsGeneratorIntegration('readme', fn, options),

  /**
   * Wrap an api-docs function
   */
  apiDocs: <TArgs extends unknown[]>(
    fn: (...args: TArgs) => Promise<DocsGenerateResult>,
    options?: DocsGeneratorIntegrationOptions
  ) => createDocsGeneratorIntegration('api-docs', fn, options),
};

