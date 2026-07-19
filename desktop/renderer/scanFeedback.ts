import type { SourceFileSummary } from '../shared/types';

export interface ScanFeedback {
  kind: 'success' | 'partial' | 'failed';
  paths: string[];
}

export function summarizeScanFeedback(sourceFiles: SourceFileSummary[]): ScanFeedback {
  const paths = [
    ...new Set(
      sourceFiles
        .map((sourceFile) => sourceFile.error?.path)
        .filter((path): path is string => Boolean(path))
    )
  ];
  if (paths.length === 0) {
    return { kind: 'success', paths: [] };
  }
  return {
    kind: sourceFiles.some((sourceFile) => sourceFile.status === 'scanned')
      ? 'partial'
      : 'failed',
    paths
  };
}
