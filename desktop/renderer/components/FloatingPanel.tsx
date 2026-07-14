import { Clipboard, Heart } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Spell } from '../../shared/types';
import type { TFunction } from '../i18n';
import {
  filterSpells,
  getSpellFilterTags,
  type SearchScope,
  type SpellStatusFilter
} from '../spellSearch';
import { deriveSpellName, getSpellDisplayText } from '../spellDisplay';
import { useFeedbackToast } from './FeedbackToast';
import { SpellSearchFilter } from './SpellSearchFilter';

interface FloatingPanelProps {
  t: TFunction;
}

export function FloatingPanel({ t }: FloatingPanelProps) {
  const [query, setQuery] = useState('');
  const [spells, setSpells] = useState<Spell[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchScope, setSearchScope] = useState<SearchScope>('title-content');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<SpellStatusFilter>('active');
  const { showToast } = useFeedbackToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSpells = useCallback(async () => {
    setSpells(await window.spellbook.listSpells());
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    void loadSpells();
  }, [loadSpells]);

  useEffect(() => {
    const dispose = window.spellbook.onFloatingFocus(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
      void loadSpells();
    });
    inputRef.current?.focus();
    return dispose;
  }, [loadSpells]);

  const allTags = useMemo(() => getSpellFilterTags(spells, statusFilter), [spells, statusFilter]);

  useEffect(() => {
    const availableTags = new Set(allTags);
    setSelectedTags((current) => current.filter((tag) => availableTags.has(tag)));
  }, [allTags]);

  const visibleSpells = useMemo(() => {
    const filtered = filterSpells(
      spells,
      { query, searchScope, selectedTags, statusFilter },
      (spell) => getFloatingSpellName(spell, t)
    );
    const hasActiveFilters =
      query.trim().length > 0 ||
      searchScope !== 'title-content' ||
      selectedTags.length > 0 ||
      statusFilter !== 'active';
    return hasActiveFilters ? filtered : filtered.slice(0, 5);
  }, [query, searchScope, selectedTags, spells, statusFilter, t]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, searchScope, selectedTags, statusFilter]);

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

  function toggleFilterTag(tag: string): void {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  }

  return (
    <main className="floating-shell">
      <SpellSearchFilter
        autoFocus
        inputRef={inputRef}
        query={query}
        searchScope={searchScope}
        selectedTags={selectedTags}
        statusFilter={statusFilter}
        tags={allTags}
        onClearTags={() => setSelectedTags([])}
        onInputKeyDown={(event) => void handleKeyDown(event)}
        onQueryChange={setQuery}
        onScopeChange={setSearchScope}
        onStatusChange={setStatusFilter}
        onToggleTag={toggleFilterTag}
        t={t}
      />
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
            <span className="floating-row-identity">
              <span className="floating-row-name" title={getFloatingSpellName(spell, t)}>
                {getFloatingSpellName(spell, t)}
              </span>
              <span className="floating-row-content">{getFloatingSpellSummary(spell)}</span>
            </span>
            <span className="floating-row-actions">
              {spell.isFavorite ? <Heart className="floating-row-favorite" fill="currentColor" size={14} /> : null}
              <Clipboard size={15} />
            </span>
          </button>
        ))}
        {visibleSpells.length === 0 ? <div className="floating-empty">{t('floating.noResult')}</div> : null}
      </section>
    </main>
  );
}

function getFloatingSpellName(spell: Spell, t: TFunction): string {
  return spell.name || deriveSpellName(spell.body, t('spell.untitled'));
}

function getFloatingSpellSummary(spell: Spell): string {
  return getSpellDisplayText(spell).replace(/\s+/g, ' ').trim();
}
