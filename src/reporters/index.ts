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

