/**
 * Execution Collector - Tracks tool executions with timing, context, and metrics
 */

import { simpleGit } from 'simple-git';
import { insertExecution, incrementExecutionMetrics } from '../database/index.js';
import { getLogger } from '../utils/logger.js';
import { getProjectName, isDirectory } from '../utils/fs.js';
import { generateTimestampId } from '../utils/time.js';
import type {
  LifecycleTool,
  ExecutionRecord,
  ExecutionContext,
  ErrorCategory,
  ExecutionResult,
} from '../types/index.js';

/**
 * Handle returned when starting an execution
 */
export interface ExecutionHandle {
  /** Unique execution ID */
  id: string;
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
  /** Start timestamp */
  startTime: number;
  /** Accumulated context */
  context: ExecutionContext;
  /** Accumulated metadata */
  metadata: Record<string, unknown>;
  /** Recorded metrics */
  metrics: Map<string, number | string>;
}

/**
 * Options for starting execution tracking
 */
export interface StartOptions {
  /** Project name (auto-detected if not provided) */
  project?: string;
  /** Project path (defaults to cwd) */
  projectPath?: string;
  /** Initial context values */
  context?: Partial<ExecutionContext>;
  /** Initial metadata */
  metadata?: Record<string, unknown>;
  /** Skip git context extraction */
  skipGitContext?: boolean;
}

/**
 * Execution Collector class - manages execution tracking
 */
export class ExecutionCollector {
  private activeExecutions: Map<string, ExecutionHandle> = new Map();
  private logger = getLogger();

  constructor() {
    // Initialization
  }

  /**
   * Start tracking an execution
   */
  async startExecution(
    tool: LifecycleTool,
    command: string,
    options?: StartOptions
  ): Promise<ExecutionHandle> {
    const {
      project,
      projectPath = process.cwd(),
      context: initialContext = {},
      metadata: initialMetadata = {},
      skipGitContext = false,
    } = options ?? {};

    const id = generateTimestampId('exec');
    const startTime = Date.now();

    // Determine project name
    const projectName = project ?? getProjectName(projectPath);

    // Build initial context
    let gitContext: Partial<ExecutionContext> = {};
    if (!skipGitContext && isDirectory(projectPath)) {
      try {
        gitContext = await this.extractGitContext(projectPath);
      } catch (error) {
        this.logger.debug({ error }, 'Failed to extract git context');
      }
    }

    const context: ExecutionContext = {
      gitBranch: gitContext.gitBranch ?? 'unknown',
      gitCommit: gitContext.gitCommit,
      ...initialContext,
    };

    const handle: ExecutionHandle = {
      id,
      tool,
      command,
      args: options?.context ? undefined : undefined,
      project: projectName,
      projectPath,
      startTime,
      context,
      metadata: initialMetadata,
      metrics: new Map(),
    };

    this.activeExecutions.set(id, handle);

    this.logger.debug(
      { id, tool, command, project: projectName },
      'Started execution tracking'
    );

    return handle;
  }

  /**
   * Record a metric during execution
   */
  recordMetric(handle: ExecutionHandle, key: string, value: number | string): void {
    handle.metrics.set(key, value);
    this.logger.debug({ executionId: handle.id, key, value }, 'Recorded metric');
  }

  /**
   * Update context during execution
   */
  updateContext(handle: ExecutionHandle, context: Partial<ExecutionContext>): void {
    Object.assign(handle.context, context);
  }

  /**
   * Update metadata during execution
   */
  updateMetadata(handle: ExecutionHandle, metadata: Record<string, unknown>): void {
    Object.assign(handle.metadata, metadata);
  }

  /**
   * End execution tracking and persist the record
   */
  endExecution(handle: ExecutionHandle, result: ExecutionResult): ExecutionRecord {
    const duration = Date.now() - handle.startTime;

    // Merge additional context and metadata
    const finalContext: ExecutionContext = {
      ...handle.context,
      ...result.additionalContext,
    };

    const finalMetadata: Record<string, unknown> = {
      ...handle.metadata,
      ...result.additionalMetadata,
      metrics: Object.fromEntries(handle.metrics),
    };

    // Create execution record
    const record: Omit<ExecutionRecord, 'id'> = {
      timestamp: new Date(handle.startTime),
      tool: handle.tool,
      project: handle.project,
      projectPath: handle.projectPath,
      command: handle.command,
      args: handle.args,
      duration,
      status: result.status,
      errorType: result.errorType,
      errorMessage: result.errorMessage,
      errorStack: result.errorStack,
      context: finalContext,
      metadata: finalMetadata,
    };

    // Persist to database
    const savedRecord = insertExecution(record);

    // Update metrics
    incrementExecutionMetrics(
      handle.tool,
      handle.project,
      duration,
      result.status === 'success',
      finalContext.aiTokensUsed,
      finalContext.apiCalls
    );

    // Remove from active executions
    this.activeExecutions.delete(handle.id);

    this.logger.info(
      {
        id: savedRecord.id,
        tool: handle.tool,
        command: handle.command,
        duration,
        status: result.status,
      },
      'Execution completed'
    );

    return savedRecord;
  }

