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

const LOW_VALUE_PROMPTS = new Set([
  '好',
  '可以',
  '继续',
  '嗯',
  'ok',
  'yes',
  'no',
  '不是',
  '不对',
  '错了',
  'wrong',
  'retry',
  'again',
  'continue',
  '重试'
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

      const redacted = redactSecrets(extracted).trim();
      if (isLowValuePrompt(redacted)) {
        continue;
      }

      const normalizedText = normalizePrompt(redacted);
      prompts.push({
        id: randomUUID(),
        sourceTool: options.sourceTool,
        sourceFile: options.sourceFile,
        sessionId: asOptionalString(record.sessionId),
        projectPath: asOptionalString(record.projectPath ?? record.cwd),
        timestamp: asOptionalString(record.timestamp),
        turnIndex: index,
        rawText: redacted,
        normalizedText,
        hash: sha256(normalizedText)
      });
    } catch {
      warningCount += 1;
    }
  }

  return { prompts, warningCount };
}

export function redactSecrets(text: string): string {
  return text
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[REDACTED_SECRET]')
    .replace(/\b(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)\s*=\s*\S+/gi, '[REDACTED_SECRET]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bghp_[A-Za-z0-9_]{8,}\b/g, '[REDACTED_SECRET]')
    .replace(/\bxoxb-[A-Za-z0-9-]{8,}\b/g, '[REDACTED_SECRET]');
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

export function isLowValuePrompt(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) {
    return true;
  }
  if (LOW_VALUE_PROMPTS.has(trimmed.toLowerCase())) {
    return true;
  }
  if (/^```[\s\S]*```$/.test(trimmed)) {
    return true;
  }
  if (/^[./\\~:\w -]+\.[A-Za-z0-9]+$/.test(trimmed)) {
    return true;
  }
  return false;
}

function getRole(record: Record<string, unknown>): string | null {
  const nestedMessage = asRecord(record.message);
  const raw = record.role ?? record.type ?? nestedMessage?.role;
  return typeof raw === 'string' ? raw.toLowerCase() : null;
}

function extractText(record: Record<string, unknown>): string | null {
  const nestedMessage = asRecord(record.message);
  const candidates = [nestedMessage?.content, record.content, record.text];

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
