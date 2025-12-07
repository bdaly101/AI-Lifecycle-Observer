/**
 * Report command - Generate improvement reports
 */

import { Command } from 'commander';
import { getGlobalOptions, initContext, output, handleError } from '../index.js';
import { 
  createProjectReporter,
  createLifecycleReporter,
} from '../../reporters/index.js';
import type { LifecycleObserverConfig } from '../../types/index.js';

interface ReportOptions {
  project?: string;
  lifecycleOnly?: boolean;
  dryRun?: boolean;
}

interface ReportResult {
  timestamp: Date;
  dryRun: boolean;
  projectReports: Array<{
    project: string;
    outputPath?: string;
    written: boolean;
    error?: string;
    previewLength?: number;
  }>;
  lifecycleReport?: {
    outputPath?: string;
    written: boolean;
    error?: string;
    previewLength?: number;
  };
  urgentReport?: {
    outputPath?: string;
    written: boolean;
    error?: string;
    previewLength?: number;
  };
}

/**
 * Format report result for display
 */
function formatReportResult(result: ReportResult): string {
  const lines: string[] = [];
  
  lines.push('');
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║                    REPORT GENERATION                         ║');
  lines.push('╚══════════════════════════════════════════════════════════════╝');
  lines.push('');
  
  if (result.dryRun) {
    lines.push('  🔍 DRY RUN MODE - No files were written');
    lines.push('');
  }
  
  // Project reports
  if (result.projectReports.length > 0) {
    lines.push('  📁 Project Reports');
    lines.push('  ─────────────────────────────────────────');
    
    for (const pr of result.projectReports) {
      if (pr.error) {
        lines.push(`     ❌ ${pr.project}: ${pr.error}`);
      } else if (pr.written) {
        lines.push(`     ✅ ${pr.project}: ${pr.outputPath}`);
      } else if (result.dryRun) {
        lines.push(`     📝 ${pr.project}: Would generate ${pr.previewLength} chars`);
      }
    }
    lines.push('');
  }
  
  // Lifecycle report
  if (result.lifecycleReport) {
    lines.push('  🌐 Lifecycle Report');
    lines.push('  ─────────────────────────────────────────');
    
    if (result.lifecycleReport.error) {
      lines.push(`     ❌ Error: ${result.lifecycleReport.error}`);
    } else if (result.lifecycleReport.written) {
      lines.push(`     ✅ ${result.lifecycleReport.outputPath}`);
    } else if (result.dryRun) {
      lines.push(`     📝 Would generate ${result.lifecycleReport.previewLength} chars`);
    }
    lines.push('');
  }
  
  // Urgent report
  if (result.urgentReport) {
    lines.push('  🚨 Urgent Issues Report');
    lines.push('  ─────────────────────────────────────────');
    
    if (result.urgentReport.error) {
      lines.push(`     ❌ Error: ${result.urgentReport.error}`);
    } else if (result.urgentReport.written) {
      lines.push(`     ✅ ${result.urgentReport.outputPath}`);
    } else if (result.dryRun) {
      lines.push(`     📝 Would generate ${result.urgentReport.previewLength} chars`);
    }
    lines.push('');
  }
  
  // Summary
  const totalSuccess = result.projectReports.filter(p => p.written && !p.error).length;
  const totalFailed = result.projectReports.filter(p => p.error).length;
  
  lines.push('  Summary');
  lines.push('  ─────────────────────────────────────────');
  if (result.dryRun) {
    lines.push(`     Would generate ${result.projectReports.length} project report(s)`);
    if (result.lifecycleReport) lines.push('     Would generate lifecycle report');
    if (result.urgentReport) lines.push('     Would generate urgent issues report');
  } else {
    lines.push(`     Projects: ${totalSuccess} success, ${totalFailed} failed`);
    if (result.lifecycleReport?.written) lines.push('     Lifecycle report: ✅');
    if (result.urgentReport?.written) lines.push('     Urgent issues report: ✅');
  }
  lines.push('');
  
  lines.push(`  Generated: ${result.timestamp.toLocaleString()}`);
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Execute the report command
 */
async function executeReport(
  config: LifecycleObserverConfig,
  options: ReportOptions
): Promise<ReportResult> {
  const result: ReportResult = {
    timestamp: new Date(),
    dryRun: options.dryRun || false,
    projectReports: [],
  };
  
  const shouldWrite = !options.dryRun;
  
  // Generate project reports (unless lifecycle-only)
  if (!options.lifecycleOnly) {
    const projectReporter = createProjectReporter(config);
    
    if (options.project) {
      // Single project
      const project = config.projects.find(p => p.name === options.project);
      if (!project) {
        throw new Error(`Project not found: ${options.project}`);
      }
      
      const pr = await projectReporter.generateReport({
        project,
        write: shouldWrite,
      });
      
      result.projectReports.push({
        project: pr.project,
        outputPath: pr.outputPath,
        written: pr.written,
        error: pr.error,
        previewLength: pr.content.length,
      });
    } else {
      // All projects
      const reports = await projectReporter.generateAllReports(shouldWrite);
      
      for (const pr of reports) {
        result.projectReports.push({
          project: pr.project,
          outputPath: pr.outputPath,
          written: pr.written,
          error: pr.error,
          previewLength: pr.content.length,
        });
      }
    }
  }
  
  // Generate lifecycle reports
  const lifecycleReporter = createLifecycleReporter(config);
  const lifecycleResults = await lifecycleReporter.generateReports({
    write: shouldWrite,
    generateLifecycle: true,
    generateUrgent: true,
  });
  
  if (lifecycleResults.lifecycle) {
    result.lifecycleReport = {
      outputPath: lifecycleResults.lifecycle.outputPath,
      written: lifecycleResults.lifecycle.written,
      error: lifecycleResults.lifecycle.error,
      previewLength: lifecycleResults.lifecycle.content.length,
    };
  }
  
  if (lifecycleResults.urgent) {
    result.urgentReport = {
      outputPath: lifecycleResults.urgent.outputPath,
      written: lifecycleResults.urgent.written,
      error: lifecycleResults.urgent.error,
      previewLength: lifecycleResults.urgent.content.length,
    };
  }
  
  return result;
}

/**
 * Register the report command with the program
 */
export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('Generate improvement reports')
    .option('-p, --project <name>', 'Generate report for specific project only')
    .option('-l, --lifecycle-only', 'Generate only lifecycle-wide reports', false)
    .option('-d, --dry-run', 'Preview reports without writing files', false)
    .action(async (options: ReportOptions) => {
      const globalOpts = getGlobalOptions(program);
      
      try {
        const config = await initContext(globalOpts);
        const result = await executeReport(config, options);
        output(result, globalOpts.json, formatReportResult);
      } catch (error: any) {
        handleError(error, globalOpts.json);
      }
    });
}
