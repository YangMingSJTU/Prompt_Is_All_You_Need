import type { UsageAnalytics } from '../../shared/types';

interface AnalyticsViewProps {
  analytics: UsageAnalytics | null;
}

export function AnalyticsView({ analytics }: AnalyticsViewProps) {
  return (
    <section className="stack">
      <div className="metric-grid">
        <div className="metric-card">
          <span>Prompts</span>
          <strong>{analytics?.promptCount ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>Candidates</span>
          <strong>{analytics?.candidateCount ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>Copies</span>
          <strong>{analytics?.totalCopies ?? 0}</strong>
        </div>
        <div className="metric-card">
          <span>Exports</span>
          <strong>{analytics?.exportedAssetCount ?? 0}</strong>
        </div>
      </div>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Usage</p>
          <h3>Top copied prompts</h3>
        </div>
      </div>
      <div className="candidate-list">
        {(analytics?.topPrompts ?? []).map((prompt) => (
          <article className="candidate-row" key={prompt.id}>
            <div>
              <strong>{prompt.title}</strong>
              <p>{prompt.copyCount} copy actions</p>
            </div>
          </article>
        ))}
        {analytics && analytics.topPrompts.length === 0 ? (
          <div className="empty-state">Copy a prompt to start collecting local usage stats.</div>
        ) : null}
      </div>
    </section>
  );
}
