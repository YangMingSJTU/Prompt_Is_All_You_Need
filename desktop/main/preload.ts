import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings } from '../shared/settings';
import type { ExportablePrompt, ExportTarget } from '../shared/types';

contextBridge.exposeInMainWorld('apm', {
  searchPrompts: (query: string) => ipcRenderer.invoke('prompts:search', query),
  listPrompts: () => ipcRenderer.invoke('prompts:list'),
  listPopularPrompts: (limit?: number) => ipcRenderer.invoke('prompts:popular', limit),
  copyPrompt: (promptId: string) => ipcRenderer.invoke('prompts:copy', promptId),
  listCandidates: () => ipcRenderer.invoke('candidates:list'),
  promoteCandidate: (candidateId: string) => ipcRenderer.invoke('candidates:promote', candidateId),
  runScan: () => ipcRenderer.invoke('scanner:run'),
  getAnalytics: () => ipcRenderer.invoke('analytics:get'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  getSettingsInfo: () => ipcRenderer.invoke('settings:info'),
  updateSettings: (patch: Partial<AppSettings>) => ipcRenderer.invoke('settings:update', patch),
  previewExport: (prompt: ExportablePrompt, target: ExportTarget, baseDirectory?: string) =>
    ipcRenderer.invoke('export:preview', prompt, target, baseDirectory),
  writeExport: (
    prompt: ExportablePrompt,
    target: ExportTarget,
    baseDirectory?: string,
    promptId?: string | null,
    candidateId?: string | null
  ) => ipcRenderer.invoke('export:write', prompt, target, baseDirectory, promptId, candidateId),
  onFloatingFocus: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('floating:focus-search', listener);
    return () => ipcRenderer.removeListener('floating:focus-search', listener);
  },
  closeFloatingWindow: () => ipcRenderer.invoke('floating:close')
});
