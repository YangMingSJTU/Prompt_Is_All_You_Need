import { Clipboard, Heart, Plus, Save, Trash2 } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import {
  SPELL_LIBRARY_MIN_CANDIDATE_WIDTH,
  SPELL_LIBRARY_MIN_LIST_WIDTH,
  SPELL_LIBRARY_SPLITTER_WIDTH
} from '../../shared/layout';
import type { Candidate, Spell } from '../../shared/types';
import type { TFunction } from '../i18n';
import {
  deriveSpellName,
  formatSpellUpdatedAt,
  formatSpellUpdatedAtTitle,
  getCandidateDisplayText,
  getSpellDisplayName
} from '../spellDisplay';
import { matchesSpellSearch, type SearchScope } from '../spellSearch';
import { calculateSplitRatio, clampSplitRatio, type SplitPaneConstraints } from '../splitPane';
import {
  DEFAULT_SPELL_TABLE_SORT_STATE,
  getNextSpellTableSortState,
  sortSpellsByTableState,
  type SpellTableSortMode,
  type SpellTableSortState
} from '../spellSort';
import { useFeedbackToast } from './FeedbackToast';
import { SpellEditorDialog, type SpellEditorDraft } from './SpellEditorDialog';
import { SpellIdentity, SpellListSortHeader } from './SpellListPrimitives';
import { SpellSearchFilter, type SpellStatusFilter } from './SpellSearchFilter';

interface LibraryViewProps {
  spells: Spell[];
  candidates: Candidate[];
  createRequestId?: number;
  onChanged(): Promise<void>;
  t: TFunction;
}

type EditorState =
  | { mode: 'create'; candidateId?: string; initialDraft?: SpellEditorDraft }
  | { mode: 'edit'; spellId: string };