  /**
   * Mark execution as failed with error details
   */
  failExecution(
    handle: ExecutionHandle,
    error: Error | unknown,
    category?: ErrorCategory
  ): ExecutionRecord {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    const errorType = category ?? this.categorizeError(error);

    return this.endExecution(handle, {
      status: 'failure',
      errorType,
      errorMessage,
      errorStack,
    });
  }

  /**
   * Mark execution as successful
   */
  succeedExecution(
    handle: ExecutionHandle,
    additionalContext?: Partial<ExecutionContext>,
    additionalMetadata?: Record<string, unknown>
  ): ExecutionRecord {
    return this.endExecution(handle, {
      status: 'success',
      additionalContext,
      additionalMetadata,
    });
  }

  /**
   * Cancel an execution
   */
  cancelExecution(handle: ExecutionHandle, reason?: string): ExecutionRecord {
    return this.endExecution(handle, {
      status: 'cancelled',
      additionalMetadata: { cancellationReason: reason },
    });
  }

  /**
   * Get an active execution by ID
   */
  getActiveExecution(id: string): ExecutionHandle | undefined {
    return this.activeExecutions.get(id);
  }

  /**
   * Get all active executions
   */
  getActiveExecutions(): ExecutionHandle[] {
    return Array.from(this.activeExecutions.values());
  }

  /**
   * Extract git context from a directory
   */
  private async extractGitContext(projectPath: string): Promise<Partial<ExecutionContext>> {
    const git = simpleGit(projectPath);

    try {
      const [branch, log, status] = await Promise.all([
        git.branchLocal(),
        git.log({ maxCount: 1 }).catch(() => null),
        git.status().catch(() => null),
      ]);

      return {
        gitBranch: branch.current,
        gitCommit: log?.latest?.hash,
        fileCount: status?.files?.length ?? 0,
      };
    } catch {
      return {};
    }
  }

  /**
   * Categorize an error based on its message and type
   */
  private categorizeError(error: unknown): ErrorCategory {
    if (!(error instanceof Error)) {
      return 'unknown';
    }

    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // API key issues
    if (message.includes('api_key') || message.includes('apikey') || message.includes('api key')) {
      return 'api_key_missing';
    }

    // Rate limiting
    if (message.includes('rate limit') || message.includes('ratelimit') || message.includes('429')) {
      return 'api_rate_limit';
    }

    // API errors
    if (message.includes('api error') || name.includes('apierror')) {
      return 'api_error';
    }

    // Git errors
    if (message.includes('git') || name.includes('git')) {
      return 'git_error';
    }

    // File not found
    if (message.includes('enoent') || message.includes('not found') || message.includes('does not exist')) {
      return 'file_not_found';
    }

    // Permission errors
    if (message.includes('eperm') || message.includes('permission denied') || message.includes('eacces')) {
      return 'permission_denied';
    }

    // Config errors
    if (message.includes('config') || message.includes('configuration')) {
      return 'config_invalid';
    }

    // Parse errors
    if (message.includes('parse') || message.includes('syntax') || name.includes('syntaxerror')) {
      return 'parse_error';
    }

    // Timeout
    if (message.includes('timeout') || message.includes('timed out') || name.includes('timeout')) {
      return 'timeout';
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('econnrefused') ||
      message.includes('enotfound') ||
      message.includes('fetch failed')
    ) {
      return 'network_error';
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return 'validation_error';
    }

    return 'unknown';
  }
}

/**
 * Singleton instance of ExecutionCollector
 */
let collectorInstance: ExecutionCollector | null = null;

/**
 * Get the singleton ExecutionCollector instance
 */
export function getExecutionCollector(): ExecutionCollector {
  if (!collectorInstance) {
    collectorInstance = new ExecutionCollector();
  }
  return collectorInstance;
}

/**
 * Create a new ExecutionCollector instance (for testing)
 */
export function createExecutionCollector(): ExecutionCollector {
  return new ExecutionCollector();
}

