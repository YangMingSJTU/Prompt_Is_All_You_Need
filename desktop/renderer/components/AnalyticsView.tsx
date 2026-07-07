import type { UsageAnalytics } from '../../shared/types';
import type { TFunction } from '../i18n';

interface AnalyticsViewProps {
  analytics: UsageAnalytics | null;
  t: TFunction;
}

export function AnalyticsView({ analytics, t }: AnalyticsViewProps) {
  return (
    <section className="stack">
      <div className="summary-strip">
        <div className="summary-item">
          <span>{t('metric.snippets')}</span>
          <strong>{analytics?.snippetCount ?? 0}</strong>
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
        {(analytics?.topSnippets ?? []).map((snippet) => (
          <article className="candidate-row" key={snippet.id}>
            <div>
              <strong>{snippet.title}</strong>
              <p>{snippet.copyCount} {t('metric.copies')}</p>
            </div>
          </article>
        ))}
        {analytics && analytics.topSnippets.length === 0 ? (
          <div className="empty-state">{t('analytics.empty')}</div>
        ) : null}
      </div>
    </section>
  );
}
