/**
 * Unit tests for collectors
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createExecutionCollector,
  createErrorCollector,
  type ExecutionHandle,
} from '../../src/collectors/index.js';
import { initDatabase, closeDatabase, getExecutions } from '../../src/database/index.js';
import path from 'path';
import { tmpdir } from 'os';
import { mkdtempSync, rmSync } from 'fs';

describe('ExecutionCollector', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create temp directory for test database
    tempDir = mkdtempSync(path.join(tmpdir(), 'lifecycle-test-'));
    const dbPath = path.join(tempDir, 'test.db');
    initDatabase({ path: dbPath, migrate: true });
  });

  afterEach(() => {
    closeDatabase();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('startExecution', () => {
    it('should create an execution handle', async () => {
      const collector = createExecutionCollector();
      const handle = await collector.startExecution('ai-test-generator', 'generate', {
        project: 'test-project',
        projectPath: tempDir,
        skipGitContext: true,
      });

      expect(handle).toBeDefined();
      expect(handle.id).toMatch(/^exec-/);
      expect(handle.tool).toBe('ai-test-generator');
      expect(handle.command).toBe('generate');
      expect(handle.project).toBe('test-project');
    });
  });

  describe('endExecution', () => {
    it('should record successful execution', async () => {
      const collector = createExecutionCollector();
      const handle = await collector.startExecution('ai-pr-dev', 'review', {
        project: 'my-project',
        projectPath: tempDir,
        skipGitContext: true,
      });

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));

      const record = collector.succeedExecution(handle);

      expect(record).toBeDefined();
      expect(record.id).toBeDefined();
      expect(record.status).toBe('success');
      expect(record.tool).toBe('ai-pr-dev');
      expect(record.command).toBe('review');
      expect(record.duration).toBeGreaterThanOrEqual(10);
    });

    it('should record failed execution with error details', async () => {
      const collector = createExecutionCollector();
      const handle = await collector.startExecution('ai-docs-generator', 'generate', {
        project: 'my-project',
        projectPath: tempDir,
        skipGitContext: true,
      });

      const testError = new Error('API rate limit exceeded');
      const record = collector.failExecution(handle, testError);

      expect(record.status).toBe('failure');
      expect(record.errorType).toBe('api_rate_limit');
      expect(record.errorMessage).toBe('API rate limit exceeded');
    });
  });

  describe('recordMetric', () => {
    it('should record metrics during execution', async () => {
      const collector = createExecutionCollector();
      const handle = await collector.startExecution('ai-test-generator', 'generate', {
        project: 'my-project',
        projectPath: tempDir,
        skipGitContext: true,
      });

      collector.recordMetric(handle, 'testsGenerated', 5);
      collector.recordMetric(handle, 'coverage', '85%');

      const record = collector.succeedExecution(handle);

      expect(record.metadata).toBeDefined();
      expect((record.metadata as Record<string, unknown>).metrics).toEqual({
        testsGenerated: 5,
        coverage: '85%',
      });
    });
  });
});

describe('ErrorCollector', () => {
  describe('categorizeError', () => {
    it('should categorize API key errors', () => {
      const collector = createErrorCollector();

      expect(collector.categorizeError(new Error('Missing API_KEY'))).toBe('api_key_missing');
      expect(collector.categorizeError(new Error('ANTHROPIC_API_KEY not set'))).toBe('api_key_missing');
    });

    it('should categorize rate limit errors', () => {
      const collector = createErrorCollector();

      expect(collector.categorizeError(new Error('Rate limit exceeded'))).toBe('api_rate_limit');
      expect(collector.categorizeError(new Error('429 Too Many Requests'))).toBe('api_rate_limit');
    });

    it('should categorize network errors', () => {
      const collector = createErrorCollector();

      expect(collector.categorizeError(new Error('ECONNREFUSED'))).toBe('network_error');
      expect(collector.categorizeError(new Error('fetch failed'))).toBe('network_error');
    });

    it('should categorize git errors', () => {
      const collector = createErrorCollector();

      expect(collector.categorizeError(new Error('fatal: not a git repository'))).toBe('git_error');
      expect(collector.categorizeError(new Error('Git push failed'))).toBe('git_error');
    });

    it('should categorize file not found errors', () => {
      const collector = createErrorCollector();

      expect(collector.categorizeError(new Error('ENOENT: no such file'))).toBe('file_not_found');
      expect(collector.categorizeError(new Error('File does not exist'))).toBe('file_not_found');
    });

    it('should categorize permission errors', () => {
      const collector = createErrorCollector();

      expect(collector.categorizeError(new Error('EPERM: operation not permitted'))).toBe('permission_denied');
      expect(collector.categorizeError(new Error('Permission denied'))).toBe('permission_denied');
    });

    it('should categorize timeout errors', () => {
      const collector = createErrorCollector();

      expect(collector.categorizeError(new Error('Request timeout'))).toBe('timeout');
      expect(collector.categorizeError(new Error('Operation timed out'))).toBe('timeout');
    });

    it('should return unknown for unrecognized errors', () => {
      const collector = createErrorCollector();

      expect(collector.categorizeError(new Error('Something went wrong'))).toBe('unknown');
      expect(collector.categorizeError('not an error object')).toBe('unknown');
    });
  });
});

