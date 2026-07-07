import { Clipboard, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Spell } from '../../shared/types';
import type { TFunction } from '../i18n';

interface SpellPanelProps {
  spells: Spell[];
  onChanged(): Promise<void>;
  onMessage(message: string): void;
  t: TFunction;
}

export function SpellPanel({ spells, onChanged, onMessage, t }: SpellPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(spells[0]?.id ?? null);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return spells;
    }
    return spells.filter((spell) =>
      [spell.title, spell.description, spell.body, spell.tags.join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(normalized)
    );
  }, [spells, query]);

  const selected = filtered.find((spell) => spell.id === selectedId) ?? filtered[0] ?? null;

  async function copySelected(spell: Spell): Promise<void> {
    await window.spellbook.copySpell(spell.id);
    onMessage(`${t('status.copied')} ${spell.title}`);
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
              <span>
                <strong>{spell.title}</strong>
                <small>{spell.description}</small>
              </span>
              <em>{t('metric.spells')}</em>
            </button>
          ))}
        </div>
      </div>
      <div className="detail-pane">
        {selected ? (
          <>
            <div className="detail-heading">
              <div className="detail-title">
                <h3>{selected.title}</h3>
                {selected.tags.length > 0 ? (
                  <div className="tag-strip">
                    {selected.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="button-row">
                <button className="primary-button" onClick={() => copySelected(selected)} type="button">
                  <Clipboard size={16} />
                  {t('spell.copy')}
                </button>
              </div>
            </div>
            <pre className="prompt-preview">{selected.body}</pre>
          </>
        ) : (
          <div className="empty-state">{t('spell.empty')}</div>
        )}
      </div>
    </section>
  );
}
