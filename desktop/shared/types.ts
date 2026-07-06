export type SourceTool = 'claude' | 'codex' | 'manual';

export type PromptType = 'snippet' | 'skill' | 'memory';

export type CandidateType = 'snippet' | 'skill' | 'memory';

export type CandidateStatus = 'pending' | 'saved' | 'ignored';

export type ExportTarget = 'snippet' | 'claude-skill' | 'codex-skill';

export interface ExtractedPrompt {
  id: string;
  sourceTool: SourceTool;
  sourceFile: string;
  sessionId: string | null;
  projectPath: string | null;
  timestamp: string | null;
  turnIndex: number;
  rawText: string;
  normalizedText: string;
  hash: string;
}

export interface Prompt {
  id: string;
  slug: string;
  title: string;
  body: string;
  description: string;
  promptType: PromptType;
  tags: string[];
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface Candidate {
  id: string;
  slug: string;
  title: string;
  description: string;
  template: string;
  candidateType: CandidateType;
  sourceCount: number;
  score: number;
  status: CandidateStatus;
  examples: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SourceFileSummary {
  id: string;
  sourceTool: SourceTool;
  path: string;
  status: string;
  lineCount: number;
  promptCount: number;
  warningCount: number;
  scannedAt: string;
}

export interface ScanSummary {
  prompts: ExtractedPrompt[];
  sourceFiles: SourceFileSummary[];
  warningCount: number;
}

export interface ExportablePrompt {
  slug: string;
  title: string;
  description: string;
  body: string;
}

export interface ExportPreview {
  path: string;
  content: string;
}

export interface UsageAnalytics {
  promptCount: number;
  candidateCount: number;
  exportedAssetCount: number;
  totalCopies: number;
  topPrompts: Array<{
    id: string;
    title: string;
    copyCount: number;
  }>;
}
