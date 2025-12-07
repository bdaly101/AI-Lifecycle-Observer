/**
 * Init command - Initialize lifecycle-observer configuration
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { getGlobalOptions, output, handleError } from '../index.js';
import { ensureDir } from '../../utils/fs.js';
import type { LifecycleObserverConfig } from '../../types/index.js';

/**
 * Default configuration template
 */
const CONFIG_TEMPLATE: LifecycleObserverConfig = {
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
    thresholds: {
      consecutiveFailures: 3,
      failureRateThreshold: 0.30,
      failureRateWindow: 86400000,
      avgDurationMultiplier: 3,
      timeoutThreshold: 300000,
      secretsDetected: true,
      permissionEscalation: true,
      unprotectedBranchPush: true,
      apiFailureRateThreshold: 0.50,
      apiFailureRateWindow: 3600000,
      rateLimitHits: 5,
      gitOperationFailures: 5,
      gitOperationWindow: 3600000,
      coverageDropThreshold: 0.05,
      minimumCoverage: 0.70,
    },
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

/**
 * Get the config file path to create
 */
function getConfigPath(): string {
  // Default to current directory
  return path.join(process.cwd(), '.lifecyclerc.json');
}

/**
 * Expand tilde in path
 */
function expandTilde(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(process.env.HOME || '', p.slice(2));
  }
  return p;
}

/**
 * Format config result for display
 */
function formatInitResult(result: InitResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('✅ Lifecycle Observer initialized successfully!');
  lines.push('');
  lines.push(`   Config file: ${result.configPath}`);
  lines.push(`   Data directory: ${result.dataDir}`);
  lines.push('');
  lines.push('Next steps:');
  lines.push('');
  lines.push('  1. Edit .lifecyclerc.json to add your projects');
  lines.push('  2. Set your ANTHROPIC_API_KEY environment variable');
  lines.push('  3. Run "lifecycle-observer status" to verify setup');
  lines.push('  4. Run "lifecycle-observer observe" to start monitoring');
  lines.push('');
  
  return lines.join('\n');
}

interface InitResult {
  configPath: string;
  dataDir: string;
  created: boolean;
  existed: boolean;
}

interface InitOptions {
  force?: boolean;
}

/**
 * Execute the init command
 */
async function executeInit(options: InitOptions): Promise<InitResult> {
  const configPath = getConfigPath();
  const existed = fs.existsSync(configPath);

  // Check if config already exists
  if (existed && !options.force) {
    throw new Error(
      `Configuration file already exists at ${configPath}. Use --force to overwrite.`
    );
  }

  // Create config from template
  const config = { ...CONFIG_TEMPLATE };

  // Expand data directory path
  const dataDir = expandTilde(config.dataDir);
  
  // Create data directory
  await ensureDir(dataDir);

  // Write config file
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  return {
    configPath,
    dataDir,
    created: true,
    existed,
  };
}

/**
 * Register the init command with the program
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize lifecycle-observer configuration')
    .option('-f, --force', 'Overwrite existing configuration', false)
    .action(async (options: InitOptions) => {
      const globalOpts = getGlobalOptions(program);

      try {
        const result = await executeInit(options);
        output(result, globalOpts.json, formatInitResult);
      } catch (error: any) {
        handleError(error, globalOpts.json);
      }
    });
}
