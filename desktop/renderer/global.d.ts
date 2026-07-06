import type {
  Candidate,
  ExportablePrompt,
  ExportPreview,
  ExportTarget,
  Prompt,
  SourceFileSummary,
  UsageAnalytics
} from '../shared/types';

declare global {
  interface Window {
    apm: {
      searchPrompts(query: string): Promise<Prompt[]>;
      listPrompts(): Promise<Prompt[]>;
      copyPrompt(promptId: string): Promise<Prompt>;
      listCandidates(): Promise<Candidate[]>;
      promoteCandidate(candidateId: string): Promise<Prompt>;
      runScan(): Promise<{
        id: string;
        scannedPrompts: number;
        sourceFiles: SourceFileSummary[];
        candidates: Candidate[];
        warningCount: number;
      }>;
      getAnalytics(): Promise<UsageAnalytics>;
      previewExport(
        prompt: ExportablePrompt,
        target: ExportTarget,
        baseDirectory?: string
      ): Promise<ExportPreview>;
      writeExport(
        prompt: ExportablePrompt,
        target: ExportTarget,
        baseDirectory?: string,
        promptId?: string | null,
        candidateId?: string | null
      ): Promise<ExportPreview>;
    };
  }
}

export {};
