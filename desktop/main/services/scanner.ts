import { readdir, readFile, stat } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import type {
  ExtractedPrompt,
  ScanSummary,
  SourceFileSummary,
  SourceTool
} from '../../shared/types';
import { extractPromptsFromJsonl } from './parser';

const SKIPPED_SEGMENTS = [
  'paste-cache',
  'image-cache',
  'tool-results',
  'file-history',
  'debug',
  'shell-snapshots',
  'backups'
];

export interface HistoryDiscoveryError {
  code: 'permission_denied' | 'io_error';
  path: string;
  retryable: true;
}

export type HistoryDiscoveryResult =
  | { status: 'success' | 'missing'; files: string[] }
  | { status: 'unreadable' | 'failed'; files: []; error: HistoryDiscoveryError };

export async function scanJsonlFiles(
  files: string[],
  sourceTool: SourceTool
): Promise<ScanSummary> {
  const prompts: ExtractedPrompt[] = [];
  const sourceFiles: SourceFileSummary[] = [];
  let warningCount = 0;

  for (const file of files.filter((item) => !isSkippedPath(item))) {
    try {
      const content = await readFile(file, 'utf8');
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
    } catch {
      warningCount += 1;
      sourceFiles.push({
        id: `${sourceTool}:${file}`,
        sourceTool,
        path: file,
        status: 'skipped',
        lineCount: 0,
        promptCount: 0,
        warningCount: 1,
        scannedAt: new Date().toISOString()
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
  limit = 500
): Promise<HistoryDiscoveryResult> {
  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    if (files.length >= limit || isSkippedPath(directory)) {
      return;
    }

    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (files.length >= limit) {
        return;
      }
      const fullPath = join(directory, entry.name);
      if (isSkippedPath(fullPath)) {
        continue;
      }
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.jsonl')) {
        files.push(fullPath);
      }
    }
  }

  try {
    const rootStat = await stat(root);
    if (rootStat.isFile()) {
      return {
        status: 'success',
        files: root.toLowerCase().endsWith('.jsonl') ? [root] : []
      };
    }
    if (rootStat.isDirectory()) {
      await walk(root);
    }
    return { status: 'success', files };
  } catch (error) {
    const code = nodeErrorCode(error);
    if (code === 'ENOENT') {
      return { status: 'missing', files: [] };
    }
    const errorPath = nodeErrorPath(error) ?? root;
    if (code === 'EACCES' || code === 'EPERM') {
      return {
        status: 'unreadable',
        files: [],
        error: { code: 'permission_denied', path: errorPath, retryable: true }
      };
    }
    return {
      status: 'failed',
      files: [],
      error: { code: 'io_error', path: errorPath, retryable: true }
    };
  }
}

export function isSkippedPath(path: string): boolean {
  const normalized = normalize(path).toLowerCase();
  return SKIPPED_SEGMENTS.some((segment) => normalized.includes(segment.toLowerCase()));
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
