import type { UsageAnalytics } from '../../shared/types';
import type { TFunction } from '../i18n';

interface AnalyticsViewProps {
  analytics: UsageAnalytics | null;
  t: TFunction;
}

export function AnalyticsView({ analytics, t }: AnalyticsViewProps) {
  return (
    <section className="stack">
      <div className="metric-grid">
        <div className="metric-card">
          <span>{t('metric.prompts')}</span>
          <strong>{analytics?.promptCount ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>{t('metric.candidates')}</span>
          <strong>{analytics?.candidateCount ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>{t('metric.copies')}</span>
          <strong>{analytics?.totalCopies ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>{t('metric.exports')}</span>
          <strong>{analytics?.exportedAssetCount ?? 0}</strong>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t('analytics.usage')}</p>
          <h3>{t('analytics.topCopied')}</h3>
        </div>
      </div>
      <div className="candidate-list">
        {(analytics?.topPrompts ?? []).map((prompt) => (
          <article className="candidate-row" key={prompt.id}>
            <div>
              <strong>{prompt.title}</strong>
              <p>{prompt.copyCount} {t('metric.copies')}</p>
            </div>
          </article>
        ))}
        {analytics && analytics.topPrompts.length === 0 ? (
          <div className="empty-state">{t('analytics.empty')}</div>
        ) : null}
      </div>
    </section>
  );
}
