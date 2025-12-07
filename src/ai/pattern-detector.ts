/**
 * AI Pattern Detector - AI-powered improvement detection
 */

import { ClaudeClient, getClaudeClient } from './claude-client.js';
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildAnalysisPrompt,
  generateExecutionSummary,
  formatExecutionForAI,
  generateErrorSummary,
  generateToolStats,
  formatOpenImprovements,
} from './analysis-prompts.js';
import {
  getExecutions,
  getOpenImprovements,
  insertImprovement,
} from '../database/index.js';
import { getLogger } from '../utils/logger.js';
import { daysAgo } from '../utils/time.js';
import type {
  ExecutionRecord,
  ImprovementSuggestion,
  ImprovementType,
  ImprovementSeverity,
  ImprovementScope,
  EstimationLevel,
  LifecycleTool,
  CreateImprovementData,
} from '../types/index.js';

/**
 * AI-generated improvement suggestion
 */
interface AIImprovementSuggestion {
  type: string;
  severity: string;
  scope: string;
  title: string;
  description: string;
  suggestedAction: string;
  affectedTools: string[];
  estimatedImpact: string;
  estimatedEffort: string;
  tags: string[];
}

/**
 * AI analysis response
 */
interface AIAnalysisResponse {
  improvements: AIImprovementSuggestion[];
  summary: string;
}

/**
 * Options for AI analysis
 */
export interface AIAnalysisOptions {
  /** Period to analyze (default: 7 days) */
  periodDays?: number;
  /** Maximum executions to include (default: 50) */
  maxExecutions?: number;
  /** Specific tools to analyze */
  tools?: LifecycleTool[];
  /** Specific projects to analyze */
  projects?: string[];
  /** Dry run - don't persist improvements */
  dryRun?: boolean;
}

/**
 * Result of AI analysis
 */
export interface AIAnalysisResult {
  /** When analysis was run */
  timestamp: Date;
  /** Whether AI was available */
  aiAvailable: boolean;
  /** Summary from AI */
  summary?: string;
  /** Improvements detected */
  improvements: ImprovementSuggestion[];
  /** Tokens used */
  tokensUsed?: {
    input: number;
    output: number;
  };
  /** Error if analysis failed */
  error?: string;
}

/**
 * Valid improvement types
 */
const VALID_TYPES: ImprovementType[] = [
  'performance',
  'reliability',
  'usability',
  'security',
  'feature',
  'documentation',
  'integration',
];

/**
 * Valid severity levels
 */
const VALID_SEVERITIES: ImprovementSeverity[] = ['low', 'medium', 'high', 'urgent'];

/**
 * Valid scopes
 */
const VALID_SCOPES: ImprovementScope[] = ['tool', 'lifecycle', 'both'];

/**
 * Valid estimation levels
 */
const VALID_ESTIMATIONS: EstimationLevel[] = ['low', 'medium', 'high'];

/**
 * Valid tool names
 */
const VALID_TOOLS: LifecycleTool[] = [
  'ai-pr-dev',
  'ai-feature-builder',
  'ai-test-generator',
  'ai-docs-generator',
  'ai-sql-dev',
];

/**
 * AI Pattern Detector class
 */
export class AIPatternDetector {
  private client: ClaudeClient;
  private logger = getLogger();

  constructor(client?: ClaudeClient) {
    this.client = client ?? getClaudeClient();
  }

