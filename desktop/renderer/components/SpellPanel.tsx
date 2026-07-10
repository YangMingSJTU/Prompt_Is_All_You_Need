import { Check, ChevronDown, Clipboard, Search, Tags, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Spell } from '../../shared/types';
import type { I18nKey, TFunction } from '../i18n';
import { deriveSpellName, getSpellDisplayText } from '../spellDisplay';
import { matchesSpellSearch, type SearchScope } from '../spellSearch';
import { sortSpells, type SpellSortMode } from '../spellSort';
import { useFeedbackToast } from './FeedbackToast';
import { SpellSortMenu } from './SpellSortMenu';

interface SpellPanelProps {
  spells: Spell[];
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

interface SearchScopeMenuProps {
  value: SearchScope;
  onChange(value: SearchScope): void;
  t: TFunction;
}

const SEARCH_SCOPE_OPTIONS: Array<{
  value: SearchScope;
  labelKey: I18nKey;
  placeholderKey: I18nKey;
}> = [
  {
    value: 'title-content',
    labelKey: 'spell.searchScope.titleContent',
    placeholderKey: 'spell.placeholder.titleContent'
  },
  { value: 'title', labelKey: 'spell.searchScope.title', placeholderKey: 'spell.placeholder.title' },
  { value: 'content', labelKey: 'spell.searchScope.content', placeholderKey: 'spell.placeholder.content' }
];

export function SpellPanel({ spells, onChanged, t }: SpellPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(spells[0]?.id ?? null);
  const [sortMode, setSortMode] = useState<SpellSortMode>('usage');
  const [searchScope, setSearchScope] = useState<SearchScope>('title-content');
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
    const filteredSpells = spells.filter((spell) => {
      const name = getSpellName(spell, t);
      const matchesQuery = matchesSpellSearch({ name, body: spell.body }, query, searchScope);
      const matchesTags =
        selectedTags.length === 0 || selectedTags.every((tag) => spell.tags.includes(tag));
      return matchesQuery && matchesTags;
    });
    return sortSpells(filteredSpells, sortMode, (spell) => getSpellName(spell, t));
  }, [spells, query, searchScope, selectedTags, sortMode, t]);

  const selected = filtered.find((spell) => spell.id === selectedId) ?? filtered[0] ?? null;
  const searchPlaceholder = t(getSearchScopeOption(searchScope).placeholderKey);

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

  function selectRowWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>, spellId: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    setSelectedId(spellId);
  }

  return (
    <section className="panel-grid">
      <div className="search-pane">
        <div className="quick-panel-controls">
          <div className="search-scope-control">
            <label className="search-box">
              <Search size={18} />
              <input
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                value={query}
              />
            </label>
            <SearchScopeMenu value={searchScope} onChange={setSearchScope} t={t} />
          </div>
          <div className="quick-panel-actions">
            <TraitFilterMenu
              tags={allTags}
              selectedTags={selectedTags}
              onClear={() => setSelectedTags([])}
              onToggle={toggleFilterTag}
              t={t}
            />
            <SpellSortMenu t={t} value={sortMode} onChange={setSortMode} variant="button" />
          </div>
        </div>
        <div className="result-list">
          {filtered.map((spell) => (
            <div
              className={selected?.id === spell.id ? 'result-row selected' : 'result-row'}
              key={spell.id}
              onClick={() => setSelectedId(spell.id)}
              onKeyDown={(event) => selectRowWithKeyboard(event, spell.id)}
              role="button"
              tabIndex={0}
            >
              <div className="spell-result-main">
                <span className="spell-result-name" title={getSpellName(spell, t)}>
                  {getSpellName(spell, t)}
                </span>
                <span className="spell-result-text" title={getSpellDisplayText(spell)}>
                  {getSpellDisplayText(spell)}
                </span>
              </div>
              {renderSpellTraits(spell)}
              <div className="spell-result-actions">
                <button
                  aria-label={t('spell.copy')}
                  className="icon-button spell-result-copy"
                  onClick={(event) => {
                    event.stopPropagation();
                    void copySelected(spell);
                  }}
                  title={t('spell.copy')}
                  type="button"
                >
                  <Clipboard size={15} />
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 ? <div className="empty-state">{t('spell.empty')}</div> : null}
        </div>
      </div>
    </section>
  );
}

function SearchScopeMenu({ value, onChange, t }: SearchScopeMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentOption = getSearchScopeOption(value);

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

  function selectScope(scope: SearchScope): void {
    onChange(scope);
    setOpen(false);
  }

  return (
    <div className="search-scope-menu-root" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="search-scope-button"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>{t(currentOption.labelKey)}</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div className="search-scope-popover" role="menu">
          {SEARCH_SCOPE_OPTIONS.map((option) => (
            <button
              aria-checked={value === option.value}
              className={value === option.value ? 'search-scope-option selected' : 'search-scope-option'}
              key={option.value}
              onClick={() => selectScope(option.value)}
              role="menuitemradio"
              type="button"
            >
              <span>{t(option.labelKey)}</span>
              {value === option.value ? <Check size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
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

function renderSpellTraits(spell: Spell) {
  const visibleTags = spell.tags.slice(0, 3);
  const hiddenCount = Math.max(spell.tags.length - visibleTags.length, 0);

  if (!visibleTags.length) {
    return <div className="spell-result-traits" />;
  }

  return (
    <div className="spell-result-traits">
      {visibleTags.map((tag) => (
        <span className="spell-result-trait" key={tag} title={tag}>
          {tag}
        </span>
      ))}
      {hiddenCount ? <span className="spell-result-trait-more">+{hiddenCount}</span> : null}
    </div>
  );
}

function getSearchScopeOption(scope: SearchScope) {
  return SEARCH_SCOPE_OPTIONS.find((option) => option.value === scope) ?? SEARCH_SCOPE_OPTIONS[0];
}

function getSpellName(spell: Spell, t: TFunction): string {
  return spell.name || deriveSpellName(spell.body, t('spell.untitled'));
}
