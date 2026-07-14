import { Check, Funnel, FunnelX, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { I18nKey, TFunction } from '../i18n';
import type { SearchScope } from '../spellSearch';

export type SpellStatusFilter = 'active' | 'favorite';

interface SpellSearchFilterProps {
  autoFocus?: boolean;
  query: string;
  searchScope: SearchScope;
  selectedTags: string[];
  statusFilter: SpellStatusFilter;
  tags: string[];
  onClearTags(): void;
  onQueryChange(value: string): void;
  onScopeChange(value: SearchScope): void;
  onStatusChange(value: SpellStatusFilter): void;
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

const STATUS_FILTER_OPTIONS: Array<{ value: SpellStatusFilter; labelKey: I18nKey }> = [
  { value: 'active', labelKey: 'spell.filter.status.active' },
  { value: 'favorite', labelKey: 'spell.filter.status.favorite' }
];

export function SpellSearchFilter({
  autoFocus = false,
  query,
  searchScope,
  selectedTags,
  statusFilter,
  tags,
  onClearTags,
  onQueryChange,
  onScopeChange,
  onStatusChange,
  onToggleTag,
  t
}: SpellSearchFilterProps) {
  const [open, setOpen] = useState(false);
  const [traitFilterQuery, setTraitFilterQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const hasActiveFilters =
    searchScope !== 'title-content' || selectedTags.length > 0 || statusFilter !== 'active';
  const searchPlaceholder = t(getSearchScopeOption(searchScope).placeholderKey);

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
    onStatusChange('active');
    onClearTags();
    setTraitFilterQuery('');
  }

  return (
    <div className="spell-search-filter" ref={rootRef}>
      <label className="search-box">
        <Search size={18} />
        <input
          autoFocus={autoFocus}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          value={query}
        />
      </label>
      <div className="spell-filter-menu-root">
        <button
          aria-controls={popoverId}
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
            id={popoverId}
            role="dialog"
          >
            <section className="spell-filter-section">
              <div className="spell-filter-heading">{t('spell.filter.status')}</div>
              <div
                aria-label={t('spell.filter.status')}
                className="spell-filter-scope-options"
                role="radiogroup"
              >
                {STATUS_FILTER_OPTIONS.map((option) => (
                  <button
                    aria-checked={statusFilter === option.value}
                    className={
                      statusFilter === option.value
                        ? 'spell-filter-scope-option selected'
                        : 'spell-filter-scope-option'
                    }
                    key={option.value}
                    onClick={() => onStatusChange(option.value)}
                    role="radio"
                    type="button"
                  >
                    <span>{t(option.labelKey)}</span>
                    {statusFilter === option.value ? <Check size={14} /> : null}
                  </button>
                ))}
              </div>
            </section>
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
                    className={
                      searchScope === option.value
                        ? 'spell-filter-scope-option selected'
                        : 'spell-filter-scope-option'
                    }
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
                        className={
                          selected
                            ? 'spell-filter-trait-option selected'
                            : 'spell-filter-trait-option'
                        }
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
    </div>
  );
}

function getSearchScopeOption(scope: SearchScope) {
  return SEARCH_SCOPE_OPTIONS.find((option) => option.value === scope) ?? SEARCH_SCOPE_OPTIONS[0];
}
