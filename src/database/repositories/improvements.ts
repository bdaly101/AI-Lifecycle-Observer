/**
 * Improvements repository - CRUD operations for improvement suggestions
 */

import { getDatabase } from '../connection.js';
import { generateTimestampId } from '../../utils/time.js';
import type {
  ImprovementSuggestion,
  ImprovementFilter,
  CreateImprovementData,
  UpdateImprovementData,
  ImprovementSummary,
  ImprovementSeverity,
  ImprovementType,
  ImprovementStatus,
  ImprovementScope,
  DetectionMethod,
  EstimationLevel,
  LifecycleTool,
} from '../../types/index.js';

/**
 * Database row type for improvements
 */
interface ImprovementRow {
  id: string;
  type: string;
  severity: string;
  scope: string;
  title: string;
  description: string;
  suggested_action: string;
  affected_tools: string;
  affected_projects: string;
  detected_at: number;
  detected_by: string;
  detection_context: string | null;
  status: string;
  status_updated_at: number | null;
  resolution: string | null;
  related_improvements: string | null;
  estimated_impact: string | null;
  estimated_effort: string | null;
  tags: string | null;
}

/**
 * Convert database row to ImprovementSuggestion
 */
function rowToImprovement(row: ImprovementRow): ImprovementSuggestion {
  return {
    id: row.id,
    type: row.type as ImprovementType,
    severity: row.severity as ImprovementSeverity,
    scope: row.scope as ImprovementScope,
    title: row.title,
    description: row.description,
    suggestedAction: row.suggested_action,
    affectedTools: JSON.parse(row.affected_tools) as LifecycleTool[],
    affectedProjects: JSON.parse(row.affected_projects) as string[],
    detectedAt: new Date(row.detected_at * 1000),
    detectedBy: row.detected_by as DetectionMethod,
    detectionContext: row.detection_context ?? undefined,
    status: row.status as ImprovementStatus,
    statusUpdatedAt: row.status_updated_at ? new Date(row.status_updated_at * 1000) : undefined,
    resolution: row.resolution ?? undefined,
    relatedImprovements: row.related_improvements ? JSON.parse(row.related_improvements) : undefined,
    estimatedImpact: (row.estimated_impact as EstimationLevel) ?? undefined,
    estimatedEffort: (row.estimated_effort as EstimationLevel) ?? undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
  };
}

/**
 * Insert a new improvement
 */
