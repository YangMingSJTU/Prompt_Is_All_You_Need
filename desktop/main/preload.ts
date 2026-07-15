import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings } from '../shared/settings';
import type {
  InstallSkillRequest,
  InstallSkillResult,
  PackageSkillRequest,
  PackageSkillResult,
  SkillLibraryState,
  SkillScanResult
} from '../shared/skillTypes';
import type {
  FloatingWindowState,
  ScanRunRequest,
  SpellCreateInput,
  SpellDeleteResult,
  SpellStatePatch,
  SpellUpdatePatch
} from '../shared/types';

contextBridge.exposeInMainWorld('spellbook', {
  searchSpells: (query: string) => ipcRenderer.invoke('spells:search', query),
  listSpells: () => ipcRenderer.invoke('spells:list'),
  listPopularSpells: (limit?: number) => ipcRenderer.invoke('spells:popular', limit),
  copySpell: (spellId: string) => ipcRenderer.invoke('spells:copy', spellId),
  createSpell: (input: SpellCreateInput) => ipcRenderer.invoke('spells:create', input),
  updateSpell: (spellId: string, patch: SpellUpdatePatch) => ipcRenderer.invoke('spells:update', spellId, patch),
  updateSpellState: (spellId: string, patch: SpellStatePatch) =>
    ipcRenderer.invoke('spells:updateState', spellId, patch),
  deleteSpell: (spellId: string) => ipcRenderer.invoke('spells:delete', spellId),
  deleteSpells: (spellIds: string[]): Promise<SpellDeleteResult> =>
    ipcRenderer.invoke('spells:deleteBatch', spellIds),
  listCandidates: () => ipcRenderer.invoke('candidates:list'),
  createSpellFromCandidate: (candidateId: string, input: SpellCreateInput) =>
    ipcRenderer.invoke('candidates:createSpell', candidateId, input),
  promoteCandidates: (candidateIds: string[]) => ipcRenderer.invoke('candidates:promoteBatch', candidateIds),
  runScan: (request: ScanRunRequest) => ipcRenderer.invoke('scanner:run', request),
  getAnalytics: () => ipcRenderer.invoke('analytics:get'),
  getSkillLibraryState: (): Promise<SkillLibraryState> =>
    ipcRenderer.invoke('skills:getLibraryState'),
  scanSkills: (): Promise<SkillScanResult> => ipcRenderer.invoke('skills:scan'),
  packageSkill: (request: PackageSkillRequest): Promise<PackageSkillResult> =>
    ipcRenderer.invoke('skills:package', request),
  installSkill: (request: InstallSkillRequest): Promise<InstallSkillResult> =>
    ipcRenderer.invoke('skills:install', request),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  getSettingsInfo: () => ipcRenderer.invoke('settings:info'),
  updateSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', patch),
  setRecommendationPanelWindowOpen: (open: boolean, panelWidth?: number): Promise<void> =>
    ipcRenderer.invoke('window:setRecommendationPanelOpen', open, panelWidth),
  selectDirectory: (defaultPath?: string) => ipcRenderer.invoke('dialog:selectDirectory', defaultPath),
  onFloatingFocus: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('floating:focus-search', listener);
    return () => ipcRenderer.removeListener('floating:focus-search', listener);
  },
  getFloatingWindowState: (): Promise<FloatingWindowState> =>
    ipcRenderer.invoke('floating:getState'),
  setFloatingWindowPinned: (pinned: boolean): Promise<FloatingWindowState> =>
    ipcRenderer.invoke('floating:setPinned', pinned),
  closeFloatingWindow: () => ipcRenderer.invoke('floating:close')
});
