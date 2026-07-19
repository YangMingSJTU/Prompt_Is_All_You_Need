import { readdir, readFile, stat } from 'node:fs/promises';
import type { Dirent, Stats } from 'node:fs';
import type {
  ExtractedPrompt,
  ScanSourceError,
  ScanSummary,
  SourceFileSummary,
  SourceTool
} from '../../shared/types';
import { extractPromptsFromJsonl } from './parser';
import {
  nativePlatformPathContext,
  type PlatformPathContext
} from './platformPaths';

const SKIPPED_SEGMENTS = [
  'paste-cache',
  'image-cache',
  'tool-results',
  'file-history',
  'debug',
  'shell-snapshots',
  'backups'
];

export type HistoryDiscoveryError = ScanSourceError;

export interface ScannerFileSystem {
  readFile(path: string): Promise<string>;
  readdir(path: string): Promise<Dirent[]>;
  stat(path: string): Promise<Stats>;
}

export const nodeScannerFileSystem: ScannerFileSystem = {
  readFile: (path) => readFile(path, 'utf8'),
  readdir: (path) => readdir(path, { withFileTypes: true }),
  stat
};

export interface ScannerOptions {
  fs?: ScannerFileSystem;
  pathContext?: PlatformPathContext;
}

export interface HistoryDiscoveryOptions extends ScannerOptions {
  limit?: number;
}

export interface HistoryDiscoveryResult {
  status: 'success' | 'missing' | 'partial' | 'unreadable' | 'failed';
  files: string[];
  errors: HistoryDiscoveryError[];
}

export async function scanJsonlFiles(
  files: string[],
  sourceTool: SourceTool,
  options: ScannerOptions = {}
): Promise<ScanSummary> {
  const fs = options.fs ?? nodeScannerFileSystem;
  const pathContext = options.pathContext ?? nativePlatformPathContext;
  const prompts: ExtractedPrompt[] = [];
  const sourceFiles: SourceFileSummary[] = [];
  let warningCount = 0;

  for (const file of files.filter((item) => !isSkippedPath(item, pathContext))) {
    try {
      const content = await fs.readFile(file);
      const result = extractPromptsFromJsonl(content, {
        sourceTool,
        sourceFile: file
      });
      prompts.push(...result.prompts);
      warningCount += result.warningCount;
      sourceFiles.push({
        id: `${sourceTool}:${file}`,
        sourceTool,
        path: file,
        status: 'scanned',
        lineCount: content.split(/\r?\n/).filter(Boolean).length,
        promptCount: result.prompts.length,
        warningCount: result.warningCount,
        scannedAt: new Date().toISOString()
      });
    } catch (error) {
      warningCount += 1;
      sourceFiles.push({
        id: `${sourceTool}:${file}`,
        sourceTool,
        path: file,
        status: 'skipped',
        lineCount: 0,
        promptCount: 0,
        warningCount: 1,
        scannedAt: new Date().toISOString(),
        error: mapDiscoveryError(error, file)
      });
    }
  }

  return { prompts, sourceFiles, warningCount };
}

export function hasSuccessfulSourceScan(sourceFiles: SourceFileSummary[]): boolean {
  return sourceFiles.some((sourceFile) => sourceFile.status === 'scanned');
}

export async function discoverJsonlFiles(
  root: string,
  options: HistoryDiscoveryOptions = {}
): Promise<HistoryDiscoveryResult> {
  const fs = options.fs ?? nodeScannerFileSystem;
  const pathContext = options.pathContext ?? nativePlatformPathContext;
  const limit = options.limit ?? 500;
  const files: string[] = [];
  const errors: HistoryDiscoveryError[] = [];

  async function walk(directory: string): Promise<void> {
    if (files.length >= limit || isSkippedPath(directory, pathContext)) {
      return;
    }

    let entries: Dirent[];
    try {
      entries = await fs.readdir(directory);
    } catch (error) {
      errors.push(mapDiscoveryError(error, directory));
      return;
    }

    for (const entry of entries) {
      if (files.length >= limit) {
        return;
      }
      const fullPath = pathContext.path.join(directory, entry.name);
      if (isSkippedPath(fullPath, pathContext)) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
  }

  let rootStat: Stats;
  try {
    rootStat = await fs.stat(root);
  } catch (error) {
    if (nodeErrorCode(error) === 'ENOENT') {
      return { status: 'missing', files: [], errors: [] };
    }
    const failure = mapDiscoveryError(error, root);
    return {
      status: failure.code === 'permission_denied' ? 'unreadable' : 'failed',
      files: [],
      errors: [failure]
    };
  }

  if (rootStat.isFile()) {
    return {
      status: 'success',
      files: root.toLowerCase().endsWith('.jsonl') ? [root] : [],
      errors: []
    };
  }
  if (rootStat.isDirectory()) {
    await walk(root);
  }
  if (errors.length === 0) {
    return { status: 'success', files, errors };
  }
  if (files.length > 0) {
    return { status: 'partial', files, errors };
  }
  return {
    status: errors.every((error) => error.code === 'permission_denied')
      ? 'unreadable'
      : 'failed',
    files,
    errors
  };
}

export function isSkippedPath(
  value: string,
  pathContext: PlatformPathContext = nativePlatformPathContext
): boolean {
  const normalized = pathContext.path.normalize(value).toLowerCase();
  return SKIPPED_SEGMENTS.some((segment) => normalized.includes(segment.toLowerCase()));
}

function mapDiscoveryError(error: unknown, fallbackPath: string): HistoryDiscoveryError {
  const code = nodeErrorCode(error);
  return {
    code: code === 'EACCES' || code === 'EPERM' ? 'permission_denied' : 'io_error',
    path: nodeErrorPath(error) ?? fallbackPath,
    retryable: true
  };
}

function nodeErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function nodeErrorPath(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'path' in error
    ? String((error as { path?: unknown }).path)
    : undefined;
}
