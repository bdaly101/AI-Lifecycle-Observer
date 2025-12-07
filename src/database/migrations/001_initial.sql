-- Initial database schema for lifecycle observer
-- Version: 001
-- Created: 2024

-- Executions table - stores all tool execution records
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  tool TEXT NOT NULL,
  project TEXT NOT NULL,
  project_path TEXT NOT NULL,
  command TEXT NOT NULL,
  args TEXT,                          -- JSON array
  duration INTEGER NOT NULL,
  status TEXT NOT NULL,
  error_type TEXT,
  error_message TEXT,
  error_stack TEXT,
  context TEXT NOT NULL,              -- JSON object
  metadata TEXT,                      -- JSON object
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_executions_timestamp ON executions(timestamp);
CREATE INDEX IF NOT EXISTS idx_executions_tool ON executions(tool);
CREATE INDEX IF NOT EXISTS idx_executions_project ON executions(project);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_tool_project ON executions(tool, project);

-- Improvements table - stores detected improvement suggestions
CREATE TABLE IF NOT EXISTS improvements (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  scope TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  suggested_action TEXT NOT NULL,
  affected_tools TEXT NOT NULL,       -- JSON array
  affected_projects TEXT NOT NULL,    -- JSON array
  detected_at INTEGER NOT NULL,
  detected_by TEXT NOT NULL,
  detection_context TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  status_updated_at INTEGER,
  resolution TEXT,
  related_improvements TEXT,          -- JSON array
  estimated_impact TEXT,
  estimated_effort TEXT,
  tags TEXT,                          -- JSON array
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_improvements_status ON improvements(status);
CREATE INDEX IF NOT EXISTS idx_improvements_severity ON improvements(severity);
CREATE INDEX IF NOT EXISTS idx_improvements_type ON improvements(type);
CREATE INDEX IF NOT EXISTS idx_improvements_detected_at ON improvements(detected_at);

-- Alerts table - stores triggered alerts
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  tool TEXT,
  project TEXT,
  triggered_at INTEGER NOT NULL,
  triggered_by TEXT NOT NULL,
  context TEXT NOT NULL,              -- JSON object
  acknowledged_at INTEGER,
  acknowledged_by TEXT,
  resolved_at INTEGER,
  resolved_by TEXT,
  resolution TEXT,
  suppressed_until INTEGER,
  related_executions TEXT,            -- JSON array
  notifications_sent TEXT,            -- JSON array
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_category ON alerts(category);
CREATE INDEX IF NOT EXISTS idx_alerts_triggered_at ON alerts(triggered_at);

-- Daily metrics table - aggregated daily statistics
CREATE TABLE IF NOT EXISTS metrics_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,                 -- YYYY-MM-DD
  tool TEXT,                          -- NULL for aggregate
  project TEXT,                       -- NULL for aggregate
  total_executions INTEGER NOT NULL DEFAULT 0,
  successful_executions INTEGER NOT NULL DEFAULT 0,
  failed_executions INTEGER NOT NULL DEFAULT 0,
  total_duration INTEGER NOT NULL DEFAULT 0,
  min_duration INTEGER,
  max_duration INTEGER,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  total_api_calls INTEGER NOT NULL DEFAULT 0,
  improvements_detected INTEGER NOT NULL DEFAULT 0,
  improvements_resolved INTEGER NOT NULL DEFAULT 0,
  alerts_triggered INTEGER NOT NULL DEFAULT 0,
  alerts_resolved INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(date, tool, project)
);

CREATE INDEX IF NOT EXISTS idx_metrics_daily_date ON metrics_daily(date);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_tool ON metrics_daily(tool);
CREATE INDEX IF NOT EXISTS idx_metrics_daily_project ON metrics_daily(project);

-- Schema migrations tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at INTEGER DEFAULT (unixepoch())
);

-- Insert migration version
INSERT OR IGNORE INTO schema_migrations (version) VALUES (1);

