import { Clipboard, Search } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Snippet } from '../../shared/types';
import type { TFunction } from '../i18n';

interface FloatingPanelProps {
  t: TFunction;
}

export function FloatingPanel({ t }: FloatingPanelProps) {
  const [query, setQuery] = useState('');
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState(t('status.ready'));
  const inputRef = useRef<HTMLInputElement>(null);

  const loadPrompts = useCallback(async (value: string) => {
    const trimmed = value.trim();
    const results = trimmed
      ? await window.apm.searchSnippets(trimmed)
      : await window.apm.listPopularSnippets(6);
    setSnippets(results);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    void loadPrompts(query);
  }, [loadPrompts, query]);

  useEffect(() => {
    const dispose = window.apm.onFloatingFocus(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    inputRef.current?.focus();
    return dispose;
  }, []);

  const selected = useMemo(() => snippets[selectedIndex] ?? null, [snippets, selectedIndex]);

  async function copySnippet(snippet: Snippet): Promise<void> {
    await window.apm.copySnippet(snippet.id);
    setStatus(`${t('status.copied')} ${snippet.title}`);
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): Promise<void> {
    if (event.key === 'Escape') {
      event.preventDefault();
      await window.apm.closeFloatingWindow();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) => Math.min(current + 1, Math.max(snippets.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter' && selected) {
      event.preventDefault();
      await copySnippet(selected);
    }
  }

  return (
    <main className="floating-shell">
      <header className="floating-header">
        <div>
          <h1>{t('floating.title')}</h1>
        </div>
        <span>{status}</span>
      </header>
      <label className="floating-search">
        <Search size={18} />
        <input
          ref={inputRef}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => void handleKeyDown(event)}
          placeholder={t('floating.placeholder')}
          value={query}
        />
      </label>
      <section className="floating-results">
        {snippets.map((snippet, index) => (
          <button
            className={index === selectedIndex ? 'floating-row selected' : 'floating-row'}
            key={snippet.id}
            onClick={() => {
              setSelectedIndex(index);
              void copySnippet(snippet);
            }}
            type="button"
          >
            <span>
              <strong>{snippet.title}</strong>
              <small>{snippet.description}</small>
            </span>
            <Clipboard size={15} />
          </button>
        ))}
        {snippets.length === 0 ? <div className="floating-empty">{t('floating.noResult')}</div> : null}
      </section>
    </main>
  );
}
