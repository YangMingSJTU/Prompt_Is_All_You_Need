import { Clipboard, Plus } from 'lucide-react';
import type { Candidate, Spell } from '../../shared/types';
import type { TFunction } from '../i18n';
import { getCandidateDisplayText, getSpellDisplayText } from '../spellDisplay';

interface LibraryViewProps {
  spells: Spell[];
  candidates: Candidate[];
  onChanged(): Promise<void>;
  onMessage(message: string): void;
  t: TFunction;
}

export function LibraryView({
  spells,
  candidates,
  onChanged,
  onMessage,
  t
}: LibraryViewProps) {
  async function promote(candidate: Candidate): Promise<void> {
    await window.spellbook.promoteCandidate(candidate.id);
    onMessage(t('library.saved'));
    await onChanged();
  }

  async function copy(spell: Spell): Promise<void> {
    await window.spellbook.copySpell(spell.id);
    onMessage(t('status.copied'));
    await onChanged();
  }

  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <h3>{t('library.title')}</h3>
        </div>
        <span className="count-pill">{spells.length} {t('metric.spells')}</span>
      </div>
      <div className="card-grid">
        {spells.map((spell) => (
          <article className="spell-card" key={spell.id}>
            <pre className="spell-text-block">{getSpellDisplayText(spell)}</pre>
            <button className="secondary-button" onClick={() => copy(spell)} type="button">
              <Clipboard size={16} />
              {t('spell.copy')}
            </button>
          </article>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <h3>{t('library.candidates')}</h3>
        </div>
        <span className="count-pill">{candidates.length} {t('metric.candidates')}</span>
      </div>
      <div className="candidate-list">
        {candidates.map((candidate) => (
          <article className="candidate-row" key={candidate.id}>
            <div>
              <pre className="spell-text-block compact">{getCandidateDisplayText(candidate)}</pre>
              <small>
                {candidate.sourceCount} {t('metric.sources')} · {t('metric.score')} {candidate.score}
              </small>
            </div>
            <button className="primary-button" onClick={() => promote(candidate)} type="button">
              <Plus size={16} />
              {t('library.save')}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
