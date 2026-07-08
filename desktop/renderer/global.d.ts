import type {
  AppSettings,
  SettingsInfo,
  SettingsUpdateResult,
} from '../shared/settings';
import type {
  Candidate,
  SkillPlatform,
  SkillRecord,
  Spell,
  SpellCreateInput,
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
      deleteSpell(spellId: string): Promise<void>;
      listCandidates(): Promise<Candidate[]>;
      promoteCandidate(candidateId: string): Promise<Spell>;
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
