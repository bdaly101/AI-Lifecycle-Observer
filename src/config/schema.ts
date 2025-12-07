/**
 * Zod validation schemas for configuration
 */

import { z } from 'zod';

/**
 * Lifecycle tool schema
 */
export const lifecycleToolSchema = z.enum([
  'ai-pr-dev',
  'ai-feature-builder',
  'ai-test-generator',
  'ai-docs-generator',
  'ai-sql-dev',
]);

/**
 * Log level schema
 */
export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

/**
 * Update frequency schema
 */
export const updateFrequencySchema = z.enum(['immediate', 'hourly', 'daily']);

/**
 * Metrics period schema
 */
export const metricsPeriodSchema = z.enum(['hourly', 'daily', 'weekly', 'monthly']);

/**
 * Project config schema
 */
export const projectConfigSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  enabled: z.boolean().default(true),
  tools: z.array(lifecycleToolSchema).default([]),
});

/**
 * AI config schema
 */
export const aiConfigSchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.literal('anthropic').default('anthropic'),
  model: z.string().default('claude-sonnet-4-20250929'),
  apiKey: z.string().default('env:ANTHROPIC_API_KEY'),
  maxTokens: z.number().int().positive().default(4096),
  temperature: z.number().min(0).max(2).default(0.3),
  analyzeEveryNExecutions: z.number().int().positive().default(10),
});

/**
 * Alert thresholds schema
 */
export const alertThresholdsSchema = z.object({
  consecutiveFailures: z.number().int().positive().default(3),
  failureRateThreshold: z.number().min(0).max(1).default(0.30),
  failureRateWindow: z.number().int().positive().default(86400000),
  avgDurationMultiplier: z.number().positive().default(3),
  timeoutThreshold: z.number().int().positive().default(300000),
  secretsDetected: z.boolean().default(true),
  permissionEscalation: z.boolean().default(true),
  unprotectedBranchPush: z.boolean().default(true),
  apiFailureRateThreshold: z.number().min(0).max(1).default(0.50),
  apiFailureRateWindow: z.number().int().positive().default(3600000),
  rateLimitHits: z.number().int().positive().default(5),
  gitOperationFailures: z.number().int().positive().default(5),
  gitOperationWindow: z.number().int().positive().default(3600000),
  coverageDropThreshold: z.number().min(0).max(1).default(0.05),
  minimumCoverage: z.number().min(0).max(1).default(0.70),
});

/**
 * GitHub alert config schema
 */
export const githubAlertConfigSchema = z.object({
  enabled: z.boolean().default(false),
  token: z.string().default('env:GITHUB_TOKEN'),
  createIssues: z.boolean().default(true),
  issueLabels: z.array(z.string()).default(['lifecycle-alert', 'automated']),
});

/**
 * Slack alert config schema
 */
export const slackAlertConfigSchema = z.object({
  enabled: z.boolean().default(false),
  webhookUrl: z.string().default('env:SLACK_WEBHOOK_URL'),
  channel: z.string().default('#dev-alerts'),
  mentionUsers: z.array(z.string()).optional(),
});

/**
 * Email alert config schema
 */
export const emailAlertConfigSchema = z.object({
  enabled: z.boolean().default(false),
  recipients: z.array(z.string().email()).default([]),
  smtpConfig: z.record(z.unknown()).default({}),
});

/**
 * Alert channel config schema
 */
export const alertChannelConfigSchema = z.object({
  console: z.boolean().default(true),
  file: z.boolean().default(true),
  github: githubAlertConfigSchema.default({}),
  slack: slackAlertConfigSchema.optional(),
  email: emailAlertConfigSchema.optional(),
});

/**
 * Escalation config schema
 */
export const escalationConfigSchema = z.object({
  enabled: z.boolean().default(false),
  criticalDelayMinutes: z.number().int().positive().default(15),
  escalateTo: z.array(z.string()).default([]),
});

/**
 * Alert config schema
 */
export const alertConfigSchema = z.object({
  enabled: z.boolean().default(true),
  thresholds: alertThresholdsSchema.default({}),
  channels: alertChannelConfigSchema.default({}),
  escalation: escalationConfigSchema.default({}),
});

/**
 * Reporting config schema
 */
export const reportingConfigSchema = z.object({
  enabled: z.boolean().default(true),
  autoUpdateFiles: z.boolean().default(true),
  updateFrequency: updateFrequencySchema.default('immediate'),
  futureImprovementsFilename: z.string().default('FUTURE-IMPROVEMENTS.md'),
  includeMetrics: z.boolean().default(true),
  includeHistory: z.boolean().default(true),
});

/**
 * Database config schema
 */
export const databaseConfigSchema = z.object({
  path: z.string().default('~/.lifecycle-observer/data.db'),
  retentionDays: z.number().int().positive().default(90),
  aggregationIntervals: z.array(metricsPeriodSchema).default(['hourly', 'daily', 'weekly']),
});

/**
 * Complete config schema
 */
export const lifecycleObserverConfigSchema = z.object({
  enabled: z.boolean().default(true),
  projectsDir: z.string().default('~/Dev/shared'),
  dataDir: z.string().default('~/.lifecycle-observer'),
  logLevel: logLevelSchema.default('info'),
  projects: z.array(projectConfigSchema).default([]),
  ai: aiConfigSchema.default({}),
  alerts: alertConfigSchema.default({}),
  reporting: reportingConfigSchema.default({}),
  database: databaseConfigSchema.default({}),
});

/**
 * Infer types from schemas
 */
export type LifecycleToolInput = z.input<typeof lifecycleToolSchema>;
export type ProjectConfigInput = z.input<typeof projectConfigSchema>;
export type AIConfigInput = z.input<typeof aiConfigSchema>;
export type AlertConfigInput = z.input<typeof alertConfigSchema>;
export type ReportingConfigInput = z.input<typeof reportingConfigSchema>;
export type DatabaseConfigInput = z.input<typeof databaseConfigSchema>;
export type LifecycleObserverConfigInput = z.input<typeof lifecycleObserverConfigSchema>;

