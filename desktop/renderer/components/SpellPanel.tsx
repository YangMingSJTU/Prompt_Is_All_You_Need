import { Clipboard, Heart } from 'lucide-react';
import {
  useMemo,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import {
  QUICK_PANEL_MIN_DETAIL_WIDTH,
  QUICK_PANEL_MIN_LIST_WIDTH,
  QUICK_PANEL_MIN_WIDTH,
  QUICK_PANEL_SPLITTER_WIDTH
} from '../../shared/layout';
import type { Spell } from '../../shared/types';
import type { TFunction } from '../i18n';
import {
  formatSpellUpdatedAt,
  formatSpellUpdatedAtTitle,
  getSpellDisplayName,
  getSpellDisplayText
} from '../spellDisplay';
import {
  filterSpells,
  getSpellFilterTags,
  type SearchScope,
  type SpellStatusFilter
} from '../spellSearch';
import { calculateSplitRatio, clampSplitRatio, type SplitPaneConstraints } from '../splitPane';
import {
  DEFAULT_SPELL_TABLE_SORT_STATE,
  getNextSpellTableSortState,
  sortSpellsByTableState,
  type SpellTableSortMode,
  type SpellTableSortState
} from '../spellSort';
import { useFeedbackToast } from './FeedbackToast';
import { SpellIdentity, SpellListSortHeader } from './SpellListPrimitives';
import { SpellSearchFilter } from './SpellSearchFilter';

interface SpellPanelProps {
  spells: Spell[];
  onChanged(): Promise<void>;
  t: TFunction;
}

export function SpellPanel({ spells, onChanged, t }: SpellPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(spells[0]?.id ?? null);
  const [sortState, setSortState] = useState<SpellTableSortState>(DEFAULT_SPELL_TABLE_SORT_STATE);
  const [searchScope, setSearchScope] = useState<SearchScope>('title-content');
  const [statusFilter, setStatusFilter] = useState<SpellStatusFilter>('active');
  const [splitRatio, setSplitRatio] = useState(60);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const resizingRef = useRef(false);
  const { showToast } = useFeedbackToast();

  const allTags = useMemo(() => getSpellFilterTags(spells, statusFilter), [spells, statusFilter]);

  useEffect(() => {
    const availableTags = new Set(allTags);
    setSelectedTags((current) => current.filter((tag) => availableTags.has(tag)));
  }, [allTags]);

  const filtered = useMemo(() => {
    const filteredSpells = filterSpells(
      spells,
      { query, searchScope, selectedTags, statusFilter },
      (spell) => getSpellDisplayName(spell, t('spell.untitled'))
    );
    return sortSpellsByTableState(filteredSpells, sortState, (spell) =>
      getSpellDisplayName(spell, t('spell.untitled'))
    );
  }, [spells, query, searchScope, selectedTags, sortState, statusFilter, t]);

  const selected = filtered.find((spell) => spell.id === selectedId) ?? filtered[0] ?? null;
  async function copySelected(spell: Spell): Promise<void> {
    await window.spellbook.copySpell(spell.id);
    showToast(t('status.copied'));
    await onChanged();
  }

  async function toggleFavorite(spell: Spell): Promise<void> {
    const nextFavorite = !spell.isFavorite;
    await window.spellbook.updateSpellState(spell.id, { isFavorite: nextFavorite });
    showToast(t(nextFavorite ? 'spell.favorited' : 'spell.unfavorited'));
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

  function toggleSort(nextMode: SpellTableSortMode): void {
    setSortState((current) => getNextSpellTableSortState(current, nextMode));
  }

  function getSplitConstraints(): SplitPaneConstraints | null {
    const panel = panelRef.current;
    if (!panel) {
      return null;
    }
    return {
      containerWidth: panel.getBoundingClientRect().width,
      dividerWidth: QUICK_PANEL_SPLITTER_WIDTH,
      minStartWidth: QUICK_PANEL_MIN_LIST_WIDTH,
      minEndWidth: QUICK_PANEL_MIN_DETAIL_WIDTH
    };
  }

  function updateSplitFromPointer(clientX: number): void {
    const panel = panelRef.current;
    const constraints = getSplitConstraints();
    if (!panel || !constraints) {
      return;
    }
    setSplitRatio(calculateSplitRatio(clientX, panel.getBoundingClientRect().left, constraints));
  }

  function startResizing(event: ReactPointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    resizingRef.current = true;
    setIsResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSplitFromPointer(event.clientX);
  }

  function resizeWithPointer(event: ReactPointerEvent<HTMLDivElement>): void {
    if (resizingRef.current) {
      updateSplitFromPointer(event.clientX);
    }
  }

  function stopResizing(event: ReactPointerEvent<HTMLDivElement>): void {
    resizingRef.current = false;
    setIsResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resizeWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    const constraints = getSplitConstraints();
    if (!constraints) {
      return;
    }
    event.preventDefault();
    setSplitRatio((current) => {
      if (event.key === 'Home') {
        return clampSplitRatio(0, constraints);
      }
      if (event.key === 'End') {
        return clampSplitRatio(100, constraints);
      }
      return clampSplitRatio(current + (event.key === 'ArrowLeft' ? -2 : 2), constraints);
    });
  }

  return (
    <section
      className={isResizing ? 'panel-grid resizing' : 'panel-grid'}
      ref={panelRef}
      style={{
        minWidth: QUICK_PANEL_MIN_WIDTH,
        gridTemplateColumns: `minmax(${QUICK_PANEL_MIN_LIST_WIDTH}px, ${splitRatio}fr) ${QUICK_PANEL_SPLITTER_WIDTH}px minmax(${QUICK_PANEL_MIN_DETAIL_WIDTH}px, ${100 - splitRatio}fr)`
      }}
    >
      <div className="search-pane">
        <div className="quick-panel-controls">
          <SpellSearchFilter
            autoFocus
            query={query}
            searchScope={searchScope}
            selectedTags={selectedTags}
            statusFilter={statusFilter}
            tags={allTags}
            onClearTags={() => setSelectedTags([])}
            onQueryChange={setQuery}
            onScopeChange={setSearchScope}
            onStatusChange={setStatusFilter}
            onToggleTag={toggleFilterTag}
            t={t}
          />
        </div>
        <div className="result-list">
          {filtered.length ? (
            <SpellListSortHeader
              className="result-list-header"
              onSort={toggleSort}
              sortState={sortState}
              t={t}
            />
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
                <SpellIdentity
                  name={getSpellDisplayName(spell, t('spell.untitled'))}
                  tags={spell.tags}
                />
              </div>
              <span className="spell-list-updated" title={formatSpellUpdatedAtTitle(spell.updatedAt)}>
                {formatSpellUpdatedAt(spell.updatedAt)}
              </span>
              <span className="spell-list-usage">{spell.copyCount}</span>
              <div className="spell-result-actions">
                <button
                  aria-label={t(spell.isFavorite ? 'spell.unfavorite' : 'spell.favorite')}
                  aria-pressed={spell.isFavorite}
                  className={
                    spell.isFavorite
                      ? 'icon-button spell-favorite-button active'
                      : 'icon-button spell-favorite-button'
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    void toggleFavorite(spell);
                  }}
                  title={t(spell.isFavorite ? 'spell.unfavorite' : 'spell.favorite')}
                  type="button"
                >
                  <Heart fill={spell.isFavorite ? 'currentColor' : 'none'} size={15} />
                </button>
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
      <div
        aria-label={t('spell.resizePanels')}
        aria-orientation="vertical"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(splitRatio)}
        className="quick-spell-resizer"
        onKeyDown={resizeWithKeyboard}
        onLostPointerCapture={stopResizing}
        onPointerDown={startResizing}
        onPointerMove={resizeWithPointer}
        onPointerUp={stopResizing}
        role="separator"
        tabIndex={0}
        title={t('spell.resizePanels')}
      />
      <aside className="quick-spell-detail" aria-label={t('spell.body')}>
        {selected ? (
          <>
            <div className="quick-spell-detail-heading">
              <button
                aria-label={t(selected.isFavorite ? 'spell.unfavorite' : 'spell.favorite')}
                aria-pressed={selected.isFavorite}
                className={
                  selected.isFavorite
                    ? 'secondary-button spell-favorite-button active'
                    : 'secondary-button spell-favorite-button'
                }
                onClick={() => void toggleFavorite(selected)}
                title={t(selected.isFavorite ? 'spell.unfavorite' : 'spell.favorite')}
                type="button"
              >
                <Heart fill={selected.isFavorite ? 'currentColor' : 'none'} size={16} />
              </button>
              <button
                className="secondary-button"
                onClick={() => void copySelected(selected)}
                type="button"
              >
                <Clipboard size={16} />
                {t('spell.copy')}
              </button>
            </div>
            <pre className="quick-spell-preview">{getSpellDisplayText(selected)}</pre>
          </>
        ) : (
          <div className="empty-state">{t('spell.empty')}</div>
        )}
      </aside>
    </section>
  );
}
