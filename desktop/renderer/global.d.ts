import type {
  AppSettings,
  AppSettingsPatch,
  QuickPanelShortcutState,
  SettingsInfo,
  SettingsUpdateResult,
  ShortcutCaptureEndResult,
  ShortcutCaptureResult,
  ShortcutUpdateRequest,
  ShortcutUpdateResult,
} from '../shared/settings';
import type {
  Candidate,
  CandidatePromotionResult,
  FloatingWindowState,
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
      updateSettings(patch: AppSettingsPatch): Promise<SettingsUpdateResult>;
      getQuickPanelShortcutState(): Promise<QuickPanelShortcutState>;
      updateQuickPanelShortcut(request: ShortcutUpdateRequest): Promise<ShortcutUpdateResult>;
      beginShortcutCapture(): Promise<ShortcutCaptureResult>;
      endShortcutCapture(sessionToken: string): Promise<ShortcutCaptureEndResult>;
      onShortcutCaptureEnded(
        callback: (result: ShortcutCaptureEndResult) => void
      ): () => void;
      dismissShortcutStartupNotice(): Promise<QuickPanelShortcutState>;
      setRecommendationPanelWindowOpen(open: boolean, panelWidth?: number): Promise<void>;
      selectDirectory(defaultPath?: string): Promise<string | null>;
      onFloatingFocus(callback: () => void): () => void;
      getFloatingWindowState(): Promise<FloatingWindowState>;
      setFloatingWindowPinned(pinned: boolean): Promise<FloatingWindowState>;
      closeFloatingWindow(): Promise<void>;
    };
  }
}

export {};
