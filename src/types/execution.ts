/**
 * Execution tracking types for the lifecycle observer
 */

/**
 * Supported lifecycle tools that can be monitored
 */
export type LifecycleTool =
  | 'ai-pr-dev'
  | 'ai-feature-builder'
  | 'ai-test-generator'
  | 'ai-docs-generator'
  | 'ai-sql-dev';

/**
 * Possible states for an execution
 */
export type ExecutionStatus = 'running' | 'success' | 'failure' | 'timeout' | 'cancelled';

/**
 * Categorized error types for better analysis
 */
export type ErrorCategory =
  | 'api_key_missing'
  | 'api_rate_limit'
  | 'api_error'
  | 'git_error'
  | 'file_not_found'
  | 'permission_denied'
  | 'config_invalid'
  | 'parse_error'
  | 'timeout'
  | 'network_error'
  | 'validation_error'
  | 'unknown';

/**
 * Additional context captured during execution
 */
export interface ExecutionContext {
  /** Current git branch */
  gitBranch: string;
  /** Current git commit hash */
  gitCommit?: string;
  /** Number of files processed */
  fileCount?: number;
  /** Lines of code changed */
  linesChanged?: number;
  /** AI tokens consumed */
  aiTokensUsed?: number;
  /** AI model used */
  aiModel?: string;
  /** Number of API calls made */
  apiCalls?: number;
}

/**
 * Complete record of a tool execution
 */
export interface ExecutionRecord {
  /** Unique identifier */
  id: string;
  /** When the execution started */
  timestamp: Date;
  /** Which tool was executed */
  tool: LifecycleTool;
  /** Project name (directory name) */
  project: string;
  /** Full path to the project */
  projectPath: string;
  /** Command that was executed */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Total duration in milliseconds */
  duration: number;
  /** Final status of the execution */
  status: ExecutionStatus;
  /** Categorized error type if failed */
  errorType?: ErrorCategory;
  /** Error message if failed */
  errorMessage?: string;
  /** Stack trace if available */
  errorStack?: string;
  /** Execution context */
  context: ExecutionContext;
  /** Additional tool-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Summary statistics for a tool/project combination
 */
export interface ExecutionSummary {
  /** Tool being summarized */
  tool: LifecycleTool;
  /** Project being summarized */
  project: string;
  /** Total number of executions */
  totalExecutions: number;
  /** Number of successful executions */
  successCount: number;
  /** Number of failed executions */
  failureCount: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average duration in ms */
  avgDuration: number;
  /** Minimum duration in ms */
  minDuration: number;
  /** Maximum duration in ms */
  maxDuration: number;
  /** When was the last execution */
  lastExecution: Date;
  /** Status of the last execution */
  lastStatus: ExecutionStatus;
}

/**
 * Options for starting an execution tracking session
 */
export interface StartExecutionOptions {
  /** Tool being executed */
  tool: LifecycleTool;
  /** Command being run */
  command: string;
  /** Command arguments */
  args?: string[];
  /** Project name */
  project: string;
  /** Project path */
  projectPath: string;
  /** Initial context */
  context?: Partial<ExecutionContext>;
  /** Initial metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of an execution to record
 */
export interface ExecutionResult {
  /** Final status */
  status: ExecutionStatus;
  /** Error type if failed */
  errorType?: ErrorCategory;
  /** Error message if failed */
  errorMessage?: string;
  /** Stack trace if available */
  errorStack?: string;
  /** Additional context collected during execution */
  additionalContext?: Partial<ExecutionContext>;
  /** Additional metadata collected */
  additionalMetadata?: Record<string, unknown>;
}

/**
 * Filter options for querying executions
 */
export interface ExecutionFilter {
  /** Filter by tools */
  tools?: LifecycleTool[];
  /** Filter by projects */
  projects?: string[];
  /** Filter by statuses */
  statuses?: ExecutionStatus[];
  /** Filter by error types */
  errorTypes?: ErrorCategory[];
  /** Start of date range */
  since?: Date;
  /** End of date range */
  until?: Date;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

