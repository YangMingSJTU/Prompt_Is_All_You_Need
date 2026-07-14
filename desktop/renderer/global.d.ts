import type {
  AppSettings,
  SettingsInfo,
  SettingsUpdateResult,
} from '../shared/settings';
import type {
  Candidate,
  CandidatePromotionResult,
  ScanRunRequest,
  SkillPlatform,
  SkillRecord,
  Spell,
  SpellCreateInput,
  SpellDeleteResult,
  SpellStatePatch,
  SpellUpdatePatch,
  SourceFileSummary,
  UsageAnalytics
} from '../shared/types';

declare global {
  interface Window {
    spellbook: {
      searchSpells(query: string): Promise<Spell[]>;
      listSpells(): Promise<Spell[]>;
      listPopularSpells(limit?: number): Promise<Spell[]>;
      copySpell(spellId: string): Promise<Spell>;
      createSpell(input: SpellCreateInput): Promise<Spell>;
      updateSpell(spellId: string, patch: SpellUpdatePatch): Promise<Spell>;
      updateSpellState(spellId: string, patch: SpellStatePatch): Promise<Spell>;
      deleteSpell(spellId: string): Promise<void>;
      deleteSpells(spellIds: string[]): Promise<SpellDeleteResult>;
      listCandidates(): Promise<Candidate[]>;
      createSpellFromCandidate(candidateId: string, input: SpellCreateInput): Promise<Spell>;
      promoteCandidates(candidateIds: string[]): Promise<CandidatePromotionResult>;
      runScan(request: ScanRunRequest): Promise<{
        id: string;
        target: ScanRunRequest['target'];
        scannedPrompts: number;
        sourceFiles: SourceFileSummary[];
        candidates: Candidate[];
        skills: SkillRecord[];
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
      selectDirectory(defaultPath?: string): Promise<string | null>;
      onFloatingFocus(callback: () => void): () => void;
      closeFloatingWindow(): Promise<void>;
    };
  }
}

export {};
