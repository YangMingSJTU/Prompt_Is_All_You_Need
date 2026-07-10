import { ArrowDown, ArrowUp, ArrowUpDown, Clipboard } from 'lucide-react';
import {
  useMemo,
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
import { deriveSpellName, getSpellDisplayText } from '../spellDisplay';
import { matchesSpellSearch, type SearchScope } from '../spellSearch';
import { calculateSplitRatio, clampSplitRatio, type SplitPaneConstraints } from '../splitPane';
import {
  DEFAULT_SORT_DIRECTIONS,
  sortSpells,
  type SpellSortDirection,
  type SpellSortMode
} from '../spellSort';
import { useFeedbackToast } from './FeedbackToast';
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
  const [sortMode, setSortMode] = useState<SpellSortMode | null>(null);
  const [sortDirection, setSortDirection] = useState<SpellSortDirection | null>(null);
  const [searchScope, setSearchScope] = useState<SearchScope>('title-content');
  const [splitRatio, setSplitRatio] = useState(60);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const resizingRef = useRef(false);
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
    if (!sortMode || !sortDirection) {
      return filteredSpells;
    }
    return sortSpells(filteredSpells, sortMode, sortDirection, (spell) => getSpellName(spell, t));
  }, [spells, query, searchScope, selectedTags, sortMode, sortDirection, t]);

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

  function selectRowWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>, spellId: string): void {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    setSelectedId(spellId);
  }

  function toggleSort(nextMode: SpellSortMode): void {
    const defaultDirection = DEFAULT_SORT_DIRECTIONS[nextMode];
    if (sortMode !== nextMode) {
      setSortMode(nextMode);
      setSortDirection(defaultDirection);
      return;
    }
    if (sortDirection === defaultDirection) {
      setSortDirection(defaultDirection === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortMode(null);
    setSortDirection(null);
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
            tags={allTags}
            onClearTags={() => setSelectedTags([])}
            onQueryChange={setQuery}
            onScopeChange={setSearchScope}
            onToggleTag={toggleFilterTag}
            t={t}
          />
        </div>
        <div className="result-list">
          {filtered.length ? (
            <div className="result-list-header">
              <SortHeaderButton
                label={t('spell.name')}
                mode="name"
                sortDirection={sortDirection}
                sortMode={sortMode}
                onSort={toggleSort}
              />
              <SortHeaderButton
                label={t('spell.updatedAt')}
                mode="updated"
                sortDirection={sortDirection}
                sortMode={sortMode}
                onSort={toggleSort}
              />
              <SortHeaderButton
                label={t('spell.usageCount')}
                mode="usage"
                sortDirection={sortDirection}
                sortMode={sortMode}
                onSort={toggleSort}
              />
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
              </div>
              <span className="spell-result-updated" title={formatUpdatedAtTitle(spell.updatedAt)}>
                {formatUpdatedAt(spell.updatedAt)}
              </span>
              <span className="spell-result-usage">{spell.copyCount}</span>
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
      <div
        aria-label={t('spell.resizePanels')}
        aria-orientation="vertical"
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

function SortHeaderButton({
  label,
  mode,
  sortMode,
  sortDirection,
  onSort
}: {
  label: string;
  mode: SpellSortMode;
  sortMode: SpellSortMode | null;
  sortDirection: SpellSortDirection | null;
  onSort(mode: SpellSortMode): void;
}) {
  const active = sortMode === mode && sortDirection !== null;
  const isDefaultDirection = sortDirection === DEFAULT_SORT_DIRECTIONS[mode];
  const Icon = active ? (isDefaultDirection ? ArrowDown : ArrowUp) : ArrowUpDown;

  return (
    <button
      aria-pressed={active}
      className={active ? 'result-sort-header active' : 'result-sort-header'}
      onClick={() => onSort(mode)}
      title={label}
      type="button"
    >
      <span>{label}</span>
      <Icon size={13} />
    </button>
  );
}

function renderSpellTraits(spell: Spell) {
  if (!spell.tags.length) {
    return null;
  }

  return (
    <div className="spell-result-traits">
      {spell.tags.map((tag) => (
        <span className="spell-result-trait" key={tag} title={tag}>
          {tag}
        </span>
      ))}
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

function getSpellName(spell: Spell, t: TFunction): string {
  return spell.name || deriveSpellName(spell.body, t('spell.untitled'));
}
