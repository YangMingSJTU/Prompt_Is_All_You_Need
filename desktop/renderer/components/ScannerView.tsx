import { RotateCw } from 'lucide-react';
import { useState } from 'react';
import type { Candidate, SourceFileSummary } from '../../shared/types';
import type { TFunction } from '../i18n';
import { FeedbackTarget, useFeedbackTooltip } from './FeedbackTooltip';

interface ScannerViewProps {
  onChanged(): Promise<void>;
  t: TFunction;
}

interface ScanState {
  scannedPrompts: number;
  sourceFiles: SourceFileSummary[];
  candidates: Candidate[];
  warningCount: number;
}

export function ScannerView({ onChanged, t }: ScannerViewProps) {
  const [scanState, setScanState] = useState<ScanState | null>(null);
  const [running, setRunning] = useState(false);
  const { showFeedback, tooltipFor } = useFeedbackTooltip();

  async function runScan(): Promise<void> {
    setRunning(true);
    try {
      const result = await window.spellbook.runScan();
      setScanState(result);
      showFeedback('scanner:run', `${t('status.scanFinished')}: ${result.scannedPrompts}`);
      await onChanged();
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="stack scanner-view">
      <div className="section-heading">
        <div>
          <h3>{t('scanner.title')}</h3>
        </div>
        <FeedbackTarget align="right" message={tooltipFor('scanner:run')}>
          <button className="primary-button" disabled={running} onClick={runScan} type="button">
            <RotateCw size={16} />
            {running ? t('scanner.running') : t('scanner.run')}
          </button>
        </FeedbackTarget>
      </div>
      <div className="summary-strip">
        <div className="summary-item">
          <span>{t('metric.spells')}</span>
          <strong>{scanState?.scannedPrompts ?? 0}</strong>
        </div>
        <div className="summary-item">
          <span>{t('metric.sources')}</span>
          <strong>{scanState?.sourceFiles.length ?? 0}</strong>
        </div>
        <div className="summary-item">
          <span>{t('metric.candidates')}</span>
          <strong>{scanState?.candidates.length ?? 0}</strong>
        </div>
        <div className="summary-item">
          <span>{t('metric.warnings')}</span>
          <strong>{scanState?.warningCount ?? 0}</strong>
        </div>
      </div>
      <div className="source-table">
        <div className="source-row source-header">
          <span>{t('metric.sources')}</span>
          <strong>{t('metric.spells')}</strong>
          <small>{t('metric.path')}</small>
        </div>
        {(scanState?.sourceFiles ?? []).map((source) => (
          <div className="source-row" key={source.id}>
            <span>{source.sourceTool}</span>
            <strong>{source.promptCount}</strong>
            <small>{source.path}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
