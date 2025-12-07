/**
 * Reporters module exports
 */

export {
  type NotificationChannel,
  type NotificationResult,
  type ChannelOptions,
  resultToNotification,
  formatSeverity,
  formatCategory,
  formatAlertDate,
  buildAlertSummary,
} from './notification-channel.js';

export {
  ConsoleChannel,
  createConsoleChannel,
  type ConsoleChannelOptions,
} from './console-channel.js';

export {
  FileChannel,
  createFileChannel,
  type FileChannelOptions,
} from './file-channel.js';

export {
  GitHubChannel,
  createGitHubChannel,
  type GitHubChannelOptions,
} from './github-channel.js';

export {
  UrgentAlertReporter,
  getAlertReporter,
  createAlertReporter,
  type AlertReporterConfig,
  type AlertReportResult,
} from './urgent-alert-reporter.js';

export {
  generateFutureImprovements,
  generateLifecycleImprovements,
  generateUrgentIssues,
  getVersion,
  calculateAge,
  FUTURE_IMPROVEMENTS_TEMPLATE,
  LIFECYCLE_IMPROVEMENTS_TEMPLATE,
  URGENT_ISSUES_TEMPLATE,
  type FutureImprovementsData,
  type LifecycleImprovementsData,
  type UrgentIssuesData,
} from './markdown-generator.js';

export {
  ProjectReporter,
  createProjectReporter,
  getProjectReporter,
  type ProjectReportOptions,
  type ProjectReportResult,
} from './project-reporter.js';

export {
  LifecycleReporter,
  createLifecycleReporter,
  getLifecycleReporter,
  type LifecycleReportOptions,
  type LifecycleReportResult,
} from './lifecycle-reporter.js';

