/**
 * Executions repository - CRUD operations for execution records
 */

import { getDatabase } from '../connection.js';
import { generateTimestampId } from '../../utils/time.js';
import type {
  ExecutionRecord,
  ExecutionFilter,
  ExecutionSummary,
  LifecycleTool,
  ExecutionStatus,
} from '../../types/index.js';

/**
 * Database row type for executions
 */
interface ExecutionRow {
  id: string;
  timestamp: number;
  tool: string;
  project: string;
  project_path: string;
  command: string;
  args: string | null;
  duration: number;
  status: string;
  error_type: string | null;
  error_message: string | null;
  error_stack: string | null;
  context: string;
  metadata: string | null;
}

/**
 * Convert database row to ExecutionRecord
 */
function rowToExecution(row: ExecutionRow): ExecutionRecord {
  return {
    id: row.id,
    timestamp: new Date(row.timestamp * 1000),
    tool: row.tool as LifecycleTool,
    project: row.project,
    projectPath: row.project_path,
    command: row.command,
    args: row.args ? JSON.parse(row.args) : undefined,
    duration: row.duration,
    status: row.status as ExecutionStatus,
    errorType: (row.error_type as ExecutionRecord['errorType']) ?? undefined,
    errorMessage: row.error_message ?? undefined,
    errorStack: row.error_stack ?? undefined,
    context: JSON.parse(row.context),
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

/**
 * Insert a new execution record
 */
export function insertExecution(execution: Omit<ExecutionRecord, 'id'>): ExecutionRecord {
  const db = getDatabase();
  const id = generateTimestampId('exec');

  const stmt = db.prepare(`
    INSERT INTO executions (
      id, timestamp, tool, project, project_path, command, args,
      duration, status, error_type, error_message, error_stack,
      context, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    Math.floor(execution.timestamp.getTime() / 1000),
    execution.tool,
    execution.project,
    execution.projectPath,
    execution.command,
    execution.args ? JSON.stringify(execution.args) : null,
    execution.duration,
    execution.status,
    execution.errorType ?? null,
    execution.errorMessage ?? null,
    execution.errorStack ?? null,
    JSON.stringify(execution.context),
    execution.metadata ? JSON.stringify(execution.metadata) : null
  );

  return { ...execution, id };
}

/**
 * Get an execution by ID
 */
export function getExecutionById(id: string): ExecutionRecord | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM executions WHERE id = ?').get(id) as ExecutionRow | undefined;
  return row ? rowToExecution(row) : null;
}

/**
 * Get executions with optional filtering
 */
export function getExecutions(filter?: ExecutionFilter): ExecutionRecord[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.tools?.length) {
    conditions.push(`tool IN (${filter.tools.map(() => '?').join(', ')})`);
    params.push(...filter.tools);
  }

  if (filter?.projects?.length) {
    conditions.push(`project IN (${filter.projects.map(() => '?').join(', ')})`);
    params.push(...filter.projects);
  }

  if (filter?.statuses?.length) {
    conditions.push(`status IN (${filter.statuses.map(() => '?').join(', ')})`);
    params.push(...filter.statuses);
  }

  if (filter?.errorTypes?.length) {
    conditions.push(`error_type IN (${filter.errorTypes.map(() => '?').join(', ')})`);
    params.push(...filter.errorTypes);
  }

  if (filter?.since) {
    conditions.push('timestamp >= ?');
    params.push(Math.floor(filter.since.getTime() / 1000));
  }

  if (filter?.until) {
    conditions.push('timestamp <= ?');
    params.push(Math.floor(filter.until.getTime() / 1000));
  }

  let sql = 'SELECT * FROM executions';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY timestamp DESC';

  if (filter?.limit) {
    sql += ' LIMIT ?';
    params.push(filter.limit);
  }

  if (filter?.offset) {
    sql += ' OFFSET ?';
    params.push(filter.offset);
  }

  const rows = db.prepare(sql).all(...params) as ExecutionRow[];
  return rows.map(rowToExecution);
}

/**
 * Get recent executions for a tool/project
 */
export function getRecentExecutions(
  tool?: LifecycleTool,
  project?: string,
  limit = 10
): ExecutionRecord[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (tool) {
    conditions.push('tool = ?');
    params.push(tool);
  }

  if (project) {
    conditions.push('project = ?');
    params.push(project);
  }

  let sql = 'SELECT * FROM executions';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);

  const rows = db.prepare(sql).all(...params) as ExecutionRow[];
  return rows.map(rowToExecution);
}

/**
 * Get execution summary for a tool/project
 */
export function getExecutionSummary(tool: LifecycleTool, project: string): ExecutionSummary | null {
  const db = getDatabase();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
      SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failure_count,
      AVG(duration) as avg_duration,
      MIN(duration) as min_duration,
      MAX(duration) as max_duration,
      MAX(timestamp) as last_timestamp
    FROM executions
    WHERE tool = ? AND project = ?
  `).get(tool, project) as {
    total: number;
    success_count: number;
    failure_count: number;
    avg_duration: number;
    min_duration: number;
    max_duration: number;
    last_timestamp: number;
  } | undefined;

  if (!stats || stats.total === 0) {
    return null;
  }

  const lastExecution = db.prepare(`
    SELECT status FROM executions
    WHERE tool = ? AND project = ?
    ORDER BY timestamp DESC LIMIT 1
  `).get(tool, project) as { status: string } | undefined;

  return {
    tool,
    project,
    totalExecutions: stats.total,
    successCount: stats.success_count,
    failureCount: stats.failure_count,
    successRate: stats.total > 0 ? stats.success_count / stats.total : 0,
    avgDuration: stats.avg_duration,
    minDuration: stats.min_duration,
    maxDuration: stats.max_duration,
    lastExecution: new Date(stats.last_timestamp * 1000),
    lastStatus: (lastExecution?.status as ExecutionStatus) ?? 'failure',
  };
}

/**
 * Count executions matching filter
 */
export function countExecutions(filter?: ExecutionFilter): number {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.tools?.length) {
    conditions.push(`tool IN (${filter.tools.map(() => '?').join(', ')})`);
    params.push(...filter.tools);
  }

  if (filter?.projects?.length) {
    conditions.push(`project IN (${filter.projects.map(() => '?').join(', ')})`);
    params.push(...filter.projects);
  }

  if (filter?.statuses?.length) {
    conditions.push(`status IN (${filter.statuses.map(() => '?').join(', ')})`);
    params.push(...filter.statuses);
  }

  if (filter?.since) {
    conditions.push('timestamp >= ?');
    params.push(Math.floor(filter.since.getTime() / 1000));
  }

  if (filter?.until) {
    conditions.push('timestamp <= ?');
    params.push(Math.floor(filter.until.getTime() / 1000));
  }

  let sql = 'SELECT COUNT(*) as count FROM executions';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  const result = db.prepare(sql).get(...params) as { count: number };
  return result.count;
}

/**
 * Delete executions older than a timestamp
 */
export function deleteOldExecutions(beforeTimestamp: Date): number {
  const db = getDatabase();
  const result = db
    .prepare('DELETE FROM executions WHERE timestamp < ?')
    .run(Math.floor(beforeTimestamp.getTime() / 1000));
  return result.changes;
}

