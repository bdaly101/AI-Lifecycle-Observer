#!/usr/bin/env node
/**
 * CLI entry point for lifecycle-observer
 */

import { Command, Option } from 'commander';
import { loadConfig } from '../config/index.js';
import { initDatabase, closeDatabase } from '../database/index.js';
import { initLogger, getLogger } from '../utils/logger.js';
import type { LifecycleObserverConfig, LogLevel } from '../types/index.js';

// Import command registrations
import {
  registerInitCommand,
  registerStatusCommand,
  registerMetricsCommand,
  registerAlertsCommand,
  registerReportCommand,
  registerObserveCommand,
} from './commands/index.js';

/**
 * Global CLI options accessible by all commands
 */
export interface GlobalOptions {
  config?: string;
  verbose: boolean;
  json: boolean;
}

/**
 * Get global options from program
 */
export function getGlobalOptions(program: Command): GlobalOptions {
  const opts = program.opts();
  return {
    config: opts.config,
    verbose: opts.verbose ?? false,
    json: opts.json ?? false,
  };
}

/**
 * Initialize the application context (config, database, logger)
 */
export async function initContext(
  globalOpts: GlobalOptions
): Promise<LifecycleObserverConfig> {
  // Determine log level
  const logLevel: LogLevel = globalOpts.verbose ? 'debug' : 'info';
  
  // Initialize logger
  initLogger({ level: logLevel, pretty: !globalOpts.json });
  const logger = getLogger();

  // Load configuration
  let config: LifecycleObserverConfig;
  try {
    config = loadConfig({ configPath: globalOpts.config });
    logger.debug('Configuration loaded successfully');
  } catch (error: any) {
    if (!globalOpts.json) {
      console.error(`Error loading config: ${error.message}`);
      console.error('Run "lifecycle-observer init" to create a configuration file.');
    }
    process.exit(1);
  }

  // Initialize database
  try {
    initDatabase({ path: config.database.path });
    logger.debug('Database initialized');
  } catch (error: any) {
    logger.error(`Failed to initialize database: ${error.message}`);
    process.exit(1);
  }

  return config;
}

/**
 * Output data in JSON or formatted text
 */
export function output<T>(data: T, jsonMode: boolean, formatter?: (data: T) => string): void {
  if (jsonMode) {
    console.log(JSON.stringify(data, null, 2));
  } else if (formatter) {
    console.log(formatter(data));
  } else {
    console.log(data);
  }
}

/**
 * Handle command errors consistently
 */
export function handleError(error: any, jsonMode: boolean): never {
  if (jsonMode) {
    console.log(JSON.stringify({ error: error.message, stack: error.stack }, null, 2));
  } else {
    console.error(`Error: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
  }
  process.exit(1);
}

/**
 * Cleanup on exit
 */
function cleanup(): void {
  try {
    closeDatabase();
  } catch {
    // Ignore errors during cleanup
  }
}

// Register cleanup handlers
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(130);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(143);
});

// Create the main program
const program = new Command();

program
  .name('lifecycle-observer')
  .description('Self-learning observer for AI dev lifecycle tools')
  .version('0.1.0')
  .addOption(
    new Option('-c, --config <path>', 'Path to configuration file')
      .env('LIFECYCLE_OBSERVER_CONFIG')
  )
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('--json', 'Output results as JSON', false);

// Register all commands
registerInitCommand(program);
registerStatusCommand(program);
registerMetricsCommand(program);
registerAlertsCommand(program);
registerReportCommand(program);
registerObserveCommand(program);

// Parse and execute
program.parse();
