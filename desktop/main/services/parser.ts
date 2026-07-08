import { createHash, randomUUID } from 'node:crypto';
import type { ExtractedPrompt, SourceTool } from '../../shared/types';

export interface ExtractOptions {
  sourceTool: SourceTool;
  sourceFile: string;
}

export interface ExtractResult {
  prompts: ExtractedPrompt[];
  warningCount: number;
}

const ACCEPTED_ROLES = new Set(['user', 'human']);
const IGNORED_ROLES = new Set([
  'assistant',
  'system',
  'tool',
  'tool_use',
  'tool_result',
  'function_call',
  'command_output'
]);

export function extractPromptsFromJsonl(jsonl: string, options: ExtractOptions): ExtractResult {
  const prompts: ExtractedPrompt[] = [];
  let warningCount = 0;
  const lines = jsonl.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) {
      continue;
    }

    try {
      const record = JSON.parse(line) as Record<string, unknown>;
      const role = getRole(record);
      if (!role || IGNORED_ROLES.has(role)) {
        continue;
      }
      if (!ACCEPTED_ROLES.has(role)) {
        continue;
      }

      const extracted = extractText(record);
      if (!extracted) {
        continue;
      }

      if (!extracted.trim()) {
        continue;
      }

      const normalizedText = normalizePrompt(extracted);
      prompts.push({
        id: randomUUID(),
        sourceTool: options.sourceTool,
        sourceFile: options.sourceFile,
        sessionId: asOptionalString(record.sessionId),
        projectPath: asOptionalString(record.projectPath ?? record.cwd),
        timestamp: asOptionalString(record.timestamp),
        turnIndex: index,
        rawText: extracted,
        normalizedText,
        hash: sha256(normalizedText)
      });
    } catch {
      warningCount += 1;
    }
  }

  return { prompts, warningCount };
}

export function normalizePrompt(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '{{code_block}}')
    .replace(/https?:\/\/[^\s)]+/gi, '{{url}}')
    .replace(/\b[A-Fa-f0-9]{12,40}\b/g, '{{commit_hash}}')
    .replace(/#\d+\b/g, '{{issue_id}}')
    .replace(/\b(?:[A-Za-z]:\\|\.{0,2}\/|[\w.-]+\/)[\w./\\-]+\.[A-Za-z0-9]+\b/g, '{{file_path}}')
    .replace(/\b(?:feature|fix|bugfix|hotfix|release)\/[A-Za-z0-9._-]+\b/g, '{{branch_name}}')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getRole(record: Record<string, unknown>): string | null {
  const payload = asRecord(record.payload);
  const payloadItem = asRecord(payload?.item);
  const nestedMessage = asRecord(record.message);
  const raw = record.role ?? payloadItem?.role ?? payload?.role ?? nestedMessage?.role ?? record.type;
  return typeof raw === 'string' ? raw.toLowerCase() : null;
}

function extractText(record: Record<string, unknown>): string | null {
  const payload = asRecord(record.payload);
  const payloadItem = asRecord(payload?.item);
  const nestedMessage = asRecord(record.message);
  const candidates = [
    payloadItem?.content,
    payload?.content,
    nestedMessage?.content,
    record.content,
    record.text,
    payloadItem?.text,
    payload?.text,
    nestedMessage?.text
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
    if (Array.isArray(candidate)) {
      const joined = candidate
        .map((entry) => {
          if (typeof entry === 'string') {
            return entry;
          }
          const asObject = asRecord(entry);
          return typeof asObject?.text === 'string' ? asObject.text : '';
        })
        .filter(Boolean)
        .join('\n');
      if (joined.trim()) {
        return joined;
      }
    }
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
