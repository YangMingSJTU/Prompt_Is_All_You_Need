import { FileDown, Plus } from 'lucide-react';
import { useState } from 'react';
import type { Candidate, Prompt } from '../../shared/types';
import type { TFunction } from '../i18n';
import { ExportDialog } from './ExportDialog';

interface LibraryViewProps {
  prompts: Prompt[];
  candidates: Candidate[];
  onChanged(): Promise<void>;
  onMessage(message: string): void;
  t: TFunction;
}

export function LibraryView({
  prompts,
  candidates,
  onChanged,
  onMessage,
  t
}: LibraryViewProps) {
  const [exportPrompt, setExportPrompt] = useState<Prompt | null>(null);

  async function promote(candidate: Candidate): Promise<void> {
    await window.apm.promoteCandidate(candidate.id);
    onMessage(`Saved ${candidate.title} to library`);
    await onChanged();
  }

  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <h3>{t('library.title')}</h3>
        </div>
        <span className="count-pill">{prompts.length} {t('metric.prompts')}</span>
      </div>
      <div className="card-grid">
        {prompts.map((prompt) => (
          <article className="prompt-card" key={prompt.id}>
            <div>
              <p className="eyebrow">{prompt.promptType}</p>
              <h4>{prompt.title}</h4>
              <p>{prompt.description}</p>
            </div>
            <button className="secondary-button" onClick={() => setExportPrompt(prompt)} type="button">
              <FileDown size={16} />
              {t('prompt.export')}
            </button>
          </article>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <h3>{t('library.candidates')}</h3>
        </div>
        <span className="count-pill">{candidates.length} {t('metric.candidates')}</span>
      </div>
      <div className="candidate-list">
        {candidates.map((candidate) => (
          <article className="candidate-row" key={candidate.id}>
            <div>
              <strong>{candidate.title}</strong>
              <p>{candidate.description}</p>
              <small>
                {candidate.sourceCount} {t('metric.sources')} · {t('metric.score')} {candidate.score}
              </small>
            </div>
            <button className="primary-button" onClick={() => promote(candidate)} type="button">
              <Plus size={16} />
              {t('library.save')}
            </button>
          </article>
        ))}
      </div>
      {exportPrompt ? (
        <ExportDialog
          prompt={exportPrompt}
          promptId={exportPrompt.id}
          onClose={() => setExportPrompt(null)}
          onExported={onChanged}
          onMessage={onMessage}
          t={t}
        />
      ) : null}
    </section>
  );
}
