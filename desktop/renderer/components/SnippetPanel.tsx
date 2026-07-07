import { Clipboard, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Snippet } from '../../shared/types';
import type { TFunction } from '../i18n';

interface SnippetPanelProps {
  snippets: Snippet[];
  onChanged(): Promise<void>;
  onMessage(message: string): void;
  t: TFunction;
}

export function SnippetPanel({ snippets, onChanged, onMessage, t }: SnippetPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(snippets[0]?.id ?? null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return snippets;
    }
    return snippets.filter((snippet) =>
      [snippet.title, snippet.description, snippet.body, snippet.tags.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [snippets, query]);

  const selected = filtered.find((snippet) => snippet.id === selectedId) ?? filtered[0] ?? null;

  async function copySelected(snippet: Snippet): Promise<void> {
    await window.apm.copySnippet(snippet.id);
    onMessage(`${t('status.copied')} ${snippet.title}`);
    await onChanged();
  }

  return (
    <section className="panel-grid">
      <div className="search-pane">
        <div className="pane-toolbar">
          <h3>{t('nav.panel')}</h3>
          <span className="count-pill">{filtered.length}/{snippets.length}</span>
        </div>
        <label className="search-box">
          <Search size={18} />
          <input
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('snippet.placeholder')}
            value={query}
          />
        </label>
        <div className="result-list">
          {filtered.map((snippet) => (
            <button
              className={selected?.id === snippet.id ? 'result-row selected' : 'result-row'}
              key={snippet.id}
              onClick={() => setSelectedId(snippet.id)}
              type="button"
            >
              <span>
                <strong>{snippet.title}</strong>
                <small>{snippet.description}</small>
              </span>
              <em>Snippet</em>
            </button>
          ))}
        </div>
      </div>
      <div className="detail-pane">
        {selected ? (
          <>
            <div className="detail-heading">
              <div className="detail-title">
                <h3>{selected.title}</h3>
                {selected.tags.length > 0 ? (
                  <div className="tag-strip">
                    {selected.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="button-row">
                <button className="primary-button" onClick={() => copySelected(selected)} type="button">
                  <Clipboard size={16} />
                  {t('snippet.copy')}
                </button>
              </div>
            </div>
            <pre className="prompt-preview">{selected.body}</pre>
          </>
        ) : (
          <div className="empty-state">{t('snippet.empty')}</div>
        )}
      </div>
    </section>
  );
}
