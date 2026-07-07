import { Clipboard, Plus } from 'lucide-react';
import type { Candidate, Snippet } from '../../shared/types';
import type { TFunction } from '../i18n';

interface LibraryViewProps {
  snippets: Snippet[];
  candidates: Candidate[];
  onChanged(): Promise<void>;
  onMessage(message: string): void;
  t: TFunction;
}

export function LibraryView({
  snippets,
  candidates,
  onChanged,
  onMessage,
  t
}: LibraryViewProps) {
  async function promote(candidate: Candidate): Promise<void> {
    await window.apm.promoteCandidate(candidate.id);
    onMessage(`Saved ${candidate.title} to library`);
    await onChanged();
  }

  async function copy(snippet: Snippet): Promise<void> {
    await window.apm.copySnippet(snippet.id);
    onMessage(`${t('status.copied')} ${snippet.title}`);
    await onChanged();
  }

  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <h3>{t('library.title')}</h3>
        </div>
        <span className="count-pill">{snippets.length} {t('metric.snippets')}</span>
      </div>
      <div className="card-grid">
        {snippets.map((snippet) => (
          <article className="prompt-card" key={snippet.id}>
            <div>
              <p className="eyebrow">Snippet</p>
              <h4>{snippet.title}</h4>
              <p>{snippet.description}</p>
            </div>
            <button className="secondary-button" onClick={() => copy(snippet)} type="button">
              <Clipboard size={16} />
              {t('snippet.copy')}
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
    </section>
  );
}
