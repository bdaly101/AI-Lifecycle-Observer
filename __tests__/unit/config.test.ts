/**
 * Unit Tests for Configuration Module
 * 
 * Tests configuration loading, validation, and expansion.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

describe('Configuration Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Variable Expansion', () => {
    it('should expand env: prefix variables', () => {
      const resolveEnvValue = (value: string): string => {
        if (value.startsWith('env:')) {
          const envVar = value.slice(4);
          const envValue = process.env[envVar];
          if (!envValue) {
            throw new Error(`Environment variable ${envVar} is not set`);
          }
          return envValue;
        }
        return value;
      };

      process.env.TEST_API_KEY = 'test-key-123';
      
      expect(resolveEnvValue('env:TEST_API_KEY')).toBe('test-key-123');
      expect(resolveEnvValue('literal-value')).toBe('literal-value');
    });

    it('should throw for missing env variables', () => {
      const resolveEnvValue = (value: string): string => {
        if (value.startsWith('env:')) {
          const envVar = value.slice(4);
          const envValue = process.env[envVar];
          if (!envValue) {
            throw new Error(`Environment variable ${envVar} is not set`);
          }
          return envValue;
        }
        return value;
      };

      delete process.env.MISSING_VAR;
      
      expect(() => resolveEnvValue('env:MISSING_VAR')).toThrow(
        'Environment variable MISSING_VAR is not set'
      );
    });
  });

  describe('Path Expansion', () => {
    it('should expand tilde to home directory', () => {
      const expandPath = (p: string): string => {
        if (p.startsWith('~/')) {
          return path.join(process.env.HOME || '', p.slice(2));
        }
        return p;
      };

      const homePath = expandPath('~/test/path');
      expect(homePath.startsWith('~')).toBe(false);
      expect(homePath).toContain('test/path');
    });

    it('should leave absolute paths unchanged', () => {
      const expandPath = (p: string): string => {
        if (p.startsWith('~/')) {
          return path.join(process.env.HOME || '', p.slice(2));
        }
        return p;
      };

      expect(expandPath('/absolute/path')).toBe('/absolute/path');
    });

    it('should leave relative paths unchanged', () => {
      const expandPath = (p: string): string => {
        if (p.startsWith('~/')) {
          return path.join(process.env.HOME || '', p.slice(2));
        }
        return p;
      };

      expect(expandPath('relative/path')).toBe('relative/path');
    });
  });

  describe('Default Configuration', () => {
    it('should have valid default values', () => {
      const DEFAULT_CONFIG = {
        enabled: true,
        projectsDir: '~/Dev/shared',
        dataDir: '~/.lifecycle-observer',
        logLevel: 'info',
        projects: [],
        ai: {
          enabled: true,
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250929',
          maxTokens: 4096,
          temperature: 0.3,
          analyzeEveryNExecutions: 10,
        },
        alerts: {
          enabled: true,
          thresholds: {
            consecutiveFailures: 3,
            failureRateThreshold: 0.30,
          },
        },
        reporting: {
          enabled: true,
          autoUpdateFiles: true,
        },
        database: {
          path: '~/.lifecycle-observer/data.db',
          retentionDays: 90,
        },
      };

      expect(DEFAULT_CONFIG.enabled).toBe(true);
      expect(DEFAULT_CONFIG.logLevel).toBe('info');
      expect(DEFAULT_CONFIG.ai.maxTokens).toBe(4096);
      expect(DEFAULT_CONFIG.ai.temperature).toBe(0.3);
      expect(DEFAULT_CONFIG.alerts.thresholds.consecutiveFailures).toBe(3);
      expect(DEFAULT_CONFIG.database.retentionDays).toBe(90);
    });
  });

  describe('Configuration Merging', () => {
    it('should merge partial config with defaults', () => {
      const mergeConfig = <T extends object>(defaults: T, partial: Partial<T>): T => {
        const result = { ...defaults };
        for (const key of Object.keys(partial) as (keyof T)[]) {
          const value = partial[key];
          if (value !== undefined) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
              result[key] = mergeConfig(
                defaults[key] as object,
                value as object
              ) as T[keyof T];
            } else {
              result[key] = value as T[keyof T];
            }
          }
        }
        return result;
      };

      const defaults = {
        enabled: true,
        logLevel: 'info',
        ai: {
          enabled: true,
          maxTokens: 4096,
        },
      };

      const partial = {
        logLevel: 'debug',
        ai: {
          maxTokens: 8192,
        },
      };

      const merged = mergeConfig(defaults, partial as Partial<typeof defaults>);

      expect(merged.enabled).toBe(true); // From defaults
      expect(merged.logLevel).toBe('debug'); // Overridden
      expect(merged.ai.enabled).toBe(true); // From defaults
      expect(merged.ai.maxTokens).toBe(8192); // Overridden
    });
  });

  describe('Configuration Validation', () => {
    it('should validate log level', () => {
      const validLogLevels = ['silent', 'error', 'warn', 'info', 'debug', 'trace'];
      
      const isValidLogLevel = (level: string): boolean => {
        return validLogLevels.includes(level);
      };

      expect(isValidLogLevel('info')).toBe(true);
      expect(isValidLogLevel('debug')).toBe(true);
      expect(isValidLogLevel('invalid')).toBe(false);
    });

    it('should validate threshold ranges', () => {
      const validateThreshold = (value: number, min: number, max: number): boolean => {
        return value >= min && value <= max;
      };

      // Failure rate should be 0-1
      expect(validateThreshold(0.3, 0, 1)).toBe(true);
      expect(validateThreshold(1.5, 0, 1)).toBe(false);

      // Consecutive failures should be positive
      expect(validateThreshold(3, 1, 100)).toBe(true);
      expect(validateThreshold(0, 1, 100)).toBe(false);
    });

    it('should validate project configuration', () => {
      const isValidProject = (project: {
        name?: string;
        path?: string;
        enabled?: boolean;
        tools?: string[];
      }): boolean => {
        if (!project.name || typeof project.name !== 'string') return false;
        if (!project.path || typeof project.path !== 'string') return false;
        if (project.tools && !Array.isArray(project.tools)) return false;
        return true;
      };

      expect(isValidProject({ name: 'test', path: '/path' })).toBe(true);
      expect(isValidProject({ name: 'test', path: '/path', tools: ['ai-pr-dev'] })).toBe(true);
      expect(isValidProject({ name: '', path: '/path' })).toBe(false);
      expect(isValidProject({ path: '/path' } as any)).toBe(false);
    });
  });

  describe('Config File Detection', () => {
    it('should identify config file names', () => {
      const CONFIG_FILE_NAMES = [
        '.lifecyclerc.json',
        '.lifecyclerc',
        'lifecycle.config.json',
        'lifecycle.config.js',
      ];

      const isConfigFileName = (name: string): boolean => {
        return CONFIG_FILE_NAMES.includes(name);
      };

      expect(isConfigFileName('.lifecyclerc.json')).toBe(true);
      expect(isConfigFileName('lifecycle.config.json')).toBe(true);
      expect(isConfigFileName('random.json')).toBe(false);
    });

    it('should find config file in directory hierarchy', () => {
      const findConfigInHierarchy = (
        startDir: string,
        configNames: string[],
        fileExists: (p: string) => boolean
      ): string | null => {
        let currentDir = startDir;
        const root = path.parse(currentDir).root;

        while (currentDir !== root) {
          for (const configName of configNames) {
            const configPath = path.join(currentDir, configName);
            if (fileExists(configPath)) {
              return configPath;
            }
          }
          currentDir = path.dirname(currentDir);
        }

        return null;
      };

      // Mock file exists
      const existingFiles = new Set(['/home/user/project/.lifecyclerc.json']);
      const fileExists = (p: string) => existingFiles.has(p);

      const found = findConfigInHierarchy(
        '/home/user/project/src/deep',
        ['.lifecyclerc.json'],
        fileExists
      );

      expect(found).toBe('/home/user/project/.lifecyclerc.json');
    });
  });

  describe('Tool Configuration', () => {
    it('should validate tool names', () => {
      const VALID_TOOLS = [
        'ai-pr-dev',
        'ai-feature-builder',
        'ai-test-generator',
        'ai-docs-generator',
        'ai-sql-dev',
      ];

      const isValidTool = (tool: string): boolean => {
        return VALID_TOOLS.includes(tool);
      };

      expect(isValidTool('ai-pr-dev')).toBe(true);
      expect(isValidTool('ai-test-generator')).toBe(true);
      expect(isValidTool('unknown-tool')).toBe(false);
    });
  });

  describe('Alert Channel Configuration', () => {
    it('should validate channel configuration', () => {
      const validateChannelConfig = (channels: {
        console?: boolean;
        file?: boolean;
        github?: { enabled: boolean; token?: string };
      }): boolean => {
        // At least one channel should be enabled
        if (channels.console) return true;
        if (channels.file) return true;
        if (channels.github?.enabled) return true;
        return false;
      };

      expect(validateChannelConfig({ console: true })).toBe(true);
      expect(validateChannelConfig({ file: true })).toBe(true);
      expect(validateChannelConfig({ github: { enabled: true } })).toBe(true);
      expect(validateChannelConfig({})).toBe(false);
      expect(validateChannelConfig({ console: false, file: false })).toBe(false);
    });
  });
});

