/**
 * Alerts repository - CRUD operations for alert records
 */

import { getDatabase } from '../connection.js';
import { generateTimestampId } from '../../utils/time.js';
import type {
  Alert,
  AlertFilter,
  CreateAlertData,
  UpdateAlertData,
  AlertCategory,
  AlertSeverity,
  AlertStatus,
  AlertNotification,
  LifecycleTool,
} from '../../types/index.js';

/**
 * Database row type for alerts
 */
interface AlertRow {
  id: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  message: string;
  tool: string | null;
  project: string | null;
  triggered_at: number;
  triggered_by: string;
  context: string;
  acknowledged_at: number | null;
  acknowledged_by: string | null;
  resolved_at: number | null;
  resolved_by: string | null;
  resolution: string | null;
  suppressed_until: number | null;
  related_executions: string | null;
  notifications_sent: string | null;
}

/**
 * Convert database row to Alert
 */
function rowToAlert(row: AlertRow): Alert {
  return {
    id: row.id,
    category: row.category as AlertCategory,
    severity: row.severity as AlertSeverity,
    status: row.status as AlertStatus,
    title: row.title,
    message: row.message,
    tool: (row.tool as LifecycleTool) ?? undefined,
    project: row.project ?? undefined,
    triggeredAt: new Date(row.triggered_at * 1000),
    triggeredBy: row.triggered_by,
    context: JSON.parse(row.context),
    acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at * 1000) : undefined,
    acknowledgedBy: row.acknowledged_by ?? undefined,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at * 1000) : undefined,
    resolvedBy: row.resolved_by ?? undefined,
    resolution: row.resolution ?? undefined,
    suppressedUntil: row.suppressed_until ? new Date(row.suppressed_until * 1000) : undefined,
    relatedExecutions: row.related_executions ? JSON.parse(row.related_executions) : undefined,
    notificationsSent: row.notifications_sent ? JSON.parse(row.notifications_sent) : [],
  };
}

/**
 * Insert a new alert
 */
export function insertAlert(data: CreateAlertData): Alert {
  const db = getDatabase();
  const id = generateTimestampId('alert');
  const now = Math.floor(Date.now() / 1000);

  const stmt = db.prepare(`
    INSERT INTO alerts (
      id, category, severity, status, title, message, tool, project,
      triggered_at, triggered_by, context, related_executions, notifications_sent
    ) VALUES (?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, '[]')
  `);

  stmt.run(
    id,
    data.category,
    data.severity,
    data.title,
    data.message,
    data.tool ?? null,
    data.project ?? null,
    now,
    data.triggeredBy,
    JSON.stringify(data.context),
    data.relatedExecutions ? JSON.stringify(data.relatedExecutions) : null
  );

  return {
    id,
    ...data,
    status: 'active',
    triggeredAt: new Date(now * 1000),
    notificationsSent: [],
  };
}

/**
 * Get an alert by ID
 */
export function getAlertById(id: string): Alert | null {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as AlertRow | undefined;
  return row ? rowToAlert(row) : null;
}

/**
 * Get alerts with optional filtering
 */
export function getAlerts(filter?: AlertFilter): Alert[] {
  const db = getDatabase();
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter?.categories?.length) {
    conditions.push(`category IN (${filter.categories.map(() => '?').join(', ')})`);
    params.push(...filter.categories);
  }

  if (filter?.severities?.length) {
    conditions.push(`severity IN (${filter.severities.map(() => '?').join(', ')})`);
    params.push(...filter.severities);
  }

  if (filter?.statuses?.length) {
    conditions.push(`status IN (${filter.statuses.map(() => '?').join(', ')})`);
    params.push(...filter.statuses);
  }

  if (filter?.tools?.length) {
    conditions.push(`tool IN (${filter.tools.map(() => '?').join(', ')})`);
    params.push(...filter.tools);
  }

  if (filter?.projects?.length) {
    conditions.push(`project IN (${filter.projects.map(() => '?').join(', ')})`);
    params.push(...filter.projects);
  }

  if (filter?.since) {
    conditions.push('triggered_at >= ?');
    params.push(Math.floor(filter.since.getTime() / 1000));
  }

  if (filter?.until) {
    conditions.push('triggered_at <= ?');
    params.push(Math.floor(filter.until.getTime() / 1000));
  }

  let sql = 'SELECT * FROM alerts';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY triggered_at DESC';

  if (filter?.limit) {
    sql += ' LIMIT ?';
    params.push(filter.limit);
  }

  if (filter?.offset) {
    sql += ' OFFSET ?';
    params.push(filter.offset);
  }

  const rows = db.prepare(sql).all(...params) as AlertRow[];
  return rows.map(rowToAlert);
}

/**
 * Update an alert
 */
export function updateAlert(id: string, data: UpdateAlertData): Alert | null {
  const db = getDatabase();
  const updates: string[] = ['updated_at = ?'];
  const params: unknown[] = [Math.floor(Date.now() / 1000)];

  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);

    if (data.status === 'acknowledged') {
      updates.push('acknowledged_at = ?', 'acknowledged_by = ?');
      params.push(Math.floor(Date.now() / 1000), data.acknowledgedBy ?? null);
    }

    if (data.status === 'resolved') {
      updates.push('resolved_at = ?', 'resolved_by = ?', 'resolution = ?');
      params.push(
        Math.floor(Date.now() / 1000),
        data.resolvedBy ?? null,
        data.resolution ?? null
      );
    }
  }

  if (data.suppressedUntil !== undefined) {
    updates.push('suppressed_until = ?', 'status = ?');
    params.push(Math.floor(data.suppressedUntil.getTime() / 1000), 'suppressed');
  }

  params.push(id);

  const sql = `UPDATE alerts SET ${updates.join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...params);

  return getAlertById(id);
}

/**
 * Add a notification record to an alert
 */
export function addAlertNotification(id: string, notification: AlertNotification): void {
  const db = getDatabase();
  const alert = getAlertById(id);
  if (!alert) return;

  const notifications = [...alert.notificationsSent, notification];
  db.prepare('UPDATE alerts SET notifications_sent = ? WHERE id = ?').run(
    JSON.stringify(notifications),
    id
  );
}

/**
 * Get active alerts
 */
export function getActiveAlerts(): Alert[] {
  return getAlerts({ statuses: ['active'] });
}

/**
 * Get critical alerts
 */
export function getCriticalAlerts(): Alert[] {
  return getAlerts({
    severities: ['critical'],
    statuses: ['active'],
  });
}

/**
 * Acknowledge an alert
 */
export function acknowledgeAlert(id: string, by: string): Alert | null {
  return updateAlert(id, { status: 'acknowledged', acknowledgedBy: by });
}

/**
 * Resolve an alert
 */
export function resolveAlert(id: string, by: string, resolution: string): Alert | null {
  return updateAlert(id, { status: 'resolved', resolvedBy: by, resolution });
}

/**
 * Suppress an alert until a date
 */
export function suppressAlert(id: string, until: Date): Alert | null {
  return updateAlert(id, { suppressedUntil: until });
}

/**
 * Check if an alert rule is in cooldown
 */
export function isRuleInCooldown(ruleId: string, cooldownMs: number): boolean {
  const db = getDatabase();
  const cutoff = Math.floor((Date.now() - cooldownMs) / 1000);

  const result = db.prepare(`
    SELECT COUNT(*) as count
    FROM alerts
    WHERE triggered_by = ? AND triggered_at > ?
  `).get(ruleId, cutoff) as { count: number };

  return result.count > 0;
}

