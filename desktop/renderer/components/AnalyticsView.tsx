import type { UsageAnalytics } from '../../shared/types';
import type { TFunction } from '../i18n';
import { getSpellDisplayText } from '../spellDisplay';

interface AnalyticsViewProps {
  analytics: UsageAnalytics | null;
  t: TFunction;
}

export function AnalyticsView({ analytics, t }: AnalyticsViewProps) {
  return (
    <section className="stack">
      <div className="summary-strip">
        <div className="summary-item">
          <span>{t('metric.spells')}</span>
          <strong>{analytics?.spellCount ?? 0}</strong>
        </div>
        <div className="summary-item">
          <span>{t('metric.skills')}</span>
          <strong>{analytics?.skillCount ?? 0}</strong>
        </div>
        <div className="summary-item">
          <span>{t('metric.candidates')}</span>
          <strong>{analytics?.candidateCount ?? 0}</strong>
        </div>
        <div className="summary-item">
          <span>{t('metric.copies')}</span>
          <strong>{analytics?.totalCopies ?? 0}</strong>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <h3>{t('analytics.topCopied')}</h3>
        </div>
      </div>
      <div className="candidate-list">
        {(analytics?.topSpells ?? []).map((spell) => (
          <article className="candidate-row" key={spell.id}>
            <div>
              <pre className="spell-text-block compact">{getSpellDisplayText(spell)}</pre>
              <p>{spell.copyCount} {t('metric.copies')}</p>
            </div>
          </article>
        ))}
        {analytics && analytics.topSpells.length === 0 ? (
          <div className="empty-state">{t('analytics.empty')}</div>
        ) : null}
      </div>
    </section>
  );
}
