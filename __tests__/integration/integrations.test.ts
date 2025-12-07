/**
 * Integration Tests for Tool Integrations
 * 
 * Tests the integration helpers for each lifecycle tool.
 * Uses enabled: false to bypass actual execution tracking.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createPRDevIntegration,
  createFeatureBuilderIntegration,
  createTestGeneratorIntegration,
  createDocsGeneratorIntegration,
  createSQLDevIntegration,
  type PRReviewResult,
  type FeatureImplementResult,
  type TestGenerateResult,
  type DocsGenerateResult,
  type SQLDevGenerateResult,
} from '../../src/integrations/index.js';

describe('AI-PR-Dev Integration', () => {
  it('should wrap a review function', async () => {
    const mockReview = vi.fn(async (): Promise<PRReviewResult> => ({
      success: true,
      filesReviewed: 5,
      commentsAdded: 3,
      tokensUsed: 1500,
      prNumber: 42,
    }));

    const wrapped = createPRDevIntegration('review', mockReview, { enabled: false });
    const result = await wrapped();

    expect(mockReview).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.filesReviewed).toBe(5);
    expect(result.commentsAdded).toBe(3);
  });

  it('should pass arguments through to the wrapped function', async () => {
    const mockReview = vi.fn(async (event: { prNumber: number }): Promise<PRReviewResult> => ({
      success: true,
      prNumber: event.prNumber,
    }));

    const wrapped = createPRDevIntegration('review', mockReview, { enabled: false });
    const result = await wrapped({ prNumber: 123 });

    expect(mockReview).toHaveBeenCalledWith({ prNumber: 123 });
    expect(result.prNumber).toBe(123);
  });

  it('should propagate errors', async () => {
    const mockReview = vi.fn(async (): Promise<PRReviewResult> => {
      throw new Error('Review failed');
    });

    const wrapped = createPRDevIntegration('review', mockReview, { enabled: false });
    
    await expect(wrapped()).rejects.toThrow('Review failed');
  });
});

describe('AI-Feature-Builder Integration', () => {
  it('should wrap an implement function', async () => {
    const mockImplement = vi.fn(async (): Promise<FeatureImplementResult> => ({
      success: true,
      filesCreated: 3,
      filesModified: 2,
      testsGenerated: 5,
      linesAdded: 250,
    }));

    const wrapped = createFeatureBuilderIntegration('implement', mockImplement, { enabled: false });
    const result = await wrapped();

    expect(mockImplement).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.filesCreated).toBe(3);
    expect(result.testsGenerated).toBe(5);
  });

  it('should handle options', async () => {
    const mockImplement = vi.fn(async (opts: { feature: string }): Promise<FeatureImplementResult> => ({
      success: true,
      featureName: opts.feature,
    }));

    const wrapped = createFeatureBuilderIntegration('implement', mockImplement, {
      enabled: false,
      metrics: ['filesCreated', 'linesAdded'],
    });
    
    const result = await wrapped({ feature: 'auth' });
    expect(result.featureName).toBe('auth');
  });
});

describe('AI-Test-Generator Integration', () => {
  it('should wrap a generate function', async () => {
    const mockGenerate = vi.fn(async (): Promise<TestGenerateResult> => ({
      success: true,
      testsGenerated: 10,
      testFilesCreated: 2,
      coverageIncrease: 0.15,
      todosAdded: 3,
    }));

    const wrapped = createTestGeneratorIntegration('generate', mockGenerate, { enabled: false });
    const result = await wrapped();

    expect(mockGenerate).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.testsGenerated).toBe(10);
    expect(result.coverageIncrease).toBe(0.15);
  });

  it('should handle target paths', async () => {
    const mockGenerate = vi.fn(async (opts: { target: string }): Promise<TestGenerateResult> => ({
      success: true,
      testsGenerated: 5,
      targetPath: opts.target,
    }));

    const wrapped = createTestGeneratorIntegration('generate', mockGenerate, { enabled: false });
    const result = await wrapped({ target: 'src/utils' });

    expect(result.targetPath).toBe('src/utils');
  });
});

describe('AI-Docs-Generator Integration', () => {
  it('should wrap a generate function', async () => {
    const mockGenerate = vi.fn(async (): Promise<DocsGenerateResult> => ({
      success: true,
      docsUpdated: 5,
      jsdocsAdded: 25,
      sectionsGenerated: 8,
      readmesUpdated: 1,
    }));

    const wrapped = createDocsGeneratorIntegration('generate', mockGenerate, { enabled: false });
    const result = await wrapped();

    expect(mockGenerate).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.docsUpdated).toBe(5);
    expect(result.jsdocsAdded).toBe(25);
  });

  it('should handle different commands', async () => {
    const mockJsdoc = vi.fn(async (): Promise<DocsGenerateResult> => ({
      success: true,
      jsdocsAdded: 50,
    }));

    const wrapped = createDocsGeneratorIntegration('jsdoc', mockJsdoc, { enabled: false });
    const result = await wrapped();

    expect(result.jsdocsAdded).toBe(50);
  });
});

describe('AI-SQL-Dev Integration', () => {
  it('should wrap a generate function', async () => {
    const mockGenerate = vi.fn(async (): Promise<SQLDevGenerateResult> => ({
      success: true,
      policiesGenerated: 12,
      tablesAnalyzed: 8,
      migrationsCreated: 2,
      securityRulesAdded: 15,
    }));

    const wrapped = createSQLDevIntegration('generate', mockGenerate, { enabled: false });
    const result = await wrapped();

    expect(mockGenerate).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.policiesGenerated).toBe(12);
    expect(result.tablesAnalyzed).toBe(8);
  });

  it('should handle schema options', async () => {
    const mockGenerate = vi.fn(async (opts: { schema: string }): Promise<SQLDevGenerateResult> => ({
      success: true,
      targetSchema: opts.schema,
    }));

    const wrapped = createSQLDevIntegration('generate', mockGenerate, { enabled: false });
    const result = await wrapped({ schema: 'public' });

    expect(result.targetSchema).toBe('public');
  });
});

describe('Integration with custom options', () => {
  it('should respect enabled option', async () => {
    const mockFn = vi.fn(async (): Promise<PRReviewResult> => ({
      success: true,
    }));

    const wrapped = createPRDevIntegration('review', mockFn, {
      enabled: false,
    });

    const result = await wrapped();
    expect(result.success).toBe(true);
    expect(mockFn).toHaveBeenCalled();
  });

  it('should allow custom metrics selection', async () => {
    const mockFn = vi.fn(async (): Promise<PRReviewResult> => ({
      success: true,
      filesReviewed: 10,
      tokensUsed: 500,
    }));

    const wrapped = createPRDevIntegration('review', mockFn, {
      enabled: false,
      metrics: ['filesReviewed'], // Only capture filesReviewed
    });

    const result = await wrapped();
    expect(result.filesReviewed).toBe(10);
    expect(result.tokensUsed).toBe(500);
  });
});

describe('Error handling', () => {
  it('should propagate async errors', async () => {
    const mockFn = vi.fn(async (): Promise<PRReviewResult> => {
      throw new Error('API rate limited');
    });

    const wrapped = createPRDevIntegration('review', mockFn, { enabled: false });
    
    await expect(wrapped()).rejects.toThrow('API rate limited');
  });

  it('should handle sync errors in async function', async () => {
    const mockFn = vi.fn(async (): Promise<PRReviewResult> => {
      JSON.parse('invalid json'); // This will throw
      return { success: true };
    });

    const wrapped = createPRDevIntegration('review', mockFn, { enabled: false });
    
    await expect(wrapped()).rejects.toThrow();
  });
});
