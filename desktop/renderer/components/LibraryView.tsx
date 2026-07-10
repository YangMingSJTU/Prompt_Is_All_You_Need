import { Clipboard, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  SPELL_LIBRARY_COLUMN_GAP,
  SPELL_LIBRARY_MAX_CANDIDATE_WIDTH,
  SPELL_LIBRARY_MIN_CANDIDATE_WIDTH,
  SPELL_LIBRARY_MIN_LIST_WIDTH
} from '../../shared/layout';
import type { Candidate, Spell } from '../../shared/types';
import type { TFunction } from '../i18n';
import { deriveSpellName, getCandidateDisplayText, getSpellDisplayText } from '../spellDisplay';
import { matchesSpellSearch, type SearchScope } from '../spellSearch';
import { sortSpells, type SpellSortDirection, type SpellSortMode } from '../spellSort';
import { useFeedbackToast } from './FeedbackToast';
import { SpellEditorDialog, type SpellEditorDraft } from './SpellEditorDialog';
import { SpellSearchFilter } from './SpellSearchFilter';
import { SpellSortMenu } from './SpellSortMenu';

interface LibraryViewProps {
  spells: Spell[];
  candidates: Candidate[];
  createRequestId?: number;
  onChanged(): Promise<void>;
  t: TFunction;
}

type EditorState =
  | { mode: 'create' }
  | { mode: 'edit'; spellId: string };

const SPELL_LIBRARY_SPLIT_STYLE = {
  columnGap: SPELL_LIBRARY_COLUMN_GAP,
  gridTemplateColumns: `minmax(${SPELL_LIBRARY_MIN_LIST_WIDTH}px, 1fr) clamp(${SPELL_LIBRARY_MIN_CANDIDATE_WIDTH}px, 28vw, ${SPELL_LIBRARY_MAX_CANDIDATE_WIDTH}px)`
} as CSSProperties;

export function LibraryView({ spells, candidates, createRequestId = 0, onChanged, t }: LibraryViewProps) {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(spells[0]?.id ?? null);
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [sortMode, setSortMode] = useState<SpellSortMode>('updated');
  const [sortDirection, setSortDirection] = useState<SpellSortDirection>('desc');
  const [searchScope, setSearchScope] = useState<SearchScope>('title-content');
  const [selectedSpellIds, setSelectedSpellIds] = useState<string[]>([]);
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
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

  const filteredSpells = useMemo(() => {
    const filtered = spells.filter((spell) => {
      const matchesQuery = matchesSpellSearch(
        { name: getSpellName(spell, t), body: spell.body },
        query,
        searchScope
      );
      const matchesTags =
        selectedTags.length === 0 || selectedTags.every((tag) => spell.tags.includes(tag));
      return matchesQuery && matchesTags;
    });
    return sortSpells(filtered, sortMode, sortDirection, (spell) => getSpellName(spell, t));
  }, [query, searchScope, selectedTags, sortMode, sortDirection, spells, t]);
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
    if (selectedVisibleSpellCount === 0) {
      setConfirmingBulkDelete(false);
    }
  }, [selectedVisibleSpellCount]);

  useEffect(() => {
    if (spells.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !spells.some((spell) => spell.id === selectedId)) {
      setSelectedId(spells[0].id);
    }
  }, [selectedId, spells]);

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

  async function promote(candidate: Candidate): Promise<void> {
    const spell = await window.spellbook.promoteCandidate(candidate.id);
    setSelectedId(spell.id);
    showToast(t('library.saved'));
    await onChanged();
  }

  async function copy(spell: Spell): Promise<void> {
    await window.spellbook.copySpell(spell.id);
    showToast(t('status.copied'));
    await onChanged();
  }

  async function saveEditorDraft(draft: SpellEditorDraft): Promise<void> {
    if (editorState?.mode === 'create') {
      const spell = await window.spellbook.createSpell({
        name: draft.name.trim() || deriveSpellName(draft.body, t('spell.untitled')),
        body: draft.body,
        tags: draft.tags
      });
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

  function openNewSpellEditor(): void {
    setConfirmingBulkDelete(false);
    setEditorState((current) => current ?? { mode: 'create' });
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

  function toggleFilterTag(tag: string): void {
    setSelectedTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  }

  return (
    <section className="spell-library-grid">
      <div className="spell-list-pane">
        <div className="spell-library-toolbar">
          <SpellSearchFilter
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
          <div className="spell-library-actions">
            <SpellSortMenu
              t={t}
              value={sortMode}
              direction={sortDirection}
              onChange={setSortMode}
              onDirectionChange={setSortDirection}
              variant="button"
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
        </div>
        <div
          className={candidates.length ? 'spell-library-content has-candidates' : 'spell-library-content'}
          style={candidates.length ? SPELL_LIBRARY_SPLIT_STYLE : undefined}
        >
          <div className="spell-list">
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
                <div className="delete-action batch-delete-action">
                  <button
                    className="secondary-button danger-button"
                    disabled={selectedSpellIds.length === 0}
                    onClick={() => setConfirmingBulkDelete(true)}
                    type="button"
                  >
                    <Trash2 size={15} />
                    {t('spell.delete')}
                  </button>
                  {confirmingBulkDelete ? (
                    <div className="delete-confirm-popover">
                      <button className="danger-confirm" onClick={() => void deleteSelectedSpells()} type="button">
                        {t('spell.deleteConfirm')}
                      </button>
                      <button onClick={() => setConfirmingBulkDelete(false)} type="button">
                        {t('spell.deleteCancel')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
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
                    aria-label={`${t('spell.select')} ${getSpellName(spell, t)}`}
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
                  <div className="spell-row-title" title={getSpellName(spell, t)}>
                    {getSpellName(spell, t)}
                  </div>
                  <p className="spell-preview-line" title={getSpellDisplayText(spell)}>
                    {formatPreview(spell.body)}
                  </p>
                  {spell.tags.length ? (
                    <div className="tag-strip compact">
                      {spell.tags.map((tag) => (
                        <span key={tag} title={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
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
              </article>
            ))}
            {filteredSpells.length === 0 ? <div className="empty-state">{t('spell.empty')}</div> : null}
          </div>
          {candidates.length ? (
            <div className="candidate-dock">
              <div className="candidate-dock-header">
                <h3>{t('library.candidates')}</h3>
              </div>
              <div className="candidate-list compact">
                {candidates.map((candidate) => (
                  <article className="candidate-row" key={candidate.id}>
                    <div>
                      <pre className="spell-text-block compact">{getCandidateDisplayText(candidate)}</pre>
                      <small>
                        {candidate.sourceCount} {t('metric.sources')} · {t('metric.score')} {candidate.score}
                      </small>
                    </div>
                    <button className="primary-button" onClick={() => void promote(candidate)} type="button">
                      <Plus size={16} />
                      {t('library.save')}
                    </button>
                  </article>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {editorState && (editorState.mode === 'create' || editingSpell) ? (
        <SpellEditorDialog
          key={editorState.mode === 'edit' ? editorState.spellId : 'new-spell'}
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

function getSpellName(spell: Spell, t: TFunction): string {
  return spell.name || deriveSpellName(spell.body, t('spell.untitled'));
}

function formatPreview(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
