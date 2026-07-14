import { Clipboard, Heart, Search } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Spell } from '../../shared/types';
import type { TFunction } from '../i18n';
import { deriveSpellName, getSpellDisplayText } from '../spellDisplay';
import { sortSpells, type SpellSortDirection, type SpellSortMode } from '../spellSort';
import { useFeedbackToast } from './FeedbackToast';
import { SpellSortMenu } from './SpellSortMenu';

interface FloatingPanelProps {
  t: TFunction;
}

export function FloatingPanel({ t }: FloatingPanelProps) {
  const [query, setQuery] = useState('');
  const [spells, setSpells] = useState<Spell[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sortMode, setSortMode] = useState<SpellSortMode>('usage');
  const [sortDirection, setSortDirection] = useState<SpellSortDirection>('desc');
  const { showToast } = useFeedbackToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const loadPrompts = useCallback(async (value: string) => {
    const trimmed = value.trim();
    const results = trimmed
      ? await window.spellbook.searchSpells(trimmed)
      : await window.spellbook.listSpells();
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

  const visibleSpells = useMemo(() => {
    const sorted = sortSpells(
      spells,
      sortMode,
      sortDirection,
      (spell) => getFloatingSpellName(spell, t)
    );
    return query.trim() ? sorted : sorted.slice(0, 5);
  }, [query, sortMode, sortDirection, spells, t]);
  const selected = useMemo(() => visibleSpells[selectedIndex] ?? null, [visibleSpells, selectedIndex]);

  async function copySpell(spell: Spell): Promise<void> {
    await window.spellbook.copySpell(spell.id);
    showToast(t('status.copied'));
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): Promise<void> {
    if (event.key === 'Escape') {
      event.preventDefault();
      await window.spellbook.closeFloatingWindow();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) => Math.min(current + 1, Math.max(visibleSpells.length - 1, 0)));
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
      <div className="floating-search-row">
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
        <SpellSortMenu
          t={t}
          value={sortMode}
          direction={sortDirection}
          onChange={(value) => {
            setSortMode(value);
            setSelectedIndex(0);
          }}
          onDirectionChange={(value) => {
            setSortDirection(value);
            setSelectedIndex(0);
          }}
          variant="icon"
        />
      </div>
      <section className="floating-results">
        {visibleSpells.map((spell, index) => (
          <button
            className={index === selectedIndex ? 'floating-row selected' : 'floating-row'}
            key={spell.id}
            onClick={() => {
              setSelectedIndex(index);
              void copySpell(spell);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
            type="button"
          >
            <span className="floating-row-name" title={getFloatingSpellName(spell, t)}>
              {getFloatingSpellName(spell, t)}
            </span>
            <span className="floating-row-actions">
              {spell.isFavorite ? <Heart className="floating-row-favorite" fill="currentColor" size={14} /> : null}
              <Clipboard size={15} />
            </span>
          </button>
        ))}
        {visibleSpells.length === 0 ? <div className="floating-empty">{t('floating.noResult')}</div> : null}
      </section>
      {selected ? (
        <section className="floating-preview" aria-label={t('spell.body')}>
          <pre>{getSpellDisplayText(selected)}</pre>
        </section>
      ) : null}
    </main>
  );
}

function getFloatingSpellName(spell: Spell, t: TFunction): string {
  return spell.name || deriveSpellName(spell.body, t('spell.untitled'));
}
