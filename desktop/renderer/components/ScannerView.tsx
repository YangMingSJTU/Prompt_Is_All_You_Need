import { RotateCw } from 'lucide-react';
import { useState } from 'react';
import type { Candidate, SourceFileSummary } from '../../shared/types';

interface ScannerViewProps {
  onChanged(): Promise<void>;
  onMessage(message: string): void;
}

interface ScanState {
  scannedPrompts: number;
  sourceFiles: SourceFileSummary[];
  candidates: Candidate[];
  warningCount: number;
}

export function ScannerView({ onChanged, onMessage }: ScannerViewProps) {
  const [scanState, setScanState] = useState<ScanState | null>(null);
  const [running, setRunning] = useState(false);

  async function runScan(): Promise<void> {
    setRunning(true);
    try {
      const result = await window.apm.runScan();
      setScanState(result);
      onMessage(`Scan finished: ${result.scannedPrompts} prompts`);
      await onChanged();
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Local only</p>
          <h3>History Scanner</h3>
          <p className="muted">Scans Claude and Codex JSONL files without uploading data.</p>
        </div>
        <button className="primary-button" disabled={running} onClick={runScan} type="button">
          <RotateCw size={16} />
          {running ? 'Scanning' : 'Run Scan'}
        </button>
      </div>
      <div className="metric-grid">
        <div className="metric-card">
          <span>Prompts</span>
          <strong>{scanState?.scannedPrompts ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>Sources</span>
          <strong>{scanState?.sourceFiles.length ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>Candidates</span>
          <strong>{scanState?.candidates.length ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>Warnings</span>
          <strong>{scanState?.warningCount ?? 0}</strong>
        </div>
      </div>
      <div className="source-table">
        {(scanState?.sourceFiles ?? []).map((source) => (
          <div className="source-row" key={source.id}>
            <span>{source.sourceTool}</span>
            <strong>{source.promptCount} prompts</strong>
            <small>{source.path}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
