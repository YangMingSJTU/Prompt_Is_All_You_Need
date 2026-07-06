import { contextBridge, ipcRenderer } from 'electron';
import type { ExportablePrompt, ExportTarget } from '../shared/types';

contextBridge.exposeInMainWorld('apm', {
  searchPrompts: (query: string) => ipcRenderer.invoke('prompts:search', query),
  listPrompts: () => ipcRenderer.invoke('prompts:list'),
  copyPrompt: (promptId: string) => ipcRenderer.invoke('prompts:copy', promptId),
  listCandidates: () => ipcRenderer.invoke('candidates:list'),
  promoteCandidate: (candidateId: string) => ipcRenderer.invoke('candidates:promote', candidateId),
  runScan: () => ipcRenderer.invoke('scanner:run'),
  getAnalytics: () => ipcRenderer.invoke('analytics:get'),
  previewExport: (prompt: ExportablePrompt, target: ExportTarget, baseDirectory?: string) =>
    ipcRenderer.invoke('export:preview', prompt, target, baseDirectory),
  writeExport: (
    prompt: ExportablePrompt,
    target: ExportTarget,
    baseDirectory?: string,
    promptId?: string | null,
    candidateId?: string | null
  ) => ipcRenderer.invoke('export:write', prompt, target, baseDirectory, promptId, candidateId)
});
