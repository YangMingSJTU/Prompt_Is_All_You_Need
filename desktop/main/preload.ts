import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings } from '../shared/settings';
import type { SkillPlatform } from '../shared/types';

contextBridge.exposeInMainWorld('apm', {
  searchSnippets: (query: string) => ipcRenderer.invoke('snippets:search', query),
  listSnippets: () => ipcRenderer.invoke('snippets:list'),
  listPopularSnippets: (limit?: number) => ipcRenderer.invoke('snippets:popular', limit),
  copySnippet: (snippetId: string) => ipcRenderer.invoke('snippets:copy', snippetId),
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
