import { RotateCw } from 'lucide-react';
import { useState } from 'react';
import type { Candidate, SourceFileSummary } from '../../shared/types';
import type { TFunction } from '../i18n';

interface ScannerViewProps {
  onChanged(): Promise<void>;
  onMessage(message: string): void;
  t: TFunction;
}

interface ScanState {
  scannedPrompts: number;
  sourceFiles: SourceFileSummary[];
  candidates: Candidate[];
  warningCount: number;
}

export function ScannerView({ onChanged, onMessage, t }: ScannerViewProps) {
  const [scanState, setScanState] = useState<ScanState | null>(null);
  const [running, setRunning] = useState(false);

  async function runScan(): Promise<void> {
    setRunning(true);
    try {
      const result = await window.apm.runScan();
      setScanState(result);
      onMessage(`${t('status.scanFinished')}: ${result.scannedPrompts}`);
      await onChanged();
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('scanner.localOnly')}</p>
          <h3>{t('scanner.title')}</h3>
          <p className="muted">{t('scanner.description')}</p>
        </div>
        <button className="primary-button" disabled={running} onClick={runScan} type="button">
          <RotateCw size={16} />
          {running ? t('scanner.running') : t('scanner.run')}
        </button>
      </div>
      <div className="metric-grid">
        <div className="metric-card">
          <span>{t('metric.prompts')}</span>
          <strong>{scanState?.scannedPrompts ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>{t('metric.sources')}</span>
          <strong>{scanState?.sourceFiles.length ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>{t('metric.candidates')}</span>
          <strong>{scanState?.candidates.length ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>{t('metric.warnings')}</span>
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
