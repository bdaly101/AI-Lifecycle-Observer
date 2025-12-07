/**
 * Observe command - Start the lifecycle observer
 */

import { Command } from 'commander';
import { getGlobalOptions, initContext, output, handleError } from '../index.js';
import { 
  createImprovementDetector,
  createAlertManager,
} from '../../core/index.js';
import {
  createAlertReporter,
  createProjectReporter,
  createLifecycleReporter,
} from '../../reporters/index.js';
import { getRecentExecutions } from '../../database/repositories/executions.js';
import { getMetricsSnapshot } from '../../database/repositories/metrics.js';
import { getLogger } from '../../utils/logger.js';
import { formatDateTime } from '../../utils/time.js';
import type { LifecycleObserverConfig } from '../../types/index.js';

interface ObserveOptions {
  daemon?: boolean;
  once?: boolean;
  interval?: number;
}

interface ObserveResult {
  timestamp: Date;
  mode: 'once' | 'daemon';
  duration?: number;
  executionsAnalyzed: number;
  improvementsDetected: number;
  alertsTriggered: number;
  reportsGenerated: number;
  status: 'completed' | 'running' | 'stopped';
}

/**
 * Format observe result for display
 */
function formatObserveResult(result: ObserveResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║                  LIFECYCLE OBSERVER                          ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');
  
  lines.push(`  Mode: ${result.mode}`);
  lines.push(`  Status: ${result.status}`);
  lines.push('');
  
  lines.push('  📊 Analysis Results');
  lines.push('  ─────────────────────────────────────────');
  lines.push(`     Executions analyzed:   ${result.executionsAnalyzed}`);
  lines.push(`     Improvements detected: ${result.improvementsDetected}`);
  lines.push(`     Alerts triggered:      ${result.alertsTriggered}`);
  lines.push(`     Reports generated:     ${result.reportsGenerated}`);
  lines.push('');
  
  if (result.duration) {
    lines.push(`  Duration: ${(result.duration / 1000).toFixed(2)}s`);
  }
  lines.push(`  Completed: ${formatDateTime(result.timestamp)}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Run a single observation pass
 */
async function runObservationPass(
  config: LifecycleObserverConfig
): Promise<ObserveResult> {
  const startTime = Date.now();
  const logger = getLogger();
  
  let executionsAnalyzed = 0;
  let improvementsDetected = 0;
  let alertsTriggered = 0;
  let reportsGenerated = 0;
  
  try {
    // Initialize components
    const improvementDetector = createImprovementDetector();
    const alertManager = createAlertManager();
    const alertReporter = createAlertReporter();
    
    // Get recent executions to analyze
    const recentExecutions = getRecentExecutions(undefined, undefined, 100);
    executionsAnalyzed = recentExecutions.length;
    
    if (recentExecutions.length > 0) {
      logger.info(`[Observer] Analyzing ${recentExecutions.length} recent executions...`);
      
      // Run improvement detection
      try {
        const detectionResult = await improvementDetector.detectRecent();
        improvementsDetected = detectionResult.created.length;
        
        if (detectionResult.created.length > 0) {
          logger.info(`[Observer] Detected ${detectionResult.created.length} improvements`);
        }
      } catch (error: any) {
        logger.error(`[Observer] Error during improvement detection: ${error.message}`);
      }
      
      // Run alert checks
      logger.info('[Observer] Running alert checks...');
      const aggregatedMetrics = getMetricsSnapshot({ period: 'daily' });
      const triggeredAlerts = await alertManager.checkRules(
        recentExecutions.slice(0, 50), // Limit to most recent 50
        aggregatedMetrics
      );
      
      alertsTriggered = triggeredAlerts.length;
      
      for (const alert of triggeredAlerts) {
        logger.warn(`[Observer] Alert triggered: ${alert.title}`);
        
        // Report the alert
        try {
          await alertReporter.report(alert);
        } catch (reportError: any) {
          logger.error(`[Observer] Failed to report alert: ${reportError.message}`);
        }
      }
    } else {
      logger.info('[Observer] No recent executions to analyze');
    }
    
    // Generate reports if auto-update is enabled
    if (config.reporting.enabled && config.reporting.autoUpdateFiles) {
      logger.info('[Observer] Generating reports...');
      
      const projectReporter = createProjectReporter(config);
      const lifecycleReporter = createLifecycleReporter(config);
      
      // Generate project reports
      const projectResults = await projectReporter.generateAllReports(true);
      reportsGenerated += projectResults.filter(r => r.written).length;
      
      // Generate lifecycle reports
      const lifecycleResults = await lifecycleReporter.generateReports({
        write: true,
        generateLifecycle: true,
        generateUrgent: true,
      });
      
      if (lifecycleResults.lifecycle?.written) reportsGenerated++;
      if (lifecycleResults.urgent?.written) reportsGenerated++;
    }
    
  } catch (error: any) {
    logger.error(`[Observer] Observation pass failed: ${error.message}`);
    throw error;
  }
  
  return {
    timestamp: new Date(),
    mode: 'once',
    duration: Date.now() - startTime,
    executionsAnalyzed,
    improvementsDetected,
    alertsTriggered,
    reportsGenerated,
    status: 'completed',
  };
}

/**
 * Run the observer in daemon mode
 */
async function runDaemon(
  config: LifecycleObserverConfig,
  intervalMs: number
): Promise<never> {
  const logger = getLogger();
  
  logger.info('[Observer] Starting daemon mode...');
  logger.info(`[Observer] Observation interval: ${intervalMs / 1000}s`);
  
  let running = true;
  let passCount = 0;
  
  // Handle shutdown signals
  const shutdown = () => {
    logger.info('[Observer] Shutting down...');
    running = false;
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  // Initial pass
  try {
    const result = await runObservationPass(config);
    passCount++;
    logger.info(`[Observer] Pass #${passCount} completed: ${result.improvementsDetected} improvements, ${result.alertsTriggered} alerts`);
  } catch (error: any) {
    logger.error(`[Observer] Initial pass failed: ${error.message}`);
  }
  
  // Run at intervals
  while (running) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    
    if (!running) break;
    
    try {
      const result = await runObservationPass(config);
      passCount++;
      logger.info(`[Observer] Pass #${passCount} completed: ${result.improvementsDetected} improvements, ${result.alertsTriggered} alerts`);
    } catch (error: any) {
      logger.error(`[Observer] Pass #${passCount + 1} failed: ${error.message}`);
    }
  }
  
  logger.info(`[Observer] Daemon stopped after ${passCount} passes`);
  process.exit(0);
}

