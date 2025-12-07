/**
 * Configuration loader with validation and environment variable support
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { lifecycleObserverConfigSchema } from './schema.js';
import { DEFAULT_CONFIG } from './defaults.js';
import type { LifecycleObserverConfig, PartialConfig } from '../types/index.js';

/**
 * Config file names to search for
 */
const CONFIG_FILE_NAMES = [
  '.lifecyclerc.json',
  '.lifecyclerc',
  'lifecycle.config.json',
];

/**
 * Expand ~ to home directory in paths
 */
export function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  if (path.startsWith('~')) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

/**
 * Resolve environment variable references in strings
 * Format: "env:VAR_NAME" or "env:VAR_NAME:default_value"
 */
export function resolveEnvValue(value: string): string {
  if (!value.startsWith('env:')) {
    return value;
  }

  const parts = value.slice(4).split(':');
  const envName = parts[0];
  const defaultValue = parts.slice(1).join(':');

  if (!envName) {
    return defaultValue || value;
  }

  const envValue = process.env[envName];
  
  if (envValue !== undefined) {
    return envValue;
  }

  if (defaultValue) {
    return defaultValue;
  }

  // Return the original string if env var not found and no default
  return value;
}

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      // Recursively merge objects
      (result as Record<string, unknown>)[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else if (sourceValue !== undefined) {
      // Use source value
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Recursively resolve all env: references in an object
 */
function resolveEnvReferences(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return resolveEnvValue(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(resolveEnvReferences);
  }

  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolveEnvReferences(value);
    }
    return result;
  }

  return obj;
}

/**
 * Recursively expand all paths in an object
 */
function expandPaths(obj: unknown, pathKeys: string[]): unknown {
  if (typeof obj === 'string') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => expandPaths(item, pathKeys));
  }

  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (pathKeys.includes(key) && typeof value === 'string') {
        result[key] = expandPath(value);
      } else {
        result[key] = expandPaths(value, pathKeys);
      }
    }
    return result;
  }

  return obj;
}

/**
 * Find config file in directory and parent directories
 */
export function findConfigFile(startDir: string): string | null {
  let currentDir = startDir;
  const root = dirname(currentDir);

  while (currentDir !== root) {
    for (const fileName of CONFIG_FILE_NAMES) {
      const filePath = join(currentDir, fileName);
      if (existsSync(filePath)) {
        return filePath;
      }
    }
    currentDir = dirname(currentDir);
  }

  // Check home directory
  for (const fileName of CONFIG_FILE_NAMES) {
    const filePath = join(homedir(), fileName);
    if (existsSync(filePath)) {
      return filePath;
    }
  }

  return null;
}

/**
 * Load configuration from a file
 */
export function loadConfigFile(filePath: string): PartialConfig {
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as PartialConfig;
}

/**
 * Load and validate configuration
 */
export function loadConfig(options?: {
  configPath?: string;
  cwd?: string;
}): LifecycleObserverConfig {
  const { configPath, cwd = process.cwd() } = options ?? {};

  // Start with defaults
  let config: PartialConfig = {};

  // Try to load from file
  const filePath = configPath ?? findConfigFile(cwd);
  if (filePath && existsSync(filePath)) {
    try {
      config = loadConfigFile(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load config from ${filePath}: ${message}`);
    }
  }

  // Merge with defaults
  const merged = deepMerge(
    DEFAULT_CONFIG as unknown as Record<string, unknown>,
    config as unknown as Record<string, unknown>
  );

  // Expand paths
  const pathKeys = ['path', 'projectsDir', 'dataDir'];
  const withExpandedPaths = expandPaths(merged, pathKeys) as LifecycleObserverConfig;

  // Resolve env references
  const resolved = resolveEnvReferences(withExpandedPaths);

  // Validate with Zod
  const parseResult = lifecycleObserverConfigSchema.safeParse(resolved);
  
  if (!parseResult.success) {
    const errors = parseResult.error.errors
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${errors}`);
  }

  return parseResult.data as LifecycleObserverConfig;
}

/**
 * Get the path where config would be saved
 */
export function getConfigPath(cwd?: string): string {
  return join(cwd ?? process.cwd(), '.lifecyclerc.json');
}

/**
 * Check if a config file exists
 */
export function configExists(cwd?: string): boolean {
  return findConfigFile(cwd ?? process.cwd()) !== null;
}

