import { Check, Clipboard, Plus, Search, Tags, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Spell } from '../../shared/types';
import type { TFunction } from '../i18n';
import { deriveSpellName, getSpellDisplayText } from '../spellDisplay';
import { sortSpells, type SpellSortMode } from '../spellSort';
import { useFeedbackToast } from './FeedbackToast';
import { SpellSortMenu } from './SpellSortMenu';

interface SpellPanelProps {
  spells: Spell[];
  onCreateSpell(): void;
  onChanged(): Promise<void>;
  t: TFunction;
}

interface TraitFilterMenuProps {
  tags: string[];
  selectedTags: string[];
  onClear(): void;
  onToggle(tag: string): void;
  t: TFunction;
}

export function SpellPanel({ spells, onCreateSpell, onChanged, t }: SpellPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(spells[0]?.id ?? null);
  const [sortMode, setSortMode] = useState<SpellSortMode>('usage');
  const { showToast } = useFeedbackToast();

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const spell of spells) {
      for (const tag of spell.tags) {
        tags.add(tag);
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [spells]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredSpells = spells.filter((spell) => {
      const matchesQuery =
        !normalizedQuery ||
        getSpellName(spell, t).toLowerCase().includes(normalizedQuery) ||
        spell.body.toLowerCase().includes(normalizedQuery) ||
        spell.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
      const matchesTags =
        selectedTags.length === 0 || selectedTags.every((tag) => spell.tags.includes(tag));
      return matchesQuery && matchesTags;
    });
    return sortSpells(filteredSpells, sortMode, (spell) => getSpellName(spell, t));
  }, [spells, query, selectedTags, sortMode, t]);

  const selected = filtered.find((spell) => spell.id === selectedId) ?? filtered[0] ?? null;

  async function copySelected(spell: Spell): Promise<void> {
    await window.spellbook.copySpell(spell.id);
    showToast(t('status.copied'));
    await onChanged();
  }

  function toggleFilterTag(tag: string): void {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  }

  return (
    <section className="panel-grid">
      <div className="search-pane">
        <div className="quick-panel-controls">
          <label className="search-box">
            <Search size={18} />
            <input
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('spell.placeholder')}
              value={query}
            />
          </label>
          <TraitFilterMenu
            tags={allTags}
            selectedTags={selectedTags}
            onClear={() => setSelectedTags([])}
            onToggle={toggleFilterTag}
            t={t}
          />
          <SpellSortMenu t={t} value={sortMode} onChange={setSortMode} variant="button" />
          <button
            aria-label={t('spell.new')}
            className="secondary-button new-spell-button"
            onClick={onCreateSpell}
            title={t('spell.new')}
            type="button"
          >
            <Plus size={16} />
            <span>{t('spell.new')}</span>
          </button>
        </div>
        <div className="result-list">
          {filtered.map((spell) => (
            <button
              className={selected?.id === spell.id ? 'result-row selected' : 'result-row'}
              key={spell.id}
              onClick={() => setSelectedId(spell.id)}
              type="button"
            >
              <span className="spell-result-name" title={getSpellName(spell, t)}>
                {getSpellName(spell, t)}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="detail-pane">
        {selected ? (
          <>
            <div className="detail-heading">
              <div className="detail-title" />
              <div className="button-row">
                <button className="primary-button" onClick={() => copySelected(selected)} type="button">
                  <Clipboard size={16} />
                  {t('spell.copy')}
                </button>
              </div>
            </div>
            <pre className="spell-preview">{getSpellDisplayText(selected)}</pre>
          </>
        ) : (
          <div className="empty-state">{t('spell.empty')}</div>
        )}
      </div>
    </section>
  );
}

function TraitFilterMenu({ tags, selectedTags, onClear, onToggle, t }: TraitFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [traitFilterQuery, setTraitFilterQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const visibleTags = useMemo(() => {
    const normalizedQuery = traitFilterQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return tags;
    }
    return tags.filter((tag) => tag.toLowerCase().includes(normalizedQuery));
  }, [tags, traitFilterQuery]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!tags.length) {
    return null;
  }

  return (
    <div className="trait-filter-menu-root" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className={selectedTags.length ? 'secondary-button trait-filter-button active' : 'secondary-button trait-filter-button'}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <Tags size={15} />
        <span>{selectedTags.length ? `${t('spell.tags')} ${selectedTags.length}` : t('spell.tags')}</span>
      </button>
      {open ? (
        <div className="trait-filter-popover" role="menu" aria-label={t('spell.tags')}>
          <label className="trait-filter-search">
            <Search size={14} />
            <input
              autoFocus
              onChange={(event) => setTraitFilterQuery(event.target.value)}
              placeholder={t('spell.tagPlaceholder')}
              value={traitFilterQuery}
            />
          </label>
          <div className="trait-filter-actions">
            <button disabled={!selectedTags.length} onClick={onClear} type="button">
              <X size={12} />
              <span>{t('spell.allTags')}</span>
            </button>
          </div>
          <div className="trait-filter-list">
            {visibleTags.map((tag) => {
              const selected = selectedTags.includes(tag);
              return (
                <button
                  aria-checked={selected}
                  className={selected ? 'trait-filter-option selected' : 'trait-filter-option'}
                  key={tag}
                  onClick={() => onToggle(tag)}
                  role="menuitemcheckbox"
                  title={tag}
                  type="button"
                >
                  <span>{tag}</span>
                  {selected ? <Check size={14} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getSpellName(spell: Spell, t: TFunction): string {
  return spell.name || deriveSpellName(spell.body, t('spell.untitled'));
}
