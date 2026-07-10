import { Clipboard, Plus, Save, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Candidate, Spell } from '../../shared/types';
import type { TFunction } from '../i18n';
import { deriveSpellName, getCandidateDisplayText, getSpellDisplayText } from '../spellDisplay';
import { sortSpells, type SpellSortDirection, type SpellSortMode } from '../spellSort';
import { useFeedbackToast } from './FeedbackToast';
import { SpellSortMenu } from './SpellSortMenu';

interface LibraryViewProps {
  spells: Spell[];
  candidates: Candidate[];
  createRequestId?: number;
  onChanged(): Promise<void>;
  t: TFunction;
}

interface SpellDraft {
  name: string;
  body: string;
  tags: string[];
}

export function LibraryView({ spells, candidates, createRequestId = 0, onChanged, t }: LibraryViewProps) {
  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(spells[0]?.id ?? null);
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [sortMode, setSortMode] = useState<SpellSortMode>('updated');
  const [sortDirection, setSortDirection] = useState<SpellSortDirection>('desc');
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
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = spells.filter((spell) => {
      const matchesQuery =
        !normalizedQuery ||
        getSpellName(spell, t).toLowerCase().includes(normalizedQuery) ||
        spell.body.toLowerCase().includes(normalizedQuery) ||
        spell.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));
      const matchesTags =
        selectedTags.length === 0 || selectedTags.every((tag) => spell.tags.includes(tag));
      return matchesQuery && matchesTags;
    });
    return sortSpells(filtered, sortMode, sortDirection, (spell) => getSpellName(spell, t));
  }, [query, selectedTags, sortMode, sortDirection, spells, t]);
  const filteredSpellIds = useMemo(() => filteredSpells.map((spell) => spell.id), [filteredSpells]);
  const selectedVisibleSpellCount = useMemo(() => {
    const selectedIds = new Set(selectedSpellIds);
    return filteredSpellIds.filter((spellId) => selectedIds.has(spellId)).length;
  }, [filteredSpellIds, selectedSpellIds]);
  const allFilteredSpellsSelected =
    filteredSpellIds.length > 0 && selectedVisibleSpellCount === filteredSpellIds.length;
  const someFilteredSpellsSelected =
    selectedVisibleSpellCount > 0 && !allFilteredSpellsSelected;

  const selectedExistingSpell = useMemo(
    () => filteredSpells.find((spell) => spell.id === selectedId) ?? filteredSpells[0] ?? null,
    [filteredSpells, selectedId]
  );
  const selectedSpell = isCreating ? null : selectedExistingSpell;
  const [draft, setDraft] = useState<SpellDraft>(() => createDraft(selectedSpell));

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
    if (isCreating) {
      return;
    }
    if (selectedSpell) {
      setSelectedId(selectedSpell.id);
    }
    setConfirmingBulkDelete(false);
    setAddingTag(false);
    setNewTag('');
    setDraft(createDraft(selectedSpell));
  }, [isCreating, selectedSpell?.id]);

  useEffect(() => {
    if (!createRequestId) {
      return;
    }
    startNewSpell();
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

  async function saveSelected(): Promise<void> {
    if (isCreating) {
      if (!draft.body.trim()) {
        return;
      }
      const spell = await window.spellbook.createSpell({
        name: draft.name.trim() || deriveSpellName(draft.body, t('spell.untitled')),
        body: draft.body,
        tags: draft.tags
      });
      showToast(t('spell.created'));
      await onChanged();
      setSelectedId(spell.id);
      setIsCreating(false);
      return;
    }
    if (!selectedSpell) {
      return;
    }
    await window.spellbook.updateSpell(selectedSpell.id, {
      name: draft.name,
      body: draft.body,
      tags: draft.tags
    });
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
    if (!isCreating && selectedSpell && deletedIds.has(selectedSpell.id)) {
      setSelectedId(remaining[0]?.id ?? null);
    }
    showToast(t('spell.bulkDeleted'));
    await onChanged();
  }

  function resetDraft(): void {
    setDraft(createDraft(selectedSpell));
    setAddingTag(false);
    setNewTag('');
  }

  function startNewSpell(): void {
    setQuery('');
    setSelectedTags([]);
    setSelectedId(null);
    setConfirmingBulkDelete(false);
    setSelectedSpellIds([]);
    setAddingTag(false);
    setNewTag('');
    setDraft(createDraft(null));
    setIsCreating(true);
  }

  function cancelCreate(): void {
    setIsCreating(false);
    setSelectedId(spells[0]?.id ?? null);
    setDraft(createDraft(spells[0] ?? null));
    setConfirmingBulkDelete(false);
    setAddingTag(false);
    setNewTag('');
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

  function removeDraftTag(tag: string): void {
    setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }));
  }

  function addDraftTag(): void {
    const normalized = newTag.trim();
    if (!normalized) {
      setAddingTag(false);
      setNewTag('');
      return;
    }
    setDraft((current) => ({
      ...current,
      tags: current.tags.includes(normalized) ? current.tags : [...current.tags, normalized]
    }));
    setAddingTag(false);
    setNewTag('');
  }

  function handleNewTagKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addDraftTag();
    }
    if (event.key === 'Escape') {
      setAddingTag(false);
      setNewTag('');
    }
  }

  return (
    <section className="spell-library-grid">
      <div className="spell-list-pane">
        <div className="spell-library-toolbar">
          <div className="spell-toolbar-row">
            <label className="spell-filter-search">
              <Search size={15} />
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('spell.search')}
                value={query}
              />
            </label>
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
              onClick={startNewSpell}
              title={t('spell.new')}
              type="button"
            >
              <Plus size={16} />
              <span>{t('spell.new')}</span>
            </button>
          </div>
          {allTags.length ? (
            <div className="tag-filter-row" aria-label={t('spell.tags')}>
              <button
                className={selectedTags.length === 0 ? 'active' : ''}
                onClick={() => setSelectedTags([])}
                type="button"
              >
                {t('spell.allTags')}
              </button>
              {allTags.map((tag) => (
                <button
                  className={selectedTags.includes(tag) ? 'active' : ''}
                  key={tag}
                  onClick={() => toggleFilterTag(tag)}
                  title={tag}
                  type="button"
                >
                  {tag}
                </button>
              ))}
            </div>
          ) : null}
        </div>
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
                onClick={() => {
                  setIsCreating(false);
                  setSelectedId(spell.id);
                  setConfirmingBulkDelete(false);
                }}
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
                    {spell.tags.slice(0, 3).map((tag) => (
                      <span key={tag} title={tag}>
                        {tag}
                      </span>
                    ))}
                    {spell.tags.length > 3 ? <span>+{spell.tags.length - 3}</span> : null}
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
            <div className="section-heading compact">
              <div>
                <h3>{t('library.candidates')}</h3>
              </div>
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
      <div className="spell-editor-pane">
        {selectedSpell || isCreating ? (
          <form
            className="spell-editor-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveSelected();
            }}
          >
            <div className="detail-heading">
              <div className="button-row end">
                {selectedSpell ? (
                  <button
                    className="secondary-button"
                    onClick={() => void copy(selectedSpell)}
                    type="button"
                  >
                    <Clipboard size={16} />
                    {t('spell.copy')}
                  </button>
                ) : null}
                <button className="secondary-button" onClick={isCreating ? cancelCreate : resetDraft} type="button">
                  <X size={16} />
                  {t('spell.cancel')}
                </button>
                <button className="primary-button" disabled={!draft.body.trim()} type="submit">
                  <Save size={16} />
                  {isCreating ? t('spell.create') : t('spell.save')}
                </button>
              </div>
            </div>
            <label className="field-row">
              <span>{t('spell.name')}</span>
              <input
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder={deriveSpellName(draft.body, t('spell.namePlaceholder'))}
                value={draft.name}
              />
            </label>
            <div className="field-row">
              <span>{t('spell.tags')}</span>
              <div className="tag-editor">
                {draft.tags.map((tag) => (
                  <button key={tag} onClick={() => removeDraftTag(tag)} title={tag} type="button">
                    {tag}
                    <X size={12} />
                  </button>
                ))}
                {addingTag ? (
                  <input
                    autoFocus
                    onBlur={addDraftTag}
                    onChange={(event) => setNewTag(event.target.value)}
                    onKeyDown={handleNewTagKeyDown}
                    placeholder={t('spell.tagPlaceholder')}
                    value={newTag}
                  />
                ) : (
                  <button className="tag-add-button" onClick={() => setAddingTag(true)} type="button">
                    <Plus size={12} />
                    {t('spell.addTag')}
                  </button>
                )}
              </div>
            </div>
            <label className="field-row fill">
              <span>{t('spell.body')}</span>
              <textarea
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                value={draft.body}
              />
            </label>
          </form>
        ) : (
          <div className="empty-state">{t('spell.empty')}</div>
        )}
      </div>
    </section>
  );
}

function createDraft(spell: Spell | null): SpellDraft {
  return {
    name: spell?.name ?? '',
    body: spell?.body ?? '',
    tags: spell?.tags ?? []
  };
}

function getSpellName(spell: Spell, t: TFunction): string {
  return spell.name || deriveSpellName(spell.body, t('spell.untitled'));
}

function formatPreview(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
