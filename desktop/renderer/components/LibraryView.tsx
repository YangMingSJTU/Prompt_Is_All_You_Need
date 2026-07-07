import { Clipboard, Plus, Save, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Candidate, Spell } from '../../shared/types';
import type { TFunction } from '../i18n';
import { getCandidateDisplayText, getSpellDisplayText } from '../spellDisplay';
import { FeedbackTarget, useFeedbackTooltip } from './FeedbackTooltip';

interface LibraryViewProps {
  spells: Spell[];
  candidates: Candidate[];
  onChanged(): Promise<void>;
  t: TFunction;
}

interface SpellDraft {
  alias: string;
  body: string;
  tags: string;
}

export function LibraryView({ spells, candidates, onChanged, t }: LibraryViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(spells[0]?.id ?? null);
  const { showFeedback, tooltipFor } = useFeedbackTooltip();
  const selectedSpell = useMemo(
    () => spells.find((spell) => spell.id === selectedId) ?? spells[0] ?? null,
    [selectedId, spells]
  );
  const [draft, setDraft] = useState<SpellDraft>(() => createDraft(selectedSpell));

  useEffect(() => {
    if (selectedSpell) {
      setSelectedId(selectedSpell.id);
    }
    setDraft(createDraft(selectedSpell));
  }, [selectedSpell?.id]);

  async function promote(candidate: Candidate): Promise<void> {
    const spell = await window.spellbook.promoteCandidate(candidate.id);
    setSelectedId(spell.id);
    showFeedback(`candidate:${candidate.id}`, t('library.saved'));
    await onChanged();
  }

  async function copy(spell: Spell, feedbackKey: string): Promise<void> {
    await window.spellbook.copySpell(spell.id);
    showFeedback(feedbackKey, t('status.copied'));
    await onChanged();
  }

  async function saveSelected(): Promise<void> {
    if (!selectedSpell) {
      return;
    }
    await window.spellbook.updateSpell(selectedSpell.id, {
      alias: draft.alias,
      body: draft.body,
      tags: parseTagInput(draft.tags)
    });
    showFeedback('editor:save', t('spell.saved'));
    await onChanged();
  }

  function resetDraft(): void {
    setDraft(createDraft(selectedSpell));
  }

  return (
    <section className="spell-library-grid">
      <div className="spell-list-pane">
        <div className="section-heading">
          <div>
            <h3>{t('library.title')}</h3>
          </div>
          <span className="count-pill">
            {spells.length} {t('metric.spells')}
          </span>
        </div>
        <div className="spell-list">
          {spells.map((spell) => (
            <article className={selectedSpell?.id === spell.id ? 'spell-list-row selected' : 'spell-list-row'} key={spell.id}>
              <button className="spell-row-main" onClick={() => setSelectedId(spell.id)} type="button">
                <div className="spell-row-title" title={getSpellTitle(spell, t)}>
                  {getSpellTitle(spell, t)}
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
              <FeedbackTarget align="right" message={tooltipFor(`spell:${spell.id}:copy`)}>
                <button
                  aria-label={t('spell.copy')}
                  className="icon-button"
                  onClick={() => void copy(spell, `spell:${spell.id}:copy`)}
                  title={t('spell.copy')}
                  type="button"
                >
                  <Clipboard size={15} />
                </button>
              </FeedbackTarget>
            </article>
          ))}
          {spells.length === 0 ? <div className="empty-state">{t('spell.empty')}</div> : null}
        </div>
        {candidates.length ? (
          <div className="candidate-dock">
            <div className="section-heading compact">
              <div>
                <h3>{t('library.candidates')}</h3>
              </div>
              <span className="count-pill">
                {candidates.length} {t('metric.candidates')}
              </span>
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
                  <FeedbackTarget align="right" message={tooltipFor(`candidate:${candidate.id}`)}>
                    <button className="primary-button" onClick={() => void promote(candidate)} type="button">
                      <Plus size={16} />
                      {t('library.save')}
                    </button>
                  </FeedbackTarget>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="spell-editor-pane">
        {selectedSpell ? (
          <form
            className="spell-editor-form"
            onSubmit={(event) => {
              event.preventDefault();
              void saveSelected();
            }}
          >
            <div className="detail-heading">
              <div className="detail-title">
                <h3>{getSpellTitle(selectedSpell, t)}</h3>
              </div>
              <div className="button-row">
                <FeedbackTarget message={tooltipFor('editor:copy')}>
                  <button
                    className="secondary-button"
                    onClick={() => void copy(selectedSpell, 'editor:copy')}
                    type="button"
                  >
                    <Clipboard size={16} />
                    {t('spell.copy')}
                  </button>
                </FeedbackTarget>
                <button className="secondary-button" onClick={resetDraft} type="button">
                  <X size={16} />
                  {t('spell.cancel')}
                </button>
                <FeedbackTarget align="right" message={tooltipFor('editor:save')}>
                  <button className="primary-button" disabled={!draft.body.trim()} type="submit">
                    <Save size={16} />
                    {t('spell.save')}
                  </button>
                </FeedbackTarget>
              </div>
            </div>
            <label className="field-row">
              <span>{t('spell.alias')}</span>
              <input
                onChange={(event) => setDraft((current) => ({ ...current, alias: event.target.value }))}
                placeholder={t('spell.aliasPlaceholder')}
                value={draft.alias}
              />
            </label>
            <label className="field-row">
              <span>{t('spell.tags')}</span>
              <input
                onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
                placeholder={t('spell.tagsPlaceholder')}
                value={draft.tags}
              />
            </label>
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
    alias: spell?.alias ?? '',
    body: spell?.body ?? '',
    tags: spell?.tags.join(', ') ?? ''
  };
}

function getSpellTitle(spell: Spell, t: TFunction): string {
  return spell.alias || firstLine(spell.body) || t('spell.untitled');
}

function firstLine(value: string): string {
  return value.split(/\r?\n/).find((line) => line.trim())?.trim() ?? '';
}

function formatPreview(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function parseTagInput(value: string): string[] {
  const tags: string[] = [];
  for (const tag of value.split(/[,，\n]/)) {
    const normalized = tag.trim();
    if (normalized && !tags.includes(normalized)) {
      tags.push(normalized);
    }
  }
  return tags;
}
