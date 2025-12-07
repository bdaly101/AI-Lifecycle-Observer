/**
 * Tool Integrations Module
 * 
 * Provides pre-configured integration helpers for each lifecycle tool.
 * These helpers simplify the process of integrating lifecycle-observer
 * into existing tools.
 */

export {
  wrapTool,
  wrapToolSync,
  createTrackedExecution,
  tracked,
  createExecutionRecord,
  type WrapOptions,
  type WrapResult,
  type ExecutionHandle,
  type ExecutionRecord,
  type ExecutionResult,
  type ExecutionContext,
  type ErrorCategory,
} from '../hooks/wrapper.js';

export {
  createPRDevIntegration,
  type PRDevIntegrationOptions,
  type PRReviewResult,
} from './ai-pr-dev.js';

export {
  createFeatureBuilderIntegration,
  type FeatureBuilderIntegrationOptions,
  type FeatureImplementResult,
} from './ai-feature-builder.js';

export {
  createTestGeneratorIntegration,
  type TestGeneratorIntegrationOptions,
  type TestGenerateResult,
} from './ai-test-generator.js';

export {
  createDocsGeneratorIntegration,
  type DocsGeneratorIntegrationOptions,
  type DocsGenerateResult,
} from './ai-docs-generator.js';

export {
  createSQLDevIntegration,
  type SQLDevIntegrationOptions,
  type SQLDevGenerateResult,
} from './ai-sql-dev.js';

/**
 * Quick integration check - verify observer is properly configured
 */
export { verifyIntegration, type IntegrationStatus } from './verify.js';

