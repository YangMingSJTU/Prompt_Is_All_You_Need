import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, normalize } from 'node:path';
import type { ExtractedPrompt, ScanSummary, SourceFileSummary, SourceTool } from '../../shared/types';
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

export async function scanJsonlFiles(files: string[], sourceTool: SourceTool): Promise<ScanSummary> {
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

export async function discoverJsonlFiles(root: string, limit = 500): Promise<string[]> {
  const files: string[] = [];

  async function walk(directory: string): Promise<void> {
    if (files.length >= limit || isSkippedPath(directory)) {
      return;
    }

    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

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
    if (rootStat.isFile() && root.toLowerCase().endsWith('.jsonl')) {
      return [root];
    }
    if (rootStat.isDirectory()) {
      await walk(root);
    }
  } catch {
    return [];
  }

  return files;
}

export function defaultHistoryRoots(): Array<{ sourceTool: SourceTool; path: string }> {
  const home = homedir();
  return [
    { sourceTool: 'claude', path: process.env.CLAUDE_CONFIG_DIR ?? join(home, '.claude') },
    { sourceTool: 'codex', path: process.env.CODEX_HOME ?? join(home, '.codex') }
  ];
}

export function isSkippedPath(path: string): boolean {
  const normalized = normalize(path).toLowerCase();
  return SKIPPED_SEGMENTS.some((segment) => normalized.includes(`${segment.toLowerCase()}`));
}
