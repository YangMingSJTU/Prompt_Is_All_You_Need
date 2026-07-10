export type SkillPlatform = 'claude' | 'codex';

export type SourceTool = SkillPlatform | 'manual';

export type ScanProvider = SkillPlatform;

export type ScanTarget = 'spells' | 'skills';

export type AssetType = 'spell' | 'skill';

export type CandidateType = 'spell';

export type CandidateStatus = 'pending' | 'saved' | 'ignored';

export type SkillInstallState = 'installed' | 'missing';

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

export interface Spell {
  id: string;
  name: string;
  body: string;
  tags: string[];
  source: string;
  createdAt: string;
  updatedAt: string;
  copyCount: number;
}

export interface SpellUpdatePatch {
  name?: string;
  body?: string;
  tags?: string[];
}

export interface SpellCreateInput {
  name?: string;
  body: string;
  tags?: string[];
}

export interface SpellDeleteResult {
  deletedIds: string[];
  missingIds: string[];
}

export interface ScanSourceConfig {
  provider: ScanProvider;
  target: ScanTarget;
  path: string;
  enabled: boolean;
}

export interface ScanRunRequest {
  target: ScanTarget;
  providers: ScanProvider[];
  scanSources: ScanSourceConfig[];
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

export interface CandidatePromotionResult {
  created: Spell[];
  skipped: Array<{
    candidateId: string;
    reason: 'duplicate' | 'missing';
  }>;
}

export interface SkillRecord {
  id: string;
  platform: SkillPlatform;
  name: string;
  description: string;
  rootPath: string;
  entryFilePath: string;
  fileCount: number;
  files: string[];
  updatedAt: string;
  packageable: boolean;
  installState: SkillInstallState;
}

export interface UsageAnalytics {
  spellCount: number;
  skillCount: number;
  candidateCount: number;
  totalCopies: number;
  topSpells: Array<{
    id: string;
    body: string;
    copyCount: number;
  }>;
}
