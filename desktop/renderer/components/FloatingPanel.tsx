import { Clipboard, Search } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Spell } from '../../shared/types';
import type { TFunction } from '../i18n';
import { deriveSpellName, getSpellDisplayText } from '../spellDisplay';
import { useFeedbackToast } from './FeedbackToast';

interface FloatingPanelProps {
  t: TFunction;
}

type QuickPanelSortMode = 'usage' | 'created' | 'updated' | 'name' | 'nameLength';

const QUICK_PANEL_SORT_OPTIONS: Array<{
  value: QuickPanelSortMode;
  labelKey:
    | 'floating.sort.usage'
    | 'floating.sort.created'
    | 'floating.sort.updated'
    | 'floating.sort.name'
    | 'floating.sort.nameLength';
}> = [
  { value: 'usage', labelKey: 'floating.sort.usage' },
  { value: 'created', labelKey: 'floating.sort.created' },
  { value: 'updated', labelKey: 'floating.sort.updated' },
  { value: 'name', labelKey: 'floating.sort.name' },
  { value: 'nameLength', labelKey: 'floating.sort.nameLength' }
];

export function FloatingPanel({ t }: FloatingPanelProps) {
  const [query, setQuery] = useState('');
  const [spells, setSpells] = useState<Spell[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [sortMode, setSortMode] = useState<QuickPanelSortMode>('usage');
  const { showToast } = useFeedbackToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const loadPrompts = useCallback(async (value: string) => {
    const trimmed = value.trim();
    const results = trimmed
      ? await window.spellbook.searchSpells(trimmed)
      : await window.spellbook.listSpells();
    setSpells(results);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    void loadPrompts(query);
  }, [loadPrompts, query]);

  useEffect(() => {
    const dispose = window.spellbook.onFloatingFocus(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    inputRef.current?.focus();
    return dispose;
  }, []);

  const visibleSpells = useMemo(() => {
    const sorted = sortSpells(spells, sortMode, t);
    return query.trim() ? sorted : sorted.slice(0, 5);
  }, [query, sortMode, spells, t]);
  const selected = useMemo(() => visibleSpells[selectedIndex] ?? null, [visibleSpells, selectedIndex]);

  async function copySpell(spell: Spell): Promise<void> {
    await window.spellbook.copySpell(spell.id);
    showToast(t('status.copied'));
  }

  async function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): Promise<void> {
    if (event.key === 'Escape') {
      event.preventDefault();
      await window.spellbook.closeFloatingWindow();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((current) => Math.min(current + 1, Math.max(visibleSpells.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter' && selected) {
      event.preventDefault();
      await copySpell(selected);
    }
  }

  return (
    <main className="floating-shell">
      <div className="floating-search-row">
        <label className="floating-search">
          <Search size={18} />
          <input
            ref={inputRef}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => void handleKeyDown(event)}
            placeholder={t('floating.placeholder')}
            value={query}
          />
        </label>
        <select
          aria-label={t('floating.sort.label')}
          className="floating-sort"
          onChange={(event) => {
            setSortMode(event.target.value as QuickPanelSortMode);
            setSelectedIndex(0);
          }}
          title={t('floating.sort.label')}
          value={sortMode}
        >
          {QUICK_PANEL_SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {t(option.labelKey)}
            </option>
          ))}
        </select>
      </div>
      <section className="floating-results">
        {visibleSpells.map((spell, index) => (
          <button
            className={index === selectedIndex ? 'floating-row selected' : 'floating-row'}
            key={spell.id}
            onClick={() => {
              setSelectedIndex(index);
              void copySpell(spell);
            }}
            onMouseEnter={() => setSelectedIndex(index)}
            type="button"
          >
            <span className="floating-row-name" title={getFloatingSpellName(spell, t)}>
              {getFloatingSpellName(spell, t)}
            </span>
            <Clipboard size={15} />
          </button>
        ))}
        {visibleSpells.length === 0 ? <div className="floating-empty">{t('floating.noResult')}</div> : null}
      </section>
      {selected ? (
        <section className="floating-preview" aria-label={t('spell.body')}>
          <pre>{getSpellDisplayText(selected)}</pre>
        </section>
      ) : null}
    </main>
  );
}

function getFloatingSpellName(spell: Spell, t: TFunction): string {
  return spell.name || deriveSpellName(spell.body, t('spell.untitled'));
}

function sortSpells(spells: Spell[], sortMode: QuickPanelSortMode, t: TFunction): Spell[] {
  return [...spells].sort((left, right) => {
    if (sortMode === 'usage') {
      return right.copyCount - left.copyCount || compareUpdatedAt(left, right) || compareName(left, right, t);
    }
    if (sortMode === 'created') {
      return compareDateDesc(left.createdAt, right.createdAt) || compareName(left, right, t);
    }
    if (sortMode === 'updated') {
      return compareUpdatedAt(left, right) || compareName(left, right, t);
    }
    if (sortMode === 'nameLength') {
      return getFloatingSpellName(left, t).length - getFloatingSpellName(right, t).length || compareName(left, right, t);
    }
    return compareName(left, right, t);
  });
}

function compareUpdatedAt(left: Spell, right: Spell): number {
  return compareDateDesc(left.updatedAt, right.updatedAt);
}

function compareDateDesc(left: string, right: string): number {
  return Date.parse(right) - Date.parse(left);
}

function compareName(left: Spell, right: Spell, t: TFunction): number {
  return getFloatingSpellName(left, t).localeCompare(getFloatingSpellName(right, t), undefined, {
    sensitivity: 'base'
  });
}
