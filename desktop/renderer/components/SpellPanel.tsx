import { Clipboard, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
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
        <div className="pane-toolbar">
          <h3>{t('nav.panel')}</h3>
          <div className="toolbar-actions">
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
        </div>
        <label className="search-box">
          <Search size={18} />
          <input
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('spell.placeholder')}
            value={query}
          />
        </label>
        {allTags.length ? (
          <div className="tag-filter-row quick-panel-traits" aria-label={t('spell.tags')}>
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

function getSpellName(spell: Spell, t: TFunction): string {
  return spell.name || deriveSpellName(spell.body, t('spell.untitled'));
}
