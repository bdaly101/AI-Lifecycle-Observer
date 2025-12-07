/**
 * Claude AI Client - Wrapper for Anthropic API with retry logic
 */

import Anthropic from '@anthropic-ai/sdk';
import { getLogger } from '../utils/logger.js';

/**
 * Options for AI requests
 */
export interface AIRequestOptions {
  /** System prompt */
  systemPrompt: string;
  /** User message */
  userMessage: string;
  /** Maximum tokens in response */
  maxTokens?: number;
  /** Temperature for response generation */
  temperature?: number;
  /** Model to use */
  model?: string;
}

/**
 * AI response
 */
export interface AIResponse {
  /** Response content */
  content: string;
  /** Model used */
  model: string;
  /** Tokens used in input */
  inputTokens: number;
  /** Tokens used in output */
  outputTokens: number;
  /** Whether this was a cached/retried response */
  fromRetry: boolean;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retries */
  maxRetries: number;
  /** Initial delay in ms */
  initialDelayMs: number;
  /** Maximum delay in ms */
  maxDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Claude AI Client with retry logic
 */
export class ClaudeClient {
  private client: Anthropic | null = null;
  private logger = getLogger();
  private retryConfig: RetryConfig;
  private defaultModel: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;

  constructor(options?: {
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    retryConfig?: Partial<RetryConfig>;
  }) {
    this.defaultModel = options?.model ?? 'claude-sonnet-4-20250514';
    this.defaultMaxTokens = options?.maxTokens ?? 4096;
    this.defaultTemperature = options?.temperature ?? 0.3;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...options?.retryConfig };

    // Try to initialize client
    const apiKey = options?.apiKey ?? process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    }
  }

  /**
   * Check if the client is available
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Ensure client is initialized
   */
  private ensureClient(): Anthropic {
    if (!this.client) {
      throw new Error(
        'ANTHROPIC_API_KEY not set. Set the environment variable or pass apiKey to constructor.'
      );
    }
    return this.client;
  }

  /**
   * Make an AI request with retry logic
   */
  async request(options: AIRequestOptions): Promise<AIResponse> {
    const client = this.ensureClient();
    const model = options.model ?? this.defaultModel;
    const maxTokens = options.maxTokens ?? this.defaultMaxTokens;
    const temperature = options.temperature ?? this.defaultTemperature;

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= this.retryConfig.maxRetries) {
      try {
        this.logger.debug(
          { attempt, model, maxTokens },
          'Making AI request'
        );

        const response = await client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          system: options.systemPrompt,
          messages: [{ role: 'user', content: options.userMessage }],
        });

        // Extract text content
        const textBlock = response.content.find((block) => block.type === 'text');
        const content = textBlock?.type === 'text' ? textBlock.text : '';

        return {
          content,
          model: response.model,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          fromRetry: attempt > 0,
        };
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if retryable
        if (!this.isRetryableError(error)) {
          this.logger.error({ error: lastError, attempt }, 'Non-retryable AI error');
          throw lastError;
        }

        attempt++;
        if (attempt > this.retryConfig.maxRetries) {
          this.logger.error(
            { error: lastError, attempts: attempt },
            'AI request failed after all retries'
          );
          throw lastError;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
          this.retryConfig.maxDelayMs
        );

        this.logger.warn(
          { error: lastError.message, attempt, delayMs: delay },
          'AI request failed, retrying'
        );

        await this.sleep(delay);
      }
    }

    // Should never reach here, but TypeScript needs it
    throw lastError ?? new Error('AI request failed');
  }

  /**
   * Request JSON response
   */
  async requestJson<T>(options: AIRequestOptions): Promise<T & { _meta: AIResponse }> {
    const response = await this.request(options);
    
    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = response.content.match(/```(?:json)?\s*([\s\S]*?)```/) ??
      [null, response.content];
    const jsonStr = jsonMatch[1]?.trim() ?? response.content.trim();

    try {
      const parsed = JSON.parse(jsonStr) as T;
      return {
        ...parsed,
        _meta: response,
      };
    } catch (error) {
      this.logger.error({ error, content: response.content.substring(0, 500) }, 'Failed to parse AI JSON response');
      throw new Error(`Failed to parse AI response as JSON: ${error}`);
    }
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;

    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Rate limit errors
    if (message.includes('rate limit') || message.includes('429')) {
      return true;
    }

    // Server errors
    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return true;
    }

    // Network errors
    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('econnreset') ||
      name.includes('fetch')
    ) {
      return true;
    }

    // Overloaded errors from Anthropic
    if (message.includes('overloaded')) {
      return true;
    }

    return false;
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance
 */
let clientInstance: ClaudeClient | null = null;

/**
 * Get the singleton ClaudeClient instance
 */
export function getClaudeClient(): ClaudeClient {
  if (!clientInstance) {
    clientInstance = new ClaudeClient();
  }
  return clientInstance;
}

/**
 * Create a new ClaudeClient instance (for testing)
 */
export function createClaudeClient(options?: {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  retryConfig?: Partial<RetryConfig>;
}): ClaudeClient {
  return new ClaudeClient(options);
}

