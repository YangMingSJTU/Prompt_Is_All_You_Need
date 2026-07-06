import { Clipboard, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Prompt } from '../../shared/types';
import { ExportDialog } from './ExportDialog';

interface PromptPanelProps {
  prompts: Prompt[];
  onChanged(): Promise<void>;
  onMessage(message: string): void;
}

export function PromptPanel({ prompts, onChanged, onMessage }: PromptPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(prompts[0]?.id ?? null);
  const [exportPrompt, setExportPrompt] = useState<Prompt | null>(null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return prompts;
    }
    return prompts.filter((prompt) =>
      [prompt.title, prompt.description, prompt.body, prompt.promptType, prompt.tags.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [prompts, query]);

  const selected = filtered.find((prompt) => prompt.id === selectedId) ?? filtered[0] ?? null;

  async function copySelected(prompt: Prompt): Promise<void> {
    await window.apm.copyPrompt(prompt.id);
    onMessage(`Copied ${prompt.title}`);
    await onChanged();
  }

  return (
    <section className="panel-grid">
      <div className="search-pane">
        <label className="search-box">
          <Search size={18} />
          <input
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search prompts, tags, or content"
            value={query}
          />
        </label>
        <div className="result-list">
          {filtered.map((prompt) => (
            <button
              className={selected?.id === prompt.id ? 'result-row selected' : 'result-row'}
              key={prompt.id}
              onClick={() => setSelectedId(prompt.id)}
              type="button"
            >
              <span>
                <strong>{prompt.title}</strong>
                <small>{prompt.description}</small>
              </span>
              <em>{prompt.promptType}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="detail-pane">
        {selected ? (
          <>
            <div className="detail-heading">
              <div>
                <p className="eyebrow">{selected.tags.join(' / ')}</p>
                <h3>{selected.title}</h3>
              </div>
              <div className="button-row">
                <button className="primary-button" onClick={() => copySelected(selected)} type="button">
                  <Clipboard size={16} />
                  Copy
                </button>
                <button className="secondary-button" onClick={() => setExportPrompt(selected)} type="button">
                  Export
                </button>
              </div>
            </div>
            <pre className="prompt-preview">{selected.body}</pre>
          </>
        ) : (
          <div className="empty-state">No prompts found.</div>
        )}
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