export function insertImprovement(data: CreateImprovementData): ImprovementSuggestion {
  const db = getDatabase();
  const id = generateTimestampId('imp');
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare(`
    INSERT INTO improvements (
      id, type, severity, scope, title, description, suggested_action,
      affected_tools, affected_projects, detected_at, detected_by,
      detection_context, status, related_improvements, estimated_impact,
      estimated_effort, tags
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.type,
    data.severity,
    data.scope,
    data.title,
    data.description,
    data.suggestedAction,
    JSON.stringify(data.affectedTools),
    JSON.stringify(data.affectedProjects),
    now,
    data.detectedBy,
    data.detectionContext ?? null,
    data.relatedImprovements ? JSON.stringify(data.relatedImprovements) : null,
    data.estimatedImpact ?? null,
    data.estimatedEffort ?? null,
    data.tags ? JSON.stringify(data.tags) : null
  );

  return {
    id,
    ...data,
    detectedAt: new Date(now * 1000),
    status: 'open',
  };
}

/**
 * Get an improvement by ID
 */
export function getImprovementById(id: string): ImprovementSuggestion | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM improvements WHERE id = ?').get(id) as ImprovementRow | undefined;
  return row ? rowToImprovement(row) : null;
}

/**
 * Get improvements with optional filtering
 */
export function getImprovements(filter?: ImprovementFilter): ImprovementSuggestion[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.types?.length) {
    conditions.push(`type IN (${filter.types.map(() => '?').join(', ')})`);
    params.push(...filter.types);
  }

  if (filter?.severities?.length) {
    conditions.push(`severity IN (${filter.severities.map(() => '?').join(', ')})`);
    params.push(...filter.severities);
  }

  if (filter?.statuses?.length) {
    conditions.push(`status IN (${filter.statuses.map(() => '?').join(', ')})`);
    params.push(...filter.statuses);
  }

  if (filter?.scope) {
    conditions.push('scope = ?');
    params.push(filter.scope);
  }

  if (filter?.detectedBy?.length) {
    conditions.push(`detected_by IN (${filter.detectedBy.map(() => '?').join(', ')})`);
    params.push(...filter.detectedBy);
  }

  if (filter?.since) {
    conditions.push('detected_at >= ?');
    params.push(Math.floor(filter.since.getTime() / 1000));
  }

  if (filter?.until) {
    conditions.push('detected_at <= ?');
    params.push(Math.floor(filter.until.getTime() / 1000));
  }

  let sql = 'SELECT * FROM improvements';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY detected_at DESC';

  if (filter?.limit) {
    sql += ' LIMIT ?';
    params.push(filter.limit);
  }

  if (filter?.offset) {
    sql += ' OFFSET ?';
    params.push(filter.offset);
  }

  const rows = db.prepare(sql).all(...params) as ImprovementRow[];
  return rows.map(rowToImprovement);
}

/**
 * Update an improvement
 */
export function updateImprovement(id: string, data: UpdateImprovementData): ImprovementSuggestion | null {
  const db = getDatabase();
  const updates: string[] = ['updated_at = ?'];
  const params: unknown[] = [Math.floor(Date.now() / 1000)];

  if (data.status !== undefined) {
    updates.push('status = ?', 'status_updated_at = ?');
    params.push(data.status, Math.floor(Date.now() / 1000));
  }

  if (data.resolution !== undefined) {
    updates.push('resolution = ?');
    params.push(data.resolution);
  }

  if (data.estimatedImpact !== undefined) {
    updates.push('estimated_impact = ?');
    params.push(data.estimatedImpact);
  }

  if (data.estimatedEffort !== undefined) {
    updates.push('estimated_effort = ?');
    params.push(data.estimatedEffort);
  }

  if (data.tags !== undefined) {
    updates.push('tags = ?');
    params.push(JSON.stringify(data.tags));
  }

  params.push(id);

  const sql = `UPDATE improvements SET ${updates.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...params);

  return getImprovementById(id);
}

/**
 * Get improvement summary for a project
 */
export function getImprovementSummary(project: string): ImprovementSummary {
  const db = getDatabase();

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
      SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count,
      SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved_count,
      SUM(CASE WHEN status = 'dismissed' THEN 1 ELSE 0 END) as dismissed_count
    FROM improvements
    WHERE affected_projects LIKE ?
  `).get(`%"${project}"%`) as {
    total: number;
    open_count: number;
    in_progress_count: number;
    resolved_count: number;
    dismissed_count: number;
  };

  const bySeverity = db.prepare(`
    SELECT severity, COUNT(*) as count
    FROM improvements
    WHERE affected_projects LIKE ?
    GROUP BY severity
  `).all(`%"${project}"%`) as { severity: string; count: number }[];

  const byType = db.prepare(`
    SELECT type, COUNT(*) as count
    FROM improvements
    WHERE affected_projects LIKE ?
    GROUP BY type
  `).all(`%"${project}"%`) as { type: string; count: number }[];

  const severityCounts: Record<ImprovementSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    urgent: 0,
  };
  for (const row of bySeverity) {
    severityCounts[row.severity as ImprovementSeverity] = row.count;
  }

  const typeCounts: Record<ImprovementType, number> = {
    performance: 0,
    reliability: 0,
    usability: 0,
    security: 0,
    feature: 0,
    documentation: 0,
    integration: 0,
  };
  for (const row of byType) {
    typeCounts[row.type as ImprovementType] = row.count;
  }

  return {
    project,
    total: stats.total,
    open: stats.open_count,
    inProgress: stats.in_progress_count,
    resolved: stats.resolved_count,
    dismissed: stats.dismissed_count,
    bySeverity: severityCounts,
    byType: typeCounts,
  };
}

/**
 * Get open improvements for a project
 */
export function getOpenImprovements(project?: string): ImprovementSuggestion[] {
  return getImprovements({
    projects: project ? [project] : undefined,
    statuses: ['open', 'in_progress'],
  });
}

/**
 * Get urgent improvements
 */
export function getUrgentImprovements(): ImprovementSuggestion[] {
  return getImprovements({
    severities: ['urgent'],
    statuses: ['open', 'in_progress'],
  });
}

