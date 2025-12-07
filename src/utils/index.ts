/**
 * Utility module exports
 */

export {
  createLogger,
  getLogger,
  setLogger,
  initLogger,
  createChildLogger,
  LogLevels,
  type LoggerOptions,
} from './logger.js';

export {
  ensureDir,
  ensureParentDir,
  readFileOrNull,
  readJsonOrNull,
  writeFileSafe,
  writeJsonSafe,
  deleteFileSafe,
  expandHome,
  resolvePath,
  getFilesInDir,
  getProjectName,
  isDirectory,
  isFile,
} from './fs.js';

export {
  formatDuration,
  formatDate,
  formatDateTime,
  formatDateDisplay,
  startOfDay,
  endOfDay,
  startOfHour,
  daysAgo,
  hoursAgo,
  minutesAgo,
  isWithinWindow,
  timeSince,
  generateTimestampId,
  parseDate,
  todayIso,
  TimeWindows,
} from './time.js';

