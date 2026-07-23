import { Clipboard, Heart, Pin, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Spell } from '../../shared/types';
import { getNextFloatingSelectionIndex } from '../floatingKeyboard';
import type { TFunction } from '../i18n';
import {
  filterSpells,
  getSpellFilterTags,
  type SearchScope,
  type SpellStatusFilter
} from '../spellSearch';
import { deriveSpellName, getSpellDisplayText } from '../spellDisplay';
import { sortSpells } from '../spellSort';
import { useFeedbackToast } from './FeedbackToast';
import { SpellSearchFilter } from './SpellSearchFilter';

interface FloatingPanelProps {
  t: TFunction;
}

export function FloatingPanel({ t }: FloatingPanelProps) {
  const [query, setQuery] = useState('');
  const [spells, setSpells] = useState<Spell[]>([]);
  const [selectedSpellId, setSelectedSpellId] = useState<string | null>(null);
  const [isPinned, setIsPinned] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>('title-content');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<SpellStatusFilter>('active');
  const [selectionAnnouncement, setSelectionAnnouncement] = useState('');
  const { showToast } = useFeedbackToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastAnnouncementRef = useRef('');

  const loadSpells = useCallback(async () => {
    setSpells(await window.spellbook.listSpells());
  }, []);

  const syncFloatingWindowState = useCallback(async () => {
    const state = await window.spellbook.getFloatingWindowState();
    setIsPinned(state.pinned);
  }, []);

  useEffect(() => {
    void loadSpells();
    void syncFloatingWindowState();
  }, [loadSpells, syncFloatingWindowState]);

  useEffect(() => {
    const dispose = window.spellbook.onFloatingFocus(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
      void loadSpells();
      void syncFloatingWindowState();
    });
    inputRef.current?.focus();
    return dispose;
  }, [loadSpells, syncFloatingWindowState]);

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
    return sortSpells(filtered, 'usage', 'desc', (spell) => getFloatingSpellName(spell, t));
  }, [query, searchScope, selectedTags, spells, statusFilter, t]);

  useEffect(() => {
    setSelectedSpellId(null);
  }, [query, searchScope, selectedTags, statusFilter]);

  const selectedIndex = useMemo(() => {
    const index = visibleSpells.findIndex((spell) => spell.id === selectedSpellId);
    return index >= 0 ? index : 0;
  }, [selectedSpellId, visibleSpells]);
  const selected = useMemo(() => visibleSpells[selectedIndex] ?? null, [visibleSpells, selectedIndex]);

  useEffect(() => {
    if (!selected) {
      lastAnnouncementRef.current = '';
      setSelectionAnnouncement('');
      return;
    }
    const announcementKey = `${selected.id}:${selectedIndex}:${visibleSpells.length}`;
    if (announcementKey !== lastAnnouncementRef.current) {
      lastAnnouncementRef.current = announcementKey;
      setSelectionAnnouncement(
        `${getFloatingSpellName(selected, t)}, ${selectedIndex + 1}/${visibleSpells.length}`
      );
    }
  }, [selected, selectedIndex, t, visibleSpells.length]);

  async function copySpell(spell: Spell): Promise<void> {
    await window.spellbook.copySpell(spell.id);
    setSelectedSpellId(spell.id);
    setSpells((current) =>
      current.map((item) =>
        item.id === spell.id ? { ...item, copyCount: item.copyCount + 1 } : item
      )
    );
    if (isPinned) {
      showToast(t('status.copied'));
    }
  }

  async function toggleFavorite(spell: Spell): Promise<void> {
    const nextFavorite = !spell.isFavorite;
    await window.spellbook.updateSpellState(spell.id, { isFavorite: nextFavorite });
    setSpells((current) =>
      current.map((item) =>
        item.id === spell.id ? { ...item, isFavorite: nextFavorite } : item
      )
    );
    showToast(t(nextFavorite ? 'spell.favorited' : 'spell.unfavorited'));
  }

  async function togglePinned(): Promise<void> {
    const state = await window.spellbook.setFloatingWindowPinned(!isPinned);
    setIsPinned(state.pinned);
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): Promise<void> {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      await window.spellbook.closeFloatingWindow();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const nextIndex = getNextFloatingSelectionIndex(
        selectedIndex,
        visibleSpells.length,
        'next'
      );
      setSelectedSpellId(visibleSpells[nextIndex]?.id ?? null);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const nextIndex = getNextFloatingSelectionIndex(
        selectedIndex,
        visibleSpells.length,
        'previous'
      );
      setSelectedSpellId(visibleSpells[nextIndex]?.id ?? null);
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
      <header className="floating-titlebar">
        <span className="floating-titlebar-title">{t('floating.title')}</span>
        <div className="floating-titlebar-controls">
          <button
            aria-label={t(isPinned ? 'floating.unpin' : 'floating.pin')}
            aria-pressed={isPinned}
            className={isPinned ? 'floating-titlebar-button active' : 'floating-titlebar-button'}
            onClick={() => void togglePinned()}
            type="button"
          >
            <Pin fill={isPinned ? 'currentColor' : 'none'} size={15} />
          </button>
          <button
            aria-label={t('floating.close')}
            className="floating-titlebar-button close"
            onClick={() => void window.spellbook.closeFloatingWindow()}
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      </header>
      <div className="floating-content">
        <SpellSearchFilter
          autoFocus
          inputRef={inputRef}
          query={query}
          searchScope={searchScope}
          selectedTags={selectedTags}
          showTooltips={false}
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
        <section aria-label={t('floating.title')} className="floating-results">
          {visibleSpells.map((spell) => (
            <div
              className={spell.id === selected?.id ? 'floating-row selected' : 'floating-row'}
              key={spell.id}
              onMouseEnter={() => setSelectedSpellId(spell.id)}
            >
              <button
                aria-label={`${t('spell.copy')} ${getFloatingSpellName(spell, t)}`}
                className="floating-row-copy"
                onClick={() => void copySpell(spell)}
                type="button"
              >
                <span className="floating-row-identity">
                  <span className="floating-row-name">{getFloatingSpellName(spell, t)}</span>
                  <span className="floating-row-content">{getFloatingSpellSummary(spell)}</span>
                </span>
                <Clipboard size={15} />
              </button>
              <button
                aria-label={t(spell.isFavorite ? 'spell.unfavorite' : 'spell.favorite')}
                aria-pressed={spell.isFavorite}
                className={
                  spell.isFavorite
                    ? 'floating-row-favorite-button active'
                    : 'floating-row-favorite-button'
                }
                onClick={() => void toggleFavorite(spell)}
                type="button"
              >
                <Heart fill={spell.isFavorite ? 'currentColor' : 'none'} size={15} />
              </button>
            </div>
          ))}
          {visibleSpells.length === 0 ? (
            <div className="floating-empty">{t('floating.noResult')}</div>
          ) : null}
        </section>
      </div>
      <ShortcutHintBar hasResults={visibleSpells.length > 0} t={t} />
      <div aria-live="polite" className="sr-only">
        {selectionAnnouncement}
      </div>
    </main>
  );
}

