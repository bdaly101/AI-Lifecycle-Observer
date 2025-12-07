/**
 * File system utility functions
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  unlinkSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { homedir } from 'node:os';

/**
 * Ensure a directory exists, creating it if necessary
 */
export function ensureDir(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Ensure the parent directory of a file exists
 */
export function ensureParentDir(filePath: string): void {
  const dir = dirname(filePath);
  ensureDir(dir);
}

/**
 * Read a file as string, returning null if it doesn't exist
 */
export function readFileOrNull(filePath: string): string | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    return readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Read a JSON file, returning null if it doesn't exist or is invalid
 */
export function readJsonOrNull<T>(filePath: string): T | null {
  const content = readFileOrNull(filePath);
  if (content === null) {
    return null;
  }
  try {
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Write content to a file, creating parent directories if needed
 */
export function writeFileSafe(filePath: string, content: string): void {
  ensureParentDir(filePath);
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Write JSON to a file, creating parent directories if needed
 */
export function writeJsonSafe(filePath: string, data: unknown, pretty = true): void {
  const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  writeFileSafe(filePath, content);
}

/**
 * Delete a file if it exists
 */
export function deleteFileSafe(filePath: string): boolean {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Expand ~ to home directory
 */
export function expandHome(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2));
  }
  if (path === '~') {
    return homedir();
  }
  return path;
}

/**
 * Resolve a path, expanding ~ and making it absolute
 */
export function resolvePath(path: string, basePath?: string): string {
  const expanded = expandHome(path);
  if (basePath) {
    return resolve(basePath, expanded);
  }
  return resolve(expanded);
}

/**
 * Get all files in a directory matching a pattern
 */
export function getFilesInDir(
  dirPath: string,
  options?: {
    extension?: string;
    recursive?: boolean;
  }
): string[] {
  const { extension, recursive = false } = options ?? {};
  const results: string[] = [];

  if (!existsSync(dirPath)) {
    return results;
  }

  const entries = readdirSync(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory() && recursive) {
      results.push(...getFilesInDir(fullPath, options));
    } else if (stat.isFile()) {
      if (!extension || entry.endsWith(extension)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Get project name from path (last directory component)
 */
export function getProjectName(projectPath: string): string {
  return basename(resolve(expandHome(projectPath)));
}

/**
 * Check if a path is a directory
 */
export function isDirectory(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Check if a path is a file
 */
export function isFile(path: string): boolean {
  try {
    return existsSync(path) && statSync(path).isFile();
  } catch {
    return false;
  }
}

