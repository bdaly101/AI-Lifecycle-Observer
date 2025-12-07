/**
 * Collectors module exports
 */

export {
  ExecutionCollector,
  getExecutionCollector,
  createExecutionCollector,
  type ExecutionHandle,
  type StartOptions,
} from './execution-collector.js';

export {
  ErrorCollector,
  getErrorCollector,
  createErrorCollector,
  type ErrorFrequency,
  type ErrorTrend,
  type ErrorAnalysis,
} from './error-collector.js';

