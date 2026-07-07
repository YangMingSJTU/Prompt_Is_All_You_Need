import { Clipboard, Search } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Spell } from '../../shared/types';
import type { TFunction } from '../i18n';

interface FloatingPanelProps {
  t: TFunction;
}

export function FloatingPanel({ t }: FloatingPanelProps) {
  const [query, setQuery] = useState('');
  const [spells, setSpells] = useState<Spell[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState(t('status.ready'));
  const inputRef = useRef<HTMLInputElement>(null);

  const loadPrompts = useCallback(async (value: string) => {
    const trimmed = value.trim();
    const results = trimmed
      ? await window.spellbook.searchSpells(trimmed)
      : await window.spellbook.listPopularSpells(6);
    setSpells(results);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    void loadPrompts(query);
  }, [loadPrompts, query]);

  useEffect(() => {
    const dispose = window.spellbook.onFloatingFocus(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    inputRef.current?.focus();
    return dispose;
  }, []);

  const selected = useMemo(() => spells[selectedIndex] ?? null, [spells, selectedIndex]);

  async function copySpell(spell: Spell): Promise<void> {
    await window.spellbook.copySpell(spell.id);
    setStatus(`${t('status.copied')} ${spell.title}`);
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): Promise<void> {
    if (event.key === 'Escape') {
      event.preventDefault();
      await window.spellbook.closeFloatingWindow();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) => Math.min(current + 1, Math.max(spells.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter' && selected) {
      event.preventDefault();
      await copySpell(selected);
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
        {spells.map((spell, index) => (
          <button
            className={index === selectedIndex ? 'floating-row selected' : 'floating-row'}
            key={spell.id}
            onClick={() => {
              setSelectedIndex(index);
              void copySpell(spell);
            }}
            type="button"
          >
            <span>
              <strong>{spell.title}</strong>
              <small>{spell.description}</small>
            </span>
            <Clipboard size={15} />
          </button>
        ))}
        {spells.length === 0 ? <div className="floating-empty">{t('floating.noResult')}</div> : null}
      </section>
    </main>
  );
}
