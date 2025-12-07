/**
 * Integration Verification
 * 
 * Utilities to verify that lifecycle-observer is properly configured
 * and can be used with lifecycle tools.
 */

import { isDatabaseInitialized, initDatabase } from '../database/index.js';
import { loadConfig, expandPath, configExists } from '../config/index.js';
import { initLogger } from '../utils/logger.js';
import type { LifecycleTool } from '../types/index.js';

/**
 * Status of the integration check
 */
export interface IntegrationStatus {
  /** Whether the integration is ready to use */
  ready: boolean;
  /** Configuration status */
  config: {
    found: boolean;
    path?: string;
    error?: string;
  };
  /** Database status */
  database: {
    initialized: boolean;
    path?: string;
    error?: string;
  };
  /** Enabled tools */
  tools: LifecycleTool[];
  /** Enabled projects */
  projects: string[];
  /** Overall status message */
  message: string;
  /** Any warnings */
  warnings: string[];
}

/**
 * Verify that lifecycle-observer is properly configured
 * 
 * @example
 * ```typescript
 * import { verifyIntegration } from 'lifecycle-observer';
 * 
 * const status = await verifyIntegration();
 * 
 * if (!status.ready) {
 *   console.error('Lifecycle observer not ready:', status.message);
 *   console.error('Config:', status.config);
 *   console.error('Database:', status.database);
 * } else {
 *   console.log('Lifecycle observer ready!');
 *   console.log('Enabled tools:', status.tools);
 *   console.log('Enabled projects:', status.projects);
 * }
 * ```
 */
export async function verifyIntegration(): Promise<IntegrationStatus> {
  const status: IntegrationStatus = {
    ready: false,
    config: { found: false },
    database: { initialized: false },
    tools: [],
    projects: [],
    message: '',
    warnings: [],
  };

  // Check configuration
  try {
    const configFound = configExists();
    if (!configFound) {
      status.config = {
        found: false,
        error: 'No configuration file found. Run "lifecycle-observer init" to create one.',
      };
      status.message = 'Configuration not found';
      return status;
    }

    status.config = {
      found: true,
      path: '.lifecyclerc.json', // Default config name
    };

    const config = loadConfig();

    // Check if observer is enabled
    if (!config.enabled) {
      status.warnings.push('Lifecycle observer is disabled in configuration');
    }

    // Get enabled tools and projects
    const enabledProjects = config.projects.filter(p => p.enabled);
    const enabledTools = new Set<LifecycleTool>();
    
    for (const project of enabledProjects) {
      for (const tool of project.tools) {
        enabledTools.add(tool);
      }
    }

    status.tools = Array.from(enabledTools);
    status.projects = enabledProjects.map(p => p.name);

    // Check database
    try {
      const dbPath = expandPath(config.database.path);
      
      if (!isDatabaseInitialized()) {
        initDatabase({ path: dbPath, migrate: true });
        initLogger({ level: config.logLevel });
      }

      status.database = {
        initialized: true,
        path: dbPath,
      };
    } catch (dbError: any) {
      status.database = {
        initialized: false,
        error: dbError.message,
      };
      status.message = 'Database initialization failed';
      return status;
    }

    // Check for potential issues
    if (status.tools.length === 0) {
      status.warnings.push('No tools enabled in any project');
    }

    if (status.projects.length === 0) {
      status.warnings.push('No projects enabled');
    }

    if (!config.ai.enabled) {
      status.warnings.push('AI analysis is disabled - only rule-based detection will work');
    }

    if (!config.alerts.enabled) {
      status.warnings.push('Alerts are disabled');
    }

    if (!config.reporting.enabled) {
      status.warnings.push('Reporting is disabled');
    }

    // All checks passed
    status.ready = true;
    status.message = status.warnings.length > 0
      ? `Ready with ${status.warnings.length} warning(s)`
      : 'Ready';

  } catch (configError: any) {
    status.config = {
      found: true,
      error: configError.message,
    };
    status.message = 'Configuration error';
  }

  return status;
}

/**
 * Format integration status for display
 */
export function formatIntegrationStatus(status: IntegrationStatus): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║            LIFECYCLE OBSERVER INTEGRATION STATUS             ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');

  // Overall status
  const statusIcon = status.ready ? '✅' : '❌';
  lines.push(`  ${statusIcon} Status: ${status.message}`);
  lines.push('');

  // Configuration
  lines.push('  📄 Configuration');
  lines.push('  ─────────────────────────────────────────');
  if (status.config.found) {
    lines.push(`     ✅ Found: ${status.config.path}`);
  } else {
    lines.push(`     ❌ Not found: ${status.config.error}`);
  }
  lines.push('');

  // Database
  lines.push('  💾 Database');
  lines.push('  ─────────────────────────────────────────');
  if (status.database.initialized) {
    lines.push(`     ✅ Initialized: ${status.database.path}`);
  } else {
    lines.push(`     ❌ Error: ${status.database.error}`);
  }
  lines.push('');

  // Tools and projects
  if (status.tools.length > 0) {
    lines.push('  🛠️  Enabled Tools');
    lines.push('  ─────────────────────────────────────────');
    for (const tool of status.tools) {
      lines.push(`     • ${tool}`);
    }
    lines.push('');
  }

  if (status.projects.length > 0) {
    lines.push('  📁 Enabled Projects');
    lines.push('  ─────────────────────────────────────────');
    for (const project of status.projects) {
      lines.push(`     • ${project}`);
    }
    lines.push('');
  }

  // Warnings
  if (status.warnings.length > 0) {
    lines.push('  ⚠️  Warnings');
    lines.push('  ─────────────────────────────────────────');
    for (const warning of status.warnings) {
      lines.push(`     • ${warning}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Quick check if observer can be used (for tool integration)
 */
export function isObserverAvailable(): boolean {
  try {
    const configPath = configExists();
    if (!configPath) return false;

    const config = loadConfig();
    if (!config.enabled) return false;

    const dbPath = expandPath(config.database.path);
    if (!isDatabaseInitialized()) {
      initDatabase({ path: dbPath, migrate: true });
      initLogger({ level: config.logLevel });
    }

    return true;
  } catch {
    return false;
  }
}

