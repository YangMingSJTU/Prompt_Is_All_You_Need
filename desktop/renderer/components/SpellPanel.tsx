import { Check, Clipboard, Funnel, FunnelX, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { Spell } from '../../shared/types';
import type { I18nKey, TFunction } from '../i18n';
import { deriveSpellName, getSpellDisplayText } from '../spellDisplay';
import { matchesSpellSearch, type SearchScope } from '../spellSearch';
import { sortSpells, type SpellSortDirection, type SpellSortMode } from '../spellSort';
import { useFeedbackToast } from './FeedbackToast';
import { SpellSortMenu } from './SpellSortMenu';

interface SpellPanelProps {
  spells: Spell[];
  onChanged(): Promise<void>;
  t: TFunction;
}

interface SpellFilterMenuProps {
  tags: string[];
  selectedTags: string[];
  searchScope: SearchScope;
  onClearTags(): void;
  onScopeChange(value: SearchScope): void;
  onToggleTag(tag: string): void;
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
  const [sortDirection, setSortDirection] = useState<SpellSortDirection>('desc');
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
    return sortSpells(filteredSpells, sortMode, sortDirection, (spell) => getSpellName(spell, t));
  }, [spells, query, searchScope, selectedTags, sortMode, sortDirection, t]);

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
          <div className="quick-panel-search-group">
            <label className="search-box">
              <Search size={18} />
              <input
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder={searchPlaceholder}
                value={query}
              />
            </label>
            <SpellFilterMenu
              tags={allTags}
              selectedTags={selectedTags}
              searchScope={searchScope}
              onClearTags={() => setSelectedTags([])}
              onScopeChange={setSearchScope}
              onToggleTag={toggleFilterTag}
              t={t}
            />
          </div>
          <SpellSortMenu
            className="quick-panel-sort"
            t={t}
            value={sortMode}
            direction={sortDirection}
            onChange={setSortMode}
            onDirectionChange={setSortDirection}
            variant="button"
          />
        </div>
        <div className="result-list">
          {filtered.length ? (
            <div className="result-list-header" aria-hidden="true">
              <span>{t('spell.name')}</span>
              <span>{t('spell.usageCount')}</span>
              <span>{t('spell.updatedAt')}</span>
              <span />
            </div>
          ) : null}
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
                <div className="spell-result-title-row">
                  <span className="spell-result-name" title={getSpellName(spell, t)}>
                    {getSpellName(spell, t)}
                  </span>
                  {renderSpellTraits(spell)}
                </div>
                <span className="spell-result-text" title={getSpellDisplayText(spell)}>
                  {getSpellDisplayText(spell)}
                </span>
              </div>
              <span className="spell-result-usage">{spell.copyCount}</span>
              <span className="spell-result-updated" title={formatUpdatedAtTitle(spell.updatedAt)}>
                {formatUpdatedAt(spell.updatedAt)}
              </span>
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

function SpellFilterMenu({
  tags,
  selectedTags,
  searchScope,
  onClearTags,
  onScopeChange,
  onToggleTag,
  t
}: SpellFilterMenuProps) {
  const [open, setOpen] = useState(false);
  const [traitFilterQuery, setTraitFilterQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const hasActiveFilters = searchScope !== 'title-content' || selectedTags.length > 0;

  const visibleTags = useMemo(() => {
    const normalizedQuery = traitFilterQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return tags;
    }
    return tags.filter((tag) => tag.toLowerCase().includes(normalizedQuery));
  }, [tags, traitFilterQuery]);

  function closeFilterMenu(): void {
    setOpen(false);
    setTraitFilterQuery('');
  }

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeFilterMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        closeFilterMenu();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function resetFilters(): void {
    onScopeChange('title-content');
    onClearTags();
    setTraitFilterQuery('');
  }

  return (
    <div className="spell-filter-menu-root" ref={rootRef}>
      <button
        aria-controls="spell-filter-popover"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('spell.filter')}
        className={hasActiveFilters ? 'spell-filter-button active' : 'spell-filter-button'}
        onClick={() => (open ? closeFilterMenu() : setOpen(true))}
        title={t('spell.filter')}
        type="button"
      >
        <Funnel size={16} />
      </button>
      {open ? (
        <div
          aria-label={t('spell.filter')}
          className="spell-filter-popover"
          id="spell-filter-popover"
          role="dialog"
        >
          <section className="spell-filter-section">
            <div className="spell-filter-heading">{t('spell.filter.searchScope')}</div>
            <div
              aria-label={t('spell.filter.searchScope')}
              className="spell-filter-scope-options"
              role="radiogroup"
            >
              {SEARCH_SCOPE_OPTIONS.map((option) => (
                <button
                  aria-checked={searchScope === option.value}
                  className={searchScope === option.value ? 'spell-filter-scope-option selected' : 'spell-filter-scope-option'}
                  key={option.value}
                  onClick={() => onScopeChange(option.value)}
                  role="radio"
                  type="button"
                >
                  <span>{t(option.labelKey)}</span>
                  {searchScope === option.value ? <Check size={14} /> : null}
                </button>
              ))}
            </div>
          </section>
          <section aria-label={t('spell.tags')} className="spell-filter-section" role="group">
            <div className="spell-filter-heading">{t('spell.tags')}</div>
            <label className="spell-filter-search">
              <Search size={14} />
              <input
                onChange={(event) => setTraitFilterQuery(event.target.value)}
                placeholder={t('spell.tagPlaceholder')}
                value={traitFilterQuery}
              />
            </label>
            <div className="spell-filter-trait-list">
              {visibleTags.length ? (
                visibleTags.map((tag) => {
                  const selected = selectedTags.includes(tag);
                  return (
                    <button
                      aria-checked={selected}
                      className={selected ? 'spell-filter-trait-option selected' : 'spell-filter-trait-option'}
                      key={tag}
                      onClick={() => onToggleTag(tag)}
                      role="checkbox"
                      title={tag}
                      type="button"
                    >
                      <span>{tag}</span>
                      {selected ? <Check size={14} /> : null}
                    </button>
                  );
                })
              ) : (
                <div className="spell-filter-empty">{t('spell.filter.noTraits')}</div>
              )}
            </div>
          </section>
          <div className="spell-filter-footer">
            <button
              disabled={!hasActiveFilters && !traitFilterQuery}
              onClick={resetFilters}
              type="button"
            >
              <FunnelX size={14} />
              <span>{t('spell.filter.clear')}</span>
            </button>
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
    return null;
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

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return date.toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' });
}

function formatUpdatedAtTitle(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
}

function getSearchScopeOption(scope: SearchScope) {
  return SEARCH_SCOPE_OPTIONS.find((option) => option.value === scope) ?? SEARCH_SCOPE_OPTIONS[0];
}

function getSpellName(spell: Spell, t: TFunction): string {
  return spell.name || deriveSpellName(spell.body, t('spell.untitled'));
}
