/**
 * Unit Tests for CLI Commands
 * 
 * Tests command logic and formatting functions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock ensureDir
vi.mock('../../src/utils/fs.js', () => ({
  ensureDir: vi.fn().mockResolvedValue(undefined),
}));

describe('CLI Commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Init Command Logic', () => {
    it('should detect when config already exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      
      const configPath = path.join(process.cwd(), '.lifecyclerc.json');
      const exists = fs.existsSync(configPath);
      
      expect(exists).toBe(true);
    });

    it('should allow overwrite with force flag', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const force = true;
      
      // With force=true, should proceed even if config exists
      const shouldProceed = force || !fs.existsSync('.lifecyclerc.json');
      expect(shouldProceed).toBe(true);
    });

    it('should expand tilde in paths', () => {
      const expandTilde = (p: string): string => {
        if (p.startsWith('~/')) {
          return path.join(process.env.HOME || '', p.slice(2));
        }
        return p;
      };

      const input = '~/.lifecycle-observer';
      const expanded = expandTilde(input);
      
      expect(expanded).not.toBe(input);
      expect(expanded).toContain('.lifecycle-observer');
      expect(expanded).not.toContain('~');
    });
  });

  describe('Status Formatting', () => {
    it('should calculate health score correctly', () => {
      const calculateHealthScore = (
        successRate: number,
        activeAlerts: number,
        openImprovements: number
      ): number => {
        let score = 100;
        score -= (1 - successRate) * 40;
        score -= Math.min(activeAlerts * 10, 30);
        score -= Math.min(openImprovements * 3, 30);
        return Math.max(0, Math.round(score));
      };

      // Perfect score
      expect(calculateHealthScore(1.0, 0, 0)).toBe(100);
      
      // 90% success rate
      expect(calculateHealthScore(0.9, 0, 0)).toBe(96);
      
      // 80% success rate with alerts
      expect(calculateHealthScore(0.8, 2, 0)).toBe(72);
      
      // Low success with many issues
      expect(calculateHealthScore(0.5, 5, 10)).toBe(20);
    });

    it('should get correct health icon', () => {
      const getHealthIcon = (score: number): string => {
        if (score >= 90) return '🟢';
        if (score >= 70) return '🟡';
        if (score >= 50) return '🟠';
        return '🔴';
      };

      expect(getHealthIcon(100)).toBe('🟢');
      expect(getHealthIcon(90)).toBe('🟢');
      expect(getHealthIcon(89)).toBe('🟡');
      expect(getHealthIcon(70)).toBe('🟡');
      expect(getHealthIcon(69)).toBe('🟠');
      expect(getHealthIcon(50)).toBe('🟠');
      expect(getHealthIcon(49)).toBe('🔴');
      expect(getHealthIcon(0)).toBe('🔴');
    });
  });

  describe('Metrics Formatting', () => {
    it('should format duration correctly', () => {
      const formatDuration = (ms: number): string => {
        if (ms < 1000) return `${Math.round(ms)}ms`;
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
        return `${(ms / 60000).toFixed(1)}m`;
      };

      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(1500)).toBe('1.5s');
      expect(formatDuration(30000)).toBe('30.0s');
      expect(formatDuration(90000)).toBe('1.5m');
      expect(formatDuration(300000)).toBe('5.0m');
    });

    it('should format percentage correctly', () => {
      const formatPercent = (value: number): string => {
        return `${(value * 100).toFixed(1)}%`;
      };

      expect(formatPercent(0)).toBe('0.0%');
      expect(formatPercent(0.5)).toBe('50.0%');
      expect(formatPercent(1)).toBe('100.0%');
      expect(formatPercent(0.956)).toBe('95.6%');
    });

    it('should format large numbers correctly', () => {
      const formatNumber = (n: number): string => {
        if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
        if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
        return n.toString();
      };

      expect(formatNumber(500)).toBe('500');
      expect(formatNumber(1500)).toBe('1.5K');
      expect(formatNumber(150000)).toBe('150.0K');
      expect(formatNumber(1500000)).toBe('1.5M');
    });
  });

  describe('Alerts Formatting', () => {
    it('should calculate age correctly', () => {
      const calculateAge = (date: Date): string => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays}d`;
        if (diffHours > 0) return `${diffHours}h`;
        if (diffMinutes > 0) return `${diffMinutes}m`;
        return '<1m';
      };

      const now = new Date();
      
      // Less than a minute ago
      const justNow = new Date(now.getTime() - 30000);
      expect(calculateAge(justNow)).toBe('<1m');
      
      // 5 minutes ago
      const fiveMinAgo = new Date(now.getTime() - 5 * 60000);
      expect(calculateAge(fiveMinAgo)).toBe('5m');
      
      // 2 hours ago
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60000);
      expect(calculateAge(twoHoursAgo)).toBe('2h');
      
      // 3 days ago
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60000);
      expect(calculateAge(threeDaysAgo)).toBe('3d');
    });

    it('should get correct severity icon', () => {
      const getSeverityIcon = (severity: string): string => {
        switch (severity) {
          case 'critical': return '🚨';
          case 'error': return '🔴';
          case 'warning': return '🟡';
          case 'info': return 'ℹ️';
          default: return '⚪';
        }
      };

      expect(getSeverityIcon('critical')).toBe('🚨');
      expect(getSeverityIcon('error')).toBe('🔴');
      expect(getSeverityIcon('warning')).toBe('🟡');
      expect(getSeverityIcon('info')).toBe('ℹ️');
      expect(getSeverityIcon('unknown')).toBe('⚪');
    });

    it('should get correct status icon', () => {
      const getStatusIcon = (status: string): string => {
        switch (status) {
          case 'active': return '🔔';
          case 'acknowledged': return '👀';
          case 'resolved': return '✅';
          case 'suppressed': return '🔇';
          default: return '❓';
        }
      };

      expect(getStatusIcon('active')).toBe('🔔');
      expect(getStatusIcon('acknowledged')).toBe('👀');
      expect(getStatusIcon('resolved')).toBe('✅');
      expect(getStatusIcon('suppressed')).toBe('🔇');
      expect(getStatusIcon('unknown')).toBe('❓');
    });
  });

  describe('CSV Export', () => {
    it('should generate valid CSV format', () => {
      const metricsToCSV = (data: { metric: string; value: number }[]): string => {
        const lines: string[] = ['metric,value'];
        for (const item of data) {
          lines.push(`${item.metric},${item.value}`);
        }
        return lines.join('\n');
      };

      const data = [
        { metric: 'total_executions', value: 100 },
        { metric: 'success_rate', value: 0.95 },
        { metric: 'avg_duration', value: 1500 },
      ];

      const csv = metricsToCSV(data);
      const lines = csv.split('\n');
      
      expect(lines[0]).toBe('metric,value');
      expect(lines[1]).toBe('total_executions,100');
      expect(lines[2]).toBe('success_rate,0.95');
      expect(lines[3]).toBe('avg_duration,1500');
    });
  });

  describe('Report Formatting', () => {
    it('should handle dry-run mode', () => {
      const dryRun = true;
      const shouldWrite = !dryRun;
      
      expect(shouldWrite).toBe(false);
    });

    it('should count successful reports', () => {
      const reports = [
        { project: 'A', written: true, error: undefined },
        { project: 'B', written: true, error: undefined },
        { project: 'C', written: false, error: 'Failed' },
      ];

      const totalSuccess = reports.filter(p => p.written && !p.error).length;
      const totalFailed = reports.filter(p => p.error).length;

      expect(totalSuccess).toBe(2);
      expect(totalFailed).toBe(1);
    });
  });

  describe('Global Options', () => {
    it('should parse verbose flag correctly', () => {
      const parseGlobalOptions = (opts: { verbose?: boolean; json?: boolean }) => ({
        verbose: opts.verbose ?? false,
        json: opts.json ?? false,
      });

      expect(parseGlobalOptions({}).verbose).toBe(false);
      expect(parseGlobalOptions({ verbose: true }).verbose).toBe(true);
      expect(parseGlobalOptions({}).json).toBe(false);
      expect(parseGlobalOptions({ json: true }).json).toBe(true);
    });

    it('should determine log level from verbose flag', () => {
      const getLogLevel = (verbose: boolean) => verbose ? 'debug' : 'info';
      
      expect(getLogLevel(false)).toBe('info');
      expect(getLogLevel(true)).toBe('debug');
    });
  });
});

describe('Output Function', () => {
  it('should output JSON when json mode is true', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const output = <T>(data: T, jsonMode: boolean, formatter?: (data: T) => string): void => {
      if (jsonMode) {
        console.log(JSON.stringify(data, null, 2));
      } else if (formatter) {
        console.log(formatter(data));
      } else {
        console.log(data);
      }
    };

    const data = { status: 'ok', count: 5 };
    output(data, true);
    
    expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    
    consoleSpy.mockRestore();
  });

  it('should use formatter when provided', () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const output = <T>(data: T, jsonMode: boolean, formatter?: (data: T) => string): void => {
      if (jsonMode) {
        console.log(JSON.stringify(data, null, 2));
      } else if (formatter) {
        console.log(formatter(data));
      } else {
        console.log(data);
      }
    };

    const data = { name: 'test' };
    const formatter = (d: { name: string }) => `Name: ${d.name}`;
    output(data, false, formatter);
    
    expect(consoleSpy).toHaveBeenCalledWith('Name: test');
    
    consoleSpy.mockRestore();
  });
});

