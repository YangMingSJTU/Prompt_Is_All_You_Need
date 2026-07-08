import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings } from '../shared/settings';
import type { SkillPlatform, SpellCreateInput, SpellUpdatePatch } from '../shared/types';

contextBridge.exposeInMainWorld('spellbook', {
  searchSpells: (query: string) => ipcRenderer.invoke('spells:search', query),
  listSpells: () => ipcRenderer.invoke('spells:list'),
  listPopularSpells: (limit?: number) => ipcRenderer.invoke('spells:popular', limit),
  copySpell: (spellId: string) => ipcRenderer.invoke('spells:copy', spellId),
  createSpell: (input: SpellCreateInput) => ipcRenderer.invoke('spells:create', input),
  updateSpell: (spellId: string, patch: SpellUpdatePatch) => ipcRenderer.invoke('spells:update', spellId, patch),
  deleteSpell: (spellId: string) => ipcRenderer.invoke('spells:delete', spellId),
  listCandidates: () => ipcRenderer.invoke('candidates:list'),
  promoteCandidate: (candidateId: string) => ipcRenderer.invoke('candidates:promote', candidateId),
  runScan: () => ipcRenderer.invoke('scanner:run'),
  getAnalytics: () => ipcRenderer.invoke('analytics:get'),
  listSkills: () => ipcRenderer.invoke('skills:list'),
  scanSkills: () => ipcRenderer.invoke('skills:scan'),
  packageSkill: (skillId: string) => ipcRenderer.invoke('skills:package', skillId),
  installSkill: (skillId: string, targetPlatform: SkillPlatform) =>
    ipcRenderer.invoke('skills:install', skillId, targetPlatform),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  getSettingsInfo: () => ipcRenderer.invoke('settings:info'),
  updateSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', patch),
  onFloatingFocus: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('floating:focus-search', listener);
    return () => ipcRenderer.removeListener('floating:focus-search', listener);
  },
  closeFloatingWindow: () => ipcRenderer.invoke('floating:close')
});
