/**
 * Logging utilities using pino
 */

import pino from 'pino';
import type { LogLevel } from '../types/index.js';

/**
 * Map our log levels to pino levels
 */
const LOG_LEVEL_MAP: Record<LogLevel, string> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

/**
 * Logger options
 */
export interface LoggerOptions {
  /** Log level */
  level?: LogLevel;
  /** Whether to use pretty printing (for development) */
  pretty?: boolean;
  /** Logger name */
  name?: string;
}

/**
 * Create a logger instance
 */
export function createLogger(options?: LoggerOptions): pino.Logger {
  const { level = 'info', pretty = true, name = 'lifecycle-observer' } = options ?? {};

  const pinoLevel = LOG_LEVEL_MAP[level];

  if (pretty) {
    return pino({
      name,
      level: pinoLevel,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
    });
  }

  return pino({
    name,
    level: pinoLevel,
  });
}

/**
 * Default logger instance
 */
let defaultLogger: pino.Logger | null = null;

/**
 * Get the default logger
 */
export function getLogger(): pino.Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger();
  }
  return defaultLogger;
}

/**
 * Set the default logger
 */
export function setLogger(logger: pino.Logger): void {
  defaultLogger = logger;
}

/**
 * Initialize the default logger with options
 */
export function initLogger(options: LoggerOptions): pino.Logger {
  defaultLogger = createLogger(options);
  return defaultLogger;
}

/**
 * Create a child logger with additional context
 */
export function createChildLogger(
  context: Record<string, unknown>,
  parent?: pino.Logger
): pino.Logger {
  const logger = parent ?? getLogger();
  return logger.child(context);
}

/**
 * Log levels for convenience
 */
export const LogLevels: Record<string, LogLevel> = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
} as const;