/**
 * Execute the observe command
 */
async function executeObserve(
  config: LifecycleObserverConfig,
  options: ObserveOptions
): Promise<ObserveResult | never> {
  const logger = getLogger();
  
  // Default interval is 5 minutes
  const intervalMs = (options.interval || 300) * 1000;
  
  if (options.daemon && !options.once) {
    // Daemon mode - runs indefinitely
    logger.info('[Observer] Starting in daemon mode...');
    return runDaemon(config, intervalMs);
  } else {
    // Single pass mode (default)
    logger.info('[Observer] Running single observation pass...');
    return runObservationPass(config);
  }
}

/**
 * Register the observe command with the program
 */
export function registerObserveCommand(program: Command): void {
  program
    .command('observe')
    .description('Start the lifecycle observer')
    .option('-d, --daemon', 'Run as background daemon', false)
    .option('--once', 'Run single observation pass (default)', false)
    .option('-i, --interval <seconds>', 'Observation interval in seconds (daemon mode)', parseInt)
    .action(async (options: ObserveOptions) => {
      const globalOpts = getGlobalOptions(program);
      
      try {
        const config = await initContext(globalOpts);
        
        // Validate configuration
        if (!config.enabled) {
          console.error('Lifecycle observer is disabled in configuration.');
          process.exit(1);
        }
        
        const result = await executeObserve(config, options);
        
        // Only output for single pass mode (daemon keeps running)
        if (!options.daemon) {
          output(result, globalOpts.json, formatObserveResult);
        }
      } catch (error: any) {
        handleError(error, globalOpts.json);
      }
    });
}
