/**
 * Integration Tests for Database Operations
 * 
 * Tests CRUD operations for executions, improvements, alerts, and metrics.
 * Uses an in-memory SQLite database.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type {
  ExecutionRecord,
  ImprovementSuggestion,
  Alert,
} from '../../src/types/index.js';

describe('Database Operations', () => {
  let db: Database.Database;

  beforeAll(() => {
    // Create in-memory database
    db = new Database(':memory:');
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS executions (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        tool TEXT NOT NULL,
        project TEXT NOT NULL,
        project_path TEXT NOT NULL,
        command TEXT NOT NULL,
        args TEXT,
        duration INTEGER NOT NULL,
        status TEXT NOT NULL,
        error_type TEXT,
        error_message TEXT,
        error_stack TEXT,
        context TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS improvements (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        affected_tools TEXT NOT NULL,
        affected_projects TEXT NOT NULL,
        scope TEXT NOT NULL,
        source TEXT NOT NULL,
        source_rule TEXT,
        confidence REAL NOT NULL,
        suggested_action TEXT,
        estimated_impact TEXT,
        related_execution_id TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        category TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        tool TEXT,
        project TEXT,
        triggered_at TEXT NOT NULL,
        acknowledged_at TEXT,
        acknowledged_by TEXT,
        resolved_at TEXT,
        resolved_by TEXT,
        resolution TEXT,
        suppressed_until TEXT,
        cooldown_until TEXT,
        related_execution_id TEXT,
        metadata TEXT
      );

      CREATE TABLE IF NOT EXISTS metrics_daily (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        tool TEXT,
        project TEXT,
        total_executions INTEGER NOT NULL DEFAULT 0,
        successful_executions INTEGER NOT NULL DEFAULT 0,
        failed_executions INTEGER NOT NULL DEFAULT 0,
        total_duration INTEGER NOT NULL DEFAULT 0,
        min_duration INTEGER,
        max_duration INTEGER,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        total_api_calls INTEGER NOT NULL DEFAULT 0,
        improvements_detected INTEGER NOT NULL DEFAULT 0,
        alerts_triggered INTEGER NOT NULL DEFAULT 0,
        UNIQUE(date, tool, project)
      );
    `);
  });

  afterAll(() => {
    db.close();
  });

  beforeEach(() => {
    // Clear tables before each test
    db.exec('DELETE FROM executions');
    db.exec('DELETE FROM improvements');
    db.exec('DELETE FROM alerts');
    db.exec('DELETE FROM metrics_daily');
  });

  describe('Executions', () => {
    it('should insert and retrieve an execution', () => {
      const execution: Omit<ExecutionRecord, 'id'> & { id: string } = {
        id: randomUUID(),
        timestamp: new Date(),
        tool: 'ai-test-generator',
        project: 'test-project',
        projectPath: '/path/to/project',
        command: 'generate',
        args: [],
        duration: 1500,
        status: 'success',
        context: {},
        metadata: {},
      };

      const insert = db.prepare(`
        INSERT INTO executions (id, timestamp, tool, project, project_path, command, args, duration, status, context, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(
        execution.id,
        execution.timestamp.toISOString(),
        execution.tool,
        execution.project,
        execution.projectPath,
        execution.command,
        JSON.stringify(execution.args),
        execution.duration,
        execution.status,
        JSON.stringify(execution.context),
        JSON.stringify(execution.metadata)
      );

      const select = db.prepare('SELECT * FROM executions WHERE id = ?');
      const result = select.get(execution.id) as any;

      expect(result).toBeDefined();
      expect(result.tool).toBe('ai-test-generator');
      expect(result.project).toBe('test-project');
      expect(result.status).toBe('success');
      expect(result.duration).toBe(1500);
    });

    it('should query executions by tool', () => {
      const insert = db.prepare(`
        INSERT INTO executions (id, timestamp, tool, project, project_path, command, duration, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(randomUUID(), new Date().toISOString(), 'ai-pr-dev', 'project1', '/path', 'review', 1000, 'success');
      insert.run(randomUUID(), new Date().toISOString(), 'ai-test-generator', 'project1', '/path', 'generate', 2000, 'success');
      insert.run(randomUUID(), new Date().toISOString(), 'ai-pr-dev', 'project2', '/path', 'review', 1500, 'failure');

      const select = db.prepare('SELECT * FROM executions WHERE tool = ?');
      const results = select.all('ai-pr-dev') as any[];

      expect(results).toHaveLength(2);
      expect(results.every(r => r.tool === 'ai-pr-dev')).toBe(true);
    });

    it('should query executions by status', () => {
      const insert = db.prepare(`
        INSERT INTO executions (id, timestamp, tool, project, project_path, command, duration, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(randomUUID(), new Date().toISOString(), 'ai-pr-dev', 'project1', '/path', 'review', 1000, 'success');
      insert.run(randomUUID(), new Date().toISOString(), 'ai-pr-dev', 'project1', '/path', 'review', 2000, 'failure');
      insert.run(randomUUID(), new Date().toISOString(), 'ai-pr-dev', 'project1', '/path', 'review', 1500, 'success');

      const select = db.prepare('SELECT * FROM executions WHERE status = ?');
      const successResults = select.all('success') as any[];
      const failureResults = select.all('failure') as any[];

      expect(successResults).toHaveLength(2);
      expect(failureResults).toHaveLength(1);
    });

    it('should calculate execution statistics', () => {
      const insert = db.prepare(`
        INSERT INTO executions (id, timestamp, tool, project, project_path, command, duration, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(randomUUID(), new Date().toISOString(), 'ai-pr-dev', 'p', '/path', 'cmd', 1000, 'success');
      insert.run(randomUUID(), new Date().toISOString(), 'ai-pr-dev', 'p', '/path', 'cmd', 2000, 'success');
      insert.run(randomUUID(), new Date().toISOString(), 'ai-pr-dev', 'p', '/path', 'cmd', 3000, 'failure');
      insert.run(randomUUID(), new Date().toISOString(), 'ai-pr-dev', 'p', '/path', 'cmd', 4000, 'success');

      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
          SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) as failed,
          AVG(duration) as avg_duration,
          MIN(duration) as min_duration,
          MAX(duration) as max_duration
        FROM executions
      `).get() as any;

      expect(stats.total).toBe(4);
      expect(stats.successful).toBe(3);
      expect(stats.failed).toBe(1);
      expect(stats.avg_duration).toBe(2500);
      expect(stats.min_duration).toBe(1000);
      expect(stats.max_duration).toBe(4000);
    });
  });

  describe('Improvements', () => {
    it('should insert and retrieve an improvement', () => {
      const improvement = {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        type: 'performance',
        severity: 'medium',
        status: 'open',
        title: 'Test Improvement',
        description: 'Test description',
        affected_tools: JSON.stringify(['ai-pr-dev']),
        affected_projects: JSON.stringify(['project1']),
        scope: 'project',
        source: 'rule',
        confidence: 0.85,
      };

      const insert = db.prepare(`
        INSERT INTO improvements (id, timestamp, type, severity, status, title, description, affected_tools, affected_projects, scope, source, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(
        improvement.id,
        improvement.timestamp,
        improvement.type,
        improvement.severity,
        improvement.status,
        improvement.title,
        improvement.description,
        improvement.affected_tools,
        improvement.affected_projects,
        improvement.scope,
        improvement.source,
        improvement.confidence
      );

      const select = db.prepare('SELECT * FROM improvements WHERE id = ?');
      const result = select.get(improvement.id) as any;

      expect(result).toBeDefined();
      expect(result.type).toBe('performance');
      expect(result.severity).toBe('medium');
      expect(result.status).toBe('open');
      expect(result.confidence).toBe(0.85);
    });

    it('should update improvement status', () => {
      const id = randomUUID();
      
      db.prepare(`
        INSERT INTO improvements (id, timestamp, type, severity, status, title, description, affected_tools, affected_projects, scope, source, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, new Date().toISOString(), 'security', 'high', 'open', 'Title', 'Desc', '[]', '[]', 'project', 'rule', 0.9);

      db.prepare('UPDATE improvements SET status = ? WHERE id = ?').run('resolved', id);

      const result = db.prepare('SELECT status FROM improvements WHERE id = ?').get(id) as any;
      expect(result.status).toBe('resolved');
    });

    it('should query improvements by severity', () => {
      const insert = db.prepare(`
        INSERT INTO improvements (id, timestamp, type, severity, status, title, description, affected_tools, affected_projects, scope, source, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(randomUUID(), new Date().toISOString(), 'security', 'urgent', 'open', 'T1', 'D', '[]', '[]', 'project', 'rule', 0.9);
      insert.run(randomUUID(), new Date().toISOString(), 'performance', 'medium', 'open', 'T2', 'D', '[]', '[]', 'project', 'rule', 0.8);
      insert.run(randomUUID(), new Date().toISOString(), 'reliability', 'urgent', 'open', 'T3', 'D', '[]', '[]', 'project', 'rule', 0.85);

      const results = db.prepare('SELECT * FROM improvements WHERE severity = ?').all('urgent') as any[];
      expect(results).toHaveLength(2);
    });
  });

  describe('Alerts', () => {
    it('should insert and retrieve an alert', () => {
      const alert = {
        id: randomUUID(),
        rule_id: 'SEC-001',
        category: 'security',
        severity: 'critical',
        status: 'active',
        title: 'Security Alert',
        message: 'Critical security issue detected',
        triggered_at: new Date().toISOString(),
      };

      db.prepare(`
        INSERT INTO alerts (id, rule_id, category, severity, status, title, message, triggered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        alert.id,
        alert.rule_id,
        alert.category,
        alert.severity,
        alert.status,
        alert.title,
        alert.message,
        alert.triggered_at
      );

      const result = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alert.id) as any;

      expect(result).toBeDefined();
      expect(result.category).toBe('security');
      expect(result.severity).toBe('critical');
      expect(result.status).toBe('active');
    });

    it('should acknowledge an alert', () => {
      const id = randomUUID();
      
      db.prepare(`
        INSERT INTO alerts (id, rule_id, category, severity, status, title, message, triggered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, 'RULE-001', 'performance', 'warning', 'active', 'Alert', 'Message', new Date().toISOString());

      const acknowledgedAt = new Date().toISOString();
      db.prepare(`
        UPDATE alerts SET status = 'acknowledged', acknowledged_at = ?, acknowledged_by = ? WHERE id = ?
      `).run(acknowledgedAt, 'test-user', id);

      const result = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as any;
      expect(result.status).toBe('acknowledged');
      expect(result.acknowledged_by).toBe('test-user');
    });

    it('should resolve an alert', () => {
      const id = randomUUID();
      
      db.prepare(`
        INSERT INTO alerts (id, rule_id, category, severity, status, title, message, triggered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, 'RULE-001', 'performance', 'warning', 'active', 'Alert', 'Message', new Date().toISOString());

      const resolvedAt = new Date().toISOString();
      db.prepare(`
        UPDATE alerts SET status = 'resolved', resolved_at = ?, resolved_by = ?, resolution = ? WHERE id = ?
      `).run(resolvedAt, 'test-user', 'Fixed the issue', id);

      const result = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as any;
      expect(result.status).toBe('resolved');
      expect(result.resolved_by).toBe('test-user');
      expect(result.resolution).toBe('Fixed the issue');
    });

    it('should query active alerts', () => {
      const insert = db.prepare(`
        INSERT INTO alerts (id, rule_id, category, severity, status, title, message, triggered_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(randomUUID(), 'R1', 'security', 'critical', 'active', 'A1', 'M', new Date().toISOString());
      insert.run(randomUUID(), 'R2', 'performance', 'warning', 'resolved', 'A2', 'M', new Date().toISOString());
      insert.run(randomUUID(), 'R3', 'reliability', 'error', 'active', 'A3', 'M', new Date().toISOString());

      const results = db.prepare('SELECT * FROM alerts WHERE status = ?').all('active') as any[];
      expect(results).toHaveLength(2);
    });
  });

  describe('Daily Metrics', () => {
    it('should insert and retrieve daily metrics', () => {
      const date = '2024-12-07';
      
      db.prepare(`
        INSERT INTO metrics_daily (date, tool, project, total_executions, successful_executions, failed_executions, total_duration)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(date, 'ai-pr-dev', 'project1', 100, 95, 5, 150000);

      const result = db.prepare('SELECT * FROM metrics_daily WHERE date = ?').get(date) as any;

      expect(result.total_executions).toBe(100);
      expect(result.successful_executions).toBe(95);
      expect(result.failed_executions).toBe(5);
      expect(result.total_duration).toBe(150000);
    });

    it('should aggregate metrics by tool', () => {
      const insert = db.prepare(`
        INSERT INTO metrics_daily (date, tool, project, total_executions, successful_executions, total_duration)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      insert.run('2024-12-07', 'ai-pr-dev', 'p1', 50, 48, 75000);
      insert.run('2024-12-07', 'ai-pr-dev', 'p2', 30, 28, 45000);
      insert.run('2024-12-07', 'ai-test-generator', 'p1', 20, 19, 30000);

      const result = db.prepare(`
        SELECT tool, SUM(total_executions) as total, SUM(successful_executions) as successful
        FROM metrics_daily
        WHERE date = ?
        GROUP BY tool
      `).all('2024-12-07') as any[];

      const prDev = result.find(r => r.tool === 'ai-pr-dev');
      expect(prDev.total).toBe(80);
      expect(prDev.successful).toBe(76);

      const testGen = result.find(r => r.tool === 'ai-test-generator');
      expect(testGen.total).toBe(20);
      expect(testGen.successful).toBe(19);
    });

    it('should update existing metrics on conflict', () => {
      const date = '2024-12-07';
      const tool = 'ai-pr-dev';
      const project = 'project1';

      // Insert initial metrics
      db.prepare(`
        INSERT INTO metrics_daily (date, tool, project, total_executions, successful_executions)
        VALUES (?, ?, ?, ?, ?)
      `).run(date, tool, project, 10, 9);

      // Update using UPSERT pattern
      db.prepare(`
        INSERT INTO metrics_daily (date, tool, project, total_executions, successful_executions)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date, tool, project) DO UPDATE SET
          total_executions = total_executions + excluded.total_executions,
          successful_executions = successful_executions + excluded.successful_executions
      `).run(date, tool, project, 5, 4);

      const result = db.prepare('SELECT * FROM metrics_daily WHERE date = ? AND tool = ? AND project = ?')
        .get(date, tool, project) as any;

      expect(result.total_executions).toBe(15);
      expect(result.successful_executions).toBe(13);
    });
  });
});

