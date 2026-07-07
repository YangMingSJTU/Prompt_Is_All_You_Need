import { Clipboard, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Spell } from '../../shared/types';
import type { TFunction } from '../i18n';
import { getSpellDisplayText } from '../spellDisplay';
import { useFeedbackToast } from './FeedbackToast';

interface SpellPanelProps {
  spells: Spell[];
  onChanged(): Promise<void>;
  t: TFunction;
}

export function SpellPanel({ spells, onChanged, t }: SpellPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(spells[0]?.id ?? null);
  const { showToast } = useFeedbackToast();

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return spells;
    }
    return spells.filter((spell) => getSpellDisplayText(spell).toLowerCase().includes(normalized));
  }, [spells, query]);

  const selected = filtered.find((spell) => spell.id === selectedId) ?? filtered[0] ?? null;

  async function copySelected(spell: Spell): Promise<void> {
    await window.spellbook.copySpell(spell.id);
    showToast(t('status.copied'));
    await onChanged();
  }

  return (
    <section className="panel-grid">
      <div className="search-pane">
        <div className="pane-toolbar">
          <h3>{t('nav.panel')}</h3>
          <span className="count-pill">{filtered.length}/{spells.length}</span>
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
        <div className="result-list">
          {filtered.map((spell) => (
            <button
              className={selected?.id === spell.id ? 'result-row selected' : 'result-row'}
              key={spell.id}
              onClick={() => setSelectedId(spell.id)}
              type="button"
            >
              <span className="spell-result-text">{getSpellDisplayText(spell)}</span>
              <em>{t('metric.spells')}</em>
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