export function LibraryView({ spells, candidates, createRequestId = 0, onChanged, t }: LibraryViewProps) {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(spells[0]?.id ?? null);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [sortState, setSortState] = useState<SpellTableSortState>(DEFAULT_SPELL_TABLE_SORT_STATE);
  const [searchScope, setSearchScope] = useState<SearchScope>('title-content');
  const [statusFilter, setStatusFilter] = useState<SpellStatusFilter>('active');
  const [selectedSpellIds, setSelectedSpellIds] = useState<string[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [isSavingCandidates, setIsSavingCandidates] = useState(false);
  const [splitRatio, setSplitRatio] = useState(60);
  const [isResizing, setIsResizing] = useState(false);
  const bulkDeleteActionRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const resizingRef = useRef(false);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const selectAllCandidatesCheckboxRef = useRef<HTMLInputElement>(null);
  const { showToast } = useFeedbackToast();

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const spell of spells) {
      const matchesStatus = statusFilter !== 'favorite' || spell.isFavorite;
      if (!matchesStatus) {
        continue;
      }
      for (const tag of spell.tags) {
        tags.add(tag);
      }
    }
    return [...tags].sort((a, b) => a.localeCompare(b));
  }, [spells, statusFilter]);

  const pendingCandidates = useMemo(
    () => candidates.filter((candidate) => candidate.status === 'pending'),
    [candidates]
  );
  const pendingCandidateIds = useMemo(
    () => pendingCandidates.map((candidate) => candidate.id),
    [pendingCandidates]
  );
  const selectedPendingCandidateIds = useMemo(() => {
    const selectedIds = new Set(selectedCandidateIds);
    return pendingCandidateIds.filter((candidateId) => selectedIds.has(candidateId));
  }, [pendingCandidateIds, selectedCandidateIds]);
  const selectedPendingCandidateCount = selectedPendingCandidateIds.length;
  const allPendingCandidatesSelected =
    pendingCandidateIds.length > 0 && selectedPendingCandidateCount === pendingCandidateIds.length;
  const somePendingCandidatesSelected =
    selectedPendingCandidateCount > 0 && !allPendingCandidatesSelected;

  useEffect(() => {
    const availableTags = new Set(allTags);
    setSelectedTags((current) => current.filter((tag) => availableTags.has(tag)));
  }, [allTags]);

  const filteredSpells = useMemo(() => {
    const filtered = spells.filter((spell) => {
      const matchesStatus = statusFilter !== 'favorite' || spell.isFavorite;
      const matchesQuery = matchesSpellSearch(
        { name: getSpellDisplayName(spell, t('spell.untitled')), body: spell.body },
        query,
        searchScope
      );
      const matchesTags =
        selectedTags.length === 0 || selectedTags.every((tag) => spell.tags.includes(tag));
      return matchesStatus && matchesQuery && matchesTags;
    });
    return sortSpellsByTableState(filtered, sortState, (spell) =>
      getSpellDisplayName(spell, t('spell.untitled'))
    );
  }, [query, searchScope, selectedTags, sortState, spells, statusFilter, t]);
  const filteredSpellIds = useMemo(() => filteredSpells.map((spell) => spell.id), [filteredSpells]);
  const selectedVisibleSpellCount = useMemo(() => {
    const selectedIds = new Set(selectedSpellIds);
    return filteredSpellIds.filter((spellId) => selectedIds.has(spellId)).length;
  }, [filteredSpellIds, selectedSpellIds]);
  const allFilteredSpellsSelected =
    filteredSpellIds.length > 0 && selectedVisibleSpellCount === filteredSpellIds.length;
  const someFilteredSpellsSelected =
    selectedVisibleSpellCount > 0 && !allFilteredSpellsSelected;

  const selectedSpell = useMemo(
    () => spells.find((spell) => spell.id === selectedId) ?? null,
    [selectedId, spells]
  );
  const editingSpell = useMemo(
    () =>
      editorState?.mode === 'edit'
        ? spells.find((spell) => spell.id === editorState.spellId) ?? null
        : null,
    [editorState, spells]
  );

  useEffect(() => {
    const visibleIds = new Set(filteredSpellIds);
    setSelectedSpellIds((current) => {
      const next = current.filter((spellId) => visibleIds.has(spellId));
      return next.length === current.length ? current : next;
    });
  }, [filteredSpellIds]);

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someFilteredSpellsSelected;
    }
  }, [someFilteredSpellsSelected]);

  useEffect(() => {
    const pendingIds = new Set(pendingCandidateIds);
    setSelectedCandidateIds((current) => {
      const next = current.filter((candidateId) => pendingIds.has(candidateId));
      return next.length === current.length ? current : next;
    });
  }, [pendingCandidateIds]);

  useEffect(() => {
    if (selectAllCandidatesCheckboxRef.current) {
      selectAllCandidatesCheckboxRef.current.indeterminate = somePendingCandidatesSelected;
    }
  }, [somePendingCandidatesSelected]);

  useEffect(() => {
    if (selectedVisibleSpellCount === 0) {
      setConfirmingBulkDelete(false);
    }
  }, [selectedVisibleSpellCount]);

  useEffect(() => {
    if (!confirmingBulkDelete) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      const container = bulkDeleteActionRef.current;
      if (container && event.target instanceof Node && !container.contains(event.target)) {
        setConfirmingBulkDelete(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setConfirmingBulkDelete(false);
      }
    }

    function handleWindowBlur(): void {
      setConfirmingBulkDelete(false);
    }

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [confirmingBulkDelete]);

  useEffect(() => {
    if (filteredSpells.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !filteredSpells.some((spell) => spell.id === selectedId)) {
      setSelectedId(filteredSpells[0].id);
    }
  }, [filteredSpells, selectedId]);

  useEffect(() => {
    if (editorState?.mode === 'edit' && !editingSpell) {
      setEditorState(null);
    }
  }, [editingSpell, editorState]);

  useEffect(() => {
    if (!createRequestId) {
      return;
    }
    openNewSpellEditor();
  }, [createRequestId]);

  async function copy(spell: Spell): Promise<void> {
    await window.spellbook.copySpell(spell.id);
    showToast(t('status.copied'));
    await onChanged();
  }

  async function saveEditorDraft(draft: SpellEditorDraft): Promise<void> {
    if (editorState?.mode === 'create') {
      const input = {
        name: draft.name.trim() || deriveSpellName(draft.body, t('spell.untitled')),
        body: draft.body,
        tags: draft.tags
      };
      const spell = editorState.candidateId
        ? await window.spellbook.createSpellFromCandidate(editorState.candidateId, input)
        : await window.spellbook.createSpell(input);
      setSelectedId(spell.id);
      setEditorState(null);
      showToast(t('spell.created'));
      await onChanged();
      return;
    }
    if (editorState?.mode !== 'edit' || !editingSpell) {
      return;
    }
    await window.spellbook.updateSpell(editingSpell.id, {
      name: draft.name,
      body: draft.body,
      tags: draft.tags
    });
    setSelectedId(editingSpell.id);
    setEditorState(null);
    showToast(t('spell.saved'));
    await onChanged();
  }

  async function toggleFavorite(spell: Spell): Promise<void> {
    const nextFavorite = !spell.isFavorite;
    await window.spellbook.updateSpellState(spell.id, { isFavorite: nextFavorite });
    showToast(t(nextFavorite ? 'spell.favorited' : 'spell.unfavorited'));
    await onChanged();
  }

  async function deleteSelectedSpells(): Promise<void> {
    if (selectedSpellIds.length === 0) {
      return;
    }
    const selectedIds = new Set(selectedSpellIds);
    const remaining = filteredSpells.filter((spell) => !selectedIds.has(spell.id));
    const result = await window.spellbook.deleteSpells(selectedSpellIds);
    const deletedIds = new Set(result.deletedIds);
    setSelectedSpellIds([]);
    setConfirmingBulkDelete(false);
    if (selectedSpell && deletedIds.has(selectedSpell.id)) {
      setSelectedId(remaining[0]?.id ?? null);
    }
    if (editorState?.mode === 'edit' && deletedIds.has(editorState.spellId)) {
      setEditorState(null);
      setSelectedId(remaining[0]?.id ?? null);
    }
    showToast(t('spell.bulkDeleted'));
    await onChanged();
  }

  async function saveSelectedCandidates(): Promise<void> {
    if (selectedPendingCandidateIds.length === 0 || isSavingCandidates) {
      return;
    }
    setIsSavingCandidates(true);
    try {
      const result = await window.spellbook.promoteCandidates(selectedPendingCandidateIds);
      setSelectedCandidateIds([]);
      if (result.created[0]) {
        setSelectedId(result.created[0].id);
      }
      showToast(t('library.selectedSaved'));
      await onChanged();
    } finally {
      setIsSavingCandidates(false);
    }
  }

  function openNewSpellEditor(): void {
    setConfirmingBulkDelete(false);
    setEditorState((current) => current ?? { mode: 'create' });
  }

  function openCandidateEditor(candidate: Candidate): void {
    setConfirmingBulkDelete(false);
    setEditorState({
      mode: 'create',
      candidateId: candidate.id,
      initialDraft: {
        name: '',
        body: candidate.template,
        tags: []
      }
    });
  }

  function openSpellEditor(spell: Spell): void {
    setSelectedId(spell.id);
    setConfirmingBulkDelete(false);
    setEditorState({ mode: 'edit', spellId: spell.id });
  }

  function toggleSpellSelection(spellId: string): void {
    setSelectedSpellIds((current) =>
      current.includes(spellId)
        ? current.filter((item) => item !== spellId)
        : [...current, spellId]
    );
    setConfirmingBulkDelete(false);
  }

  function toggleFilteredSpellSelection(): void {
    setSelectedSpellIds(allFilteredSpellsSelected ? [] : filteredSpellIds);
    setConfirmingBulkDelete(false);
  }

  function toggleCandidateSelection(candidateId: string): void {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId)
        ? current.filter((item) => item !== candidateId)
        : [...current, candidateId]
    );
  }

  function togglePendingCandidateSelection(): void {
    setSelectedCandidateIds(allPendingCandidatesSelected ? [] : pendingCandidateIds);
  }

  function toggleFilterTag(tag: string): void {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  }

  function toggleSort(nextMode: SpellTableSortMode): void {
    setSortState((current) => getNextSpellTableSortState(current, nextMode));
  }

  function handleBulkDeleteBlur(event: ReactFocusEvent<HTMLDivElement>): void {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    setConfirmingBulkDelete(false);
  }

  function getSplitConstraints(): SplitPaneConstraints | null {
    const content = contentRef.current;
    if (!content) {
      return null;
    }
    return {
      containerWidth: content.getBoundingClientRect().width,
      dividerWidth: SPELL_LIBRARY_SPLITTER_WIDTH,
      minStartWidth: SPELL_LIBRARY_MIN_LIST_WIDTH,
      minEndWidth: SPELL_LIBRARY_MIN_CANDIDATE_WIDTH
    };
  }

  function updateSplitFromPointer(clientX: number): void {
    const content = contentRef.current;
    const constraints = getSplitConstraints();
    if (!content || !constraints) {
      return;
    }
    setSplitRatio(calculateSplitRatio(clientX, content.getBoundingClientRect().left, constraints));
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

  const splitStyle = pendingCandidates.length
    ? ({
        gridTemplateColumns: `minmax(${SPELL_LIBRARY_MIN_LIST_WIDTH}px, ${splitRatio}fr) ${SPELL_LIBRARY_SPLITTER_WIDTH}px minmax(${SPELL_LIBRARY_MIN_CANDIDATE_WIDTH}px, ${100 - splitRatio}fr)`
      } satisfies CSSProperties)
    : undefined;

  return (
    <section className="spell-library-grid">
      <div
        className={[
          'spell-library-content',
          pendingCandidates.length ? 'has-candidates' : '',
          isResizing ? 'resizing' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        ref={contentRef}
        style={splitStyle}
      >
        <div className="spell-list-pane">
          <div className="spell-library-toolbar">
            <SpellSearchFilter
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
            <button
              aria-label={t('spell.new')}
              className="secondary-button new-spell-button"
              onClick={openNewSpellEditor}
              title={t('spell.new')}
              type="button"
            >
              <Plus size={16} />
              <span>{t('spell.new')}</span>
            </button>
          </div>
          <div className="spell-list" id="spell-library-list">
            {filteredSpells.length ? (
              <div className="spell-selection-toolbar">
                <label
                  className="spell-select-all"
                  title={allFilteredSpellsSelected ? t('spell.clearSelection') : t('spell.selectAll')}
                >
                  <input
                    aria-label={allFilteredSpellsSelected ? t('spell.clearSelection') : t('spell.selectAll')}
                    checked={allFilteredSpellsSelected}
                    onChange={toggleFilteredSpellSelection}
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                  />
                  <span>{t('spell.selectAll')}</span>
                </label>
                <div
                  className="delete-action batch-delete-action"
                  onBlur={handleBulkDeleteBlur}
                  ref={bulkDeleteActionRef}
                >
                  <button
                    aria-expanded={confirmingBulkDelete}
                    aria-haspopup="dialog"
                    className="secondary-button danger-button"
                    disabled={selectedSpellIds.length === 0}
                    onClick={() => setConfirmingBulkDelete((current) => !current)}
                    type="button"
                  >
                    <Trash2 size={15} />
                    {t('spell.delete')}
                  </button>
                  {confirmingBulkDelete ? (
                    <div
                      aria-label={t('spell.deleteConfirm')}
                      className="delete-confirm-popover"
                      role="alertdialog"
                    >
                      <button
                        className="delete-confirm-cancel"
                        onClick={() => setConfirmingBulkDelete(false)}
                        type="button"
                      >
                        {t('spell.deleteCancel')}
                      </button>
                      <button className="danger-confirm" onClick={() => void deleteSelectedSpells()} type="button">
                        {t('spell.deleteConfirm')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {filteredSpells.length ? (
              <SpellListSortHeader
                className="spell-library-list-header"
                hasLeadingCell
                onSort={toggleSort}
                sortState={sortState}
                t={t}
              />
            ) : null}
            {filteredSpells.map((spell) => (
              <article
                className={[
                  'spell-list-row',
                  selectedSpell?.id === spell.id ? 'selected' : '',
                  selectedSpellIds.includes(spell.id) ? 'bulk-selected' : ''
                ]
                  .filter(Boolean)
                  .join(' ')}
                key={spell.id}
              >
                <label className="spell-row-select" title={t('spell.select')}>
                  <input
                    aria-label={`${t('spell.select')} ${getSpellDisplayName(spell, t('spell.untitled'))}`}
                    checked={selectedSpellIds.includes(spell.id)}
                    onChange={() => toggleSpellSelection(spell.id)}
                    type="checkbox"
                  />
                </label>
                <button
                  className="spell-row-main"
                  onClick={() => openSpellEditor(spell)}
                  type="button"
                >
                  <SpellIdentity
                    name={getSpellDisplayName(spell, t('spell.untitled'))}
                    tags={spell.tags}
                  />
                </button>
                <span className="spell-list-updated" title={formatSpellUpdatedAtTitle(spell.updatedAt)}>
                  {formatSpellUpdatedAt(spell.updatedAt)}
                </span>
                <span className="spell-list-usage">{spell.copyCount}</span>
                <div className="spell-row-actions">
                  <button
                    aria-label={t(spell.isFavorite ? 'spell.unfavorite' : 'spell.favorite')}
                    aria-pressed={spell.isFavorite}
                    className={
                      spell.isFavorite
                        ? 'icon-button spell-favorite-button active'
                        : 'icon-button spell-favorite-button'
                    }
                    onClick={() => void toggleFavorite(spell)}
                    title={t(spell.isFavorite ? 'spell.unfavorite' : 'spell.favorite')}
                    type="button"
                  >
                    <Heart fill={spell.isFavorite ? 'currentColor' : 'none'} size={15} />
                  </button>
                  <button
                    aria-label={t('spell.copy')}
                    className="icon-button"
                    onClick={() => void copy(spell)}
                    title={t('spell.copy')}
                    type="button"
                  >
                    <Clipboard size={15} />
                  </button>
                </div>
              </article>
            ))}
            {filteredSpells.length === 0 ? <div className="empty-state">{t('spell.empty')}</div> : null}
          </div>
        </div>
        {pendingCandidates.length ? (
          <>
            <div
              aria-controls="spell-library-list"
              aria-label={t('spell.resizePanels')}
              aria-orientation="vertical"
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(splitRatio)}
              className="spell-library-resizer"
              onKeyDown={resizeWithKeyboard}
              onLostPointerCapture={stopResizing}
              onPointerDown={startResizing}
              onPointerMove={resizeWithPointer}
              onPointerUp={stopResizing}
              role="separator"
              tabIndex={0}
              title={t('spell.resizePanels')}
            />
            <div aria-label={t('library.candidates')} className="candidate-dock">
              <div className="candidate-dock-header">
                <h3>{t('library.candidates')}</h3>
              </div>
              <div aria-busy={isSavingCandidates} className="candidate-list compact">
                <div className="spell-selection-toolbar candidate-selection-toolbar">
                  <label
                    className="spell-select-all candidate-select-all"
                    title={
                      allPendingCandidatesSelected ? t('spell.clearSelection') : t('spell.selectAll')
                    }
                  >
                    <input
                      aria-label={
                        allPendingCandidatesSelected ? t('spell.clearSelection') : t('spell.selectAll')
                      }
                      checked={allPendingCandidatesSelected}
                      onChange={togglePendingCandidateSelection}
                      ref={selectAllCandidatesCheckboxRef}
                      type="checkbox"
                    />
                    <span>{t('spell.selectAll')}</span>
                  </label>
                  <button
                    aria-label={t('library.saveSelected')}
                    className="primary-button candidate-batch-save"
                    disabled={selectedPendingCandidateCount === 0 || isSavingCandidates}
                    onClick={() => void saveSelectedCandidates()}
                    title={t('library.saveSelected')}
                    type="button"
                  >
                    <Save size={15} />
                    {t('library.save')}
                  </button>
                </div>
                {pendingCandidates.map((candidate) => (
                  <article
                    className={
                      selectedCandidateIds.includes(candidate.id)
                        ? 'candidate-row bulk-selected'
                        : 'candidate-row'
                    }
                    key={candidate.id}
                  >
                    <label className="spell-row-select candidate-row-select" title={t('spell.select')}>
                      <input
                        aria-label={`${t('spell.select')} ${candidate.title}`}
                        checked={selectedCandidateIds.includes(candidate.id)}
                        onChange={() => toggleCandidateSelection(candidate.id)}
                        type="checkbox"
                      />
                    </label>
                    <div className="candidate-row-content">
                      <pre className="spell-text-block compact">{getCandidateDisplayText(candidate)}</pre>
                    </div>
                    <div className="candidate-row-meta">
                      <span>
                        {candidate.sourceCount} {t('metric.sources')}
                      </span>
                    </div>
                    <div className="candidate-row-actions">
                      <button
                        aria-label={t('spell.save')}
                        className="icon-button candidate-save-button"
                        disabled={isSavingCandidates}
                        onClick={() => openCandidateEditor(candidate)}
                        title={t('spell.save')}
                        type="button"
                      >
                        <Save size={15} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>
      {editorState && (editorState.mode === 'create' || editingSpell) ? (
        <SpellEditorDialog
          initialDraft={editorState.mode === 'create' ? editorState.initialDraft : undefined}
          key={
            editorState.mode === 'edit'
              ? editorState.spellId
              : editorState.candidateId
                ? `candidate-${editorState.candidateId}`
                : 'new-spell'
          }
          mode={editorState.mode}
          onClose={() => setEditorState(null)}
          onCopy={editingSpell ? () => copy(editingSpell) : undefined}
          onSave={saveEditorDraft}
          spell={editingSpell}
          t={t}
        />
      ) : null}
    </section>
  );
}