  /**
   * Run AI-powered analysis
   */
  async analyze(options?: AIAnalysisOptions): Promise<AIAnalysisResult> {
    const periodDays = options?.periodDays ?? 7;
    const maxExecutions = options?.maxExecutions ?? 50;

    // Check if AI is available
    if (!this.client.isAvailable()) {
      this.logger.warn('AI client not available - skipping AI analysis');
      return {
        timestamp: new Date(),
        aiAvailable: false,
        improvements: [],
        error: 'ANTHROPIC_API_KEY not set',
      };
    }

    try {
      // Gather data for analysis
      const since = daysAgo(periodDays);
      const executions = getExecutions({
        since,
        tools: options?.tools,
        projects: options?.projects,
        limit: maxExecutions,
      });

      if (executions.length === 0) {
        return {
          timestamp: new Date(),
          aiAvailable: true,
          summary: 'No executions found in the analysis period.',
          improvements: [],
        };
      }

      // Build prompt
      const prompt = this.buildPrompt(executions, periodDays);

      // Make AI request
      this.logger.info({ executionCount: executions.length }, 'Running AI analysis');
      
      const response = await this.client.requestJson<AIAnalysisResponse>({
        systemPrompt: ANALYSIS_SYSTEM_PROMPT,
        userMessage: prompt,
        maxTokens: 4096,
        temperature: 0.3,
      });

      // Parse and validate improvements
      const improvements: ImprovementSuggestion[] = [];
      for (const aiImprovement of response.improvements) {
        const validated = this.validateAndConvert(aiImprovement);
        if (validated) {
          if (!options?.dryRun) {
            const saved = insertImprovement(validated);
            improvements.push(saved);
            this.logger.info(
              { improvementId: saved.id, title: saved.title },
              'Created AI-detected improvement'
            );
          } else {
            // For dry run, create a mock improvement
            improvements.push({
              id: `dry-run-${Date.now()}`,
              ...validated,
              detectedAt: new Date(),
              status: 'open',
            } as ImprovementSuggestion);
          }
        }
      }

      return {
        timestamp: new Date(),
        aiAvailable: true,
        summary: response.summary,
        improvements,
        tokensUsed: {
          input: response._meta.inputTokens,
          output: response._meta.outputTokens,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error({ error: errorMessage }, 'AI analysis failed');
      return {
        timestamp: new Date(),
        aiAvailable: true,
        improvements: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Build the analysis prompt from execution data
   */
  private buildPrompt(executions: ExecutionRecord[], periodDays: number): string {
    // Calculate stats
    const successful = executions.filter((e) => e.status === 'success').length;
    const failed = executions.filter((e) => e.status === 'failure').length;
    const avgDuration = executions.reduce((sum, e) => sum + e.duration, 0) / executions.length;

    // Error counts
    const errorCounts: Record<string, number> = {};
    for (const exec of executions) {
      if (exec.errorType) {
        errorCounts[exec.errorType] = (errorCounts[exec.errorType] ?? 0) + 1;
      }
    }

    // Tool stats
    const toolStatsMap = new Map<string, { executions: number; successes: number; totalDuration: number }>();
    for (const exec of executions) {
      const current = toolStatsMap.get(exec.tool) ?? { executions: 0, successes: 0, totalDuration: 0 };
      current.executions++;
      if (exec.status === 'success') current.successes++;
      current.totalDuration += exec.duration;
      toolStatsMap.set(exec.tool, current);
    }

    const toolStats = Array.from(toolStatsMap.entries()).map(([tool, stats]) => ({
      tool,
      executions: stats.executions,
      successRate: stats.executions > 0 ? stats.successes / stats.executions : 0,
      avgDuration: stats.executions > 0 ? stats.totalDuration / stats.executions : 0,
    }));

    // Get open improvements
    const openImprovements = getOpenImprovements().slice(0, 10);

    // Format recent executions (limit to most recent 20 for prompt size)
    const recentFormatted = executions
      .slice(0, 20)
      .map(formatExecutionForAI)
      .join('\n\n');

    return buildAnalysisPrompt({
      executionSummary: generateExecutionSummary({
        total: executions.length,
        successful,
        failed,
        avgDuration,
        period: `Last ${periodDays} days`,
      }),
      executionCount: executions.length,
      recentExecutions: recentFormatted,
      errorSummary: generateErrorSummary(errorCounts),
      toolStats: generateToolStats(toolStats),
      openImprovements: formatOpenImprovements(openImprovements),
    });
  }

  /**
   * Validate and convert AI suggestion to improvement data
   */
  private validateAndConvert(
    aiSuggestion: AIImprovementSuggestion
  ): CreateImprovementData | null {
    try {
      // Validate and normalize type
      const type = this.normalizeType(aiSuggestion.type);
      if (!type) {
        this.logger.warn({ type: aiSuggestion.type }, 'Invalid improvement type from AI');
        return null;
      }

      // Validate and normalize severity
      const severity = this.normalizeSeverity(aiSuggestion.severity);
      if (!severity) {
        this.logger.warn({ severity: aiSuggestion.severity }, 'Invalid severity from AI');
        return null;
      }

      // Validate and normalize scope
      const scope = this.normalizeScope(aiSuggestion.scope);
      if (!scope) {
        this.logger.warn({ scope: aiSuggestion.scope }, 'Invalid scope from AI');
        return null;
      }

      // Validate tools
      const affectedTools = this.normalizeTools(aiSuggestion.affectedTools);

      // Validate estimations
      const estimatedImpact = this.normalizeEstimation(aiSuggestion.estimatedImpact);
      const estimatedEffort = this.normalizeEstimation(aiSuggestion.estimatedEffort);

      return {
        type,
        severity,
        scope,
        title: aiSuggestion.title?.substring(0, 200) ?? 'AI-detected improvement',
        description: aiSuggestion.description ?? '',
        suggestedAction: aiSuggestion.suggestedAction ?? '',
        affectedTools,
        affectedProjects: [], // AI doesn't know specific projects
        detectedBy: 'ai',
        detectionContext: 'AI pattern analysis',
        estimatedImpact,
        estimatedEffort,
        tags: Array.isArray(aiSuggestion.tags)
          ? aiSuggestion.tags.filter((t) => typeof t === 'string').slice(0, 10)
          : [],
      };
    } catch (error) {
      this.logger.warn({ error, aiSuggestion }, 'Failed to convert AI suggestion');
      return null;
    }
  }

  /**
   * Normalize improvement type
   */
  private normalizeType(type: string): ImprovementType | null {
    const normalized = type?.toLowerCase().trim();
    if (VALID_TYPES.includes(normalized as ImprovementType)) {
      return normalized as ImprovementType;
    }
    return null;
  }

  /**
   * Normalize severity
   */
  private normalizeSeverity(severity: string): ImprovementSeverity | null {
    const normalized = severity?.toLowerCase().trim();
    if (VALID_SEVERITIES.includes(normalized as ImprovementSeverity)) {
      return normalized as ImprovementSeverity;
    }
    // Map common variations
    if (normalized === 'critical') return 'urgent';
    return null;
  }

  /**
   * Normalize scope
   */
  private normalizeScope(scope: string): ImprovementScope | null {
    const normalized = scope?.toLowerCase().trim();
    if (VALID_SCOPES.includes(normalized as ImprovementScope)) {
      return normalized as ImprovementScope;
    }
    return 'tool'; // Default to tool
  }

  /**
   * Normalize estimation level
   */
  private normalizeEstimation(level: string): EstimationLevel | undefined {
    const normalized = level?.toLowerCase().trim();
    if (VALID_ESTIMATIONS.includes(normalized as EstimationLevel)) {
      return normalized as EstimationLevel;
    }
    return undefined;
  }

  /**
   * Normalize tool names
   */
  private normalizeTools(tools: string[]): LifecycleTool[] {
    if (!Array.isArray(tools)) return [];
    return tools
      .map((t) => t?.toLowerCase().trim())
      .filter((t): t is LifecycleTool => VALID_TOOLS.includes(t as LifecycleTool));
  }
}

/**
 * Singleton instance
 */
let detectorInstance: AIPatternDetector | null = null;

/**
 * Get the singleton AIPatternDetector instance
 */
export function getAIPatternDetector(): AIPatternDetector {
  if (!detectorInstance) {
    detectorInstance = new AIPatternDetector();
  }
  return detectorInstance;
}

/**
 * Create a new AIPatternDetector instance (for testing)
 */
export function createAIPatternDetector(client?: ClaudeClient): AIPatternDetector {
  return new AIPatternDetector(client);
}

