/**
 * Default configuration values for the lifecycle observer
 */

import type {
  LifecycleObserverConfig,
  AlertThresholds,
} from '../types/index.js';

/**
 * Default alert thresholds
 */
export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  // Tool-level thresholds
  consecutiveFailures: 3,
  failureRateThreshold: 0.30,
  failureRateWindow: 86400000, // 24 hours
  avgDurationMultiplier: 3,
  timeoutThreshold: 300000, // 5 minutes

  // Security thresholds
  secretsDetected: true,
  permissionEscalation: true,
  unprotectedBranchPush: true,

  // API thresholds
  apiFailureRateThreshold: 0.50,
  apiFailureRateWindow: 3600000, // 1 hour
  rateLimitHits: 5,

  // Git thresholds
  gitOperationFailures: 5,
  gitOperationWindow: 3600000, // 1 hour

  // Coverage thresholds
  coverageDropThreshold: 0.05,
  minimumCoverage: 0.70,
};

/**
 * Default configuration
 */
export const DEFAULT_CONFIG: LifecycleObserverConfig = {
  enabled: true,
  projectsDir: '~/Dev/shared',
  dataDir: '~/.lifecycle-observer',
  logLevel: 'info',

  projects: [],

  ai: {
    enabled: true,
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250929',
    apiKey: 'env:ANTHROPIC_API_KEY',
    maxTokens: 4096,
    temperature: 0.3,
    analyzeEveryNExecutions: 10,
  },

  alerts: {
    enabled: true,
    thresholds: DEFAULT_ALERT_THRESHOLDS,
    channels: {
      console: true,
      file: true,
      github: {
        enabled: false,
        token: 'env:GITHUB_TOKEN',
        createIssues: true,
        issueLabels: ['lifecycle-alert', 'automated'],
      },
    },
    escalation: {
      enabled: false,
      criticalDelayMinutes: 15,
      escalateTo: [],
    },
  },

  reporting: {
    enabled: true,
    autoUpdateFiles: true,
    updateFrequency: 'immediate',
    futureImprovementsFilename: 'FUTURE-IMPROVEMENTS.md',
    includeMetrics: true,
    includeHistory: true,
  },

  database: {
    path: '~/.lifecycle-observer/data.db',
    retentionDays: 90,
    aggregationIntervals: ['hourly', 'daily', 'weekly'],
  },
};

