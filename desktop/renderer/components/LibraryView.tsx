import { Plus } from 'lucide-react';
import { useState } from 'react';
import type { Candidate, Prompt } from '../../shared/types';
import { ExportDialog } from './ExportDialog';

interface LibraryViewProps {
  prompts: Prompt[];
  candidates: Candidate[];
  onChanged(): Promise<void>;
  onMessage(message: string): void;
}

export function LibraryView({
  prompts,
  candidates,
  onChanged,
  onMessage
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
          <p className="eyebrow">Saved assets</p>
          <h3>Prompt Library</h3>
        </div>
        <span className="count-pill">{prompts.length} prompts</span>
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
              Export
            </button>
          </article>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">From local history</p>
          <h3>Candidates</h3>
        </div>
        <span className="count-pill">{candidates.length} candidates</span>
      </div>
      <div className="candidate-list">
        {candidates.map((candidate) => (
          <article className="candidate-row" key={candidate.id}>
            <div>
              <strong>{candidate.title}</strong>
              <p>{candidate.description}</p>
              <small>
                {candidate.sourceCount} sources · score {candidate.score}
              </small>
            </div>
            <button className="primary-button" onClick={() => promote(candidate)} type="button">
              <Plus size={16} />
              Save
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
        />
      ) : null}
    </section>
  );
}