function ShortcutHintBar({ hasResults, t }: { hasResults: boolean; t: TFunction }) {
  const isMac = globalThis.navigator?.platform?.toLowerCase().includes('mac') ?? false;
  return (
    <footer className="floating-shortcut-hints">
      <span aria-disabled={!hasResults} className={!hasResults ? 'unavailable' : undefined}>
        <kbd aria-hidden>↑↓</kbd>
        {t('floating.hint.select')}
        {!hasResults ? <span className="sr-only"> {t('floating.hint.unavailable')}</span> : null}
      </span>
      <span aria-disabled={!hasResults} className={!hasResults ? 'unavailable' : undefined}>
        <kbd aria-hidden>{isMac ? '↩' : 'Enter'}</kbd>
        {t('floating.hint.copy')}
        {!hasResults ? <span className="sr-only"> {t('floating.hint.unavailable')}</span> : null}
      </span>
      <span>
        <kbd aria-hidden>{isMac ? 'esc' : 'Esc'}</kbd>
        {t('floating.hint.close')}
      </span>
    </footer>
  );
}

function getFloatingSpellName(spell: Spell, t: TFunction): string {
  return spell.name || deriveSpellName(spell.body, t('spell.untitled'));
}

function getFloatingSpellSummary(spell: Spell): string {
  return getSpellDisplayText(spell).replace(/\s+/g, ' ').trim();
}
