/**
 * Time and duration utility functions
 */

/**
 * Format milliseconds as human-readable duration
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
  }

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Format a date as ISO string (date only)
 */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] ?? date.toISOString();
}

/**
 * Format a date as ISO string with time
 */
export function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
}

/**
 * Format a date for display
 */
export function formatDateDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Get the start of a day
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of a day
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get the start of the current hour
 */
export function startOfHour(date: Date): Date {
  const result = new Date(date);
  result.setMinutes(0, 0, 0);
  return result;
}

/**
 * Get a date N days ago
 */
export function daysAgo(days: number): Date {
  const result = new Date();
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * Get a date N hours ago
 */
export function hoursAgo(hours: number): Date {
  const result = new Date();
  result.setTime(result.getTime() - hours * 60 * 60 * 1000);
  return result;
}

/**
 * Get a date N minutes ago
 */
export function minutesAgo(minutes: number): Date {
  const result = new Date();
  result.setTime(result.getTime() - minutes * 60 * 1000);
  return result;
}

/**
 * Check if a date is within a time window
 */
export function isWithinWindow(date: Date, windowMs: number, reference?: Date): boolean {
  const ref = reference ?? new Date();
  const diff = ref.getTime() - date.getTime();
  return diff >= 0 && diff <= windowMs;
}

/**
 * Calculate time elapsed since a date
 */
export function timeSince(date: Date): number {
  return Date.now() - date.getTime();
}

/**
 * Generate a unique ID based on timestamp
 */
export function generateTimestampId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const id = `${timestamp}-${random}`;
  return prefix ? `${prefix}-${id}` : id;
}

/**
 * Parse a date string or return null
 */
export function parseDate(value: string | number | Date): Date | null {
  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Get ISO date string for today
 */
export function todayIso(): string {
  return formatDate(new Date());
}

/**
 * Time window constants in milliseconds
 */
export const TimeWindows = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

