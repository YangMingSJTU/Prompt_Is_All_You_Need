import type {
  AppSettings,
  SettingsInfo,
  SettingsUpdateResult,
} from '../shared/settings';
import type {
  Candidate,
  SkillPlatform,
  SkillRecord,
  Snippet,
  SourceFileSummary,
  UsageAnalytics
} from '../shared/types';

declare global {
  interface Window {
    apm: {
      searchSnippets(query: string): Promise<Snippet[]>;
      listSnippets(): Promise<Snippet[]>;
      listPopularSnippets(limit?: number): Promise<Snippet[]>;
      copySnippet(snippetId: string): Promise<Snippet>;
      listCandidates(): Promise<Candidate[]>;
      promoteCandidate(candidateId: string): Promise<Snippet>;
      runScan(): Promise<{
        id: string;
        scannedPrompts: number;
        sourceFiles: SourceFileSummary[];
        candidates: Candidate[];
        warningCount: number;
      }>;
      getAnalytics(): Promise<UsageAnalytics>;
      listSkills(): Promise<SkillRecord[]>;
      scanSkills(): Promise<SkillRecord[]>;
      packageSkill(skillId: string): Promise<{ path: string }>;
      installSkill(skillId: string, targetPlatform: SkillPlatform): Promise<{ path: string; warning?: string }>;
      getSettings(): Promise<AppSettings>;
      getSettingsInfo(): Promise<SettingsInfo>;
      updateSettings(patch: Partial<AppSettings>): Promise<SettingsUpdateResult>;
      onFloatingFocus(callback: () => void): () => void;
      closeFloatingWindow(): Promise<void>;
    };
  }
}

export {};
