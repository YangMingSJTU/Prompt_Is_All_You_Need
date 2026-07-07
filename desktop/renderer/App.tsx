import { BarChart3, Database, Library, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Candidate, Prompt, UsageAnalytics } from '../shared/types';
import { AnalyticsView } from './components/AnalyticsView';
import { FloatingPanel } from './components/FloatingPanel';
import { LibraryView } from './components/LibraryView';
import { PromptPanel } from './components/PromptPanel';
import { ScannerView } from './components/ScannerView';
import { createTranslator, detectLocale } from './i18n';

type View = 'panel' | 'library' | 'scanner' | 'analytics';

const NAV_ITEMS: Array<{ id: View; labelKey: 'nav.panel' | 'nav.library' | 'nav.scanner' | 'nav.analytics'; icon: typeof Search }> = [
  { id: 'panel', labelKey: 'nav.panel', icon: Search },
  { id: 'library', labelKey: 'nav.library', icon: Library },
  { id: 'scanner', labelKey: 'nav.scanner', icon: Database },
  { id: 'analytics', labelKey: 'nav.analytics', icon: BarChart3 }
];

export function App() {
  const t = useMemo(
    () => createTranslator(detectLocale(globalThis.navigator?.language)),
    []
  );
  const mode = useMemo(() => new URLSearchParams(globalThis.location.search).get('mode'), []);
  const [view, setView] = useState<View>('panel');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [message, setMessage] = useState(t('status.ready'));

  if (mode === 'floating') {
    return <FloatingPanel t={t} />;
  }

  const refresh = useCallback(async () => {
    const [promptList, candidateList, usage] = await Promise.all([
      window.apm.listPrompts(),
      window.apm.listCandidates(),
      window.apm.getAnalytics()
    ]);
    setPrompts(promptList);
    setCandidates(candidateList);
    setAnalytics(usage);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const selectedView = useMemo(() => {
    if (view === 'library') {
      return (
        <LibraryView
          prompts={prompts}
          candidates={candidates}
          onChanged={refresh}
          onMessage={setMessage}
          t={t}
        />
      );
    }
    if (view === 'scanner') {
      return <ScannerView onChanged={refresh} onMessage={setMessage} t={t} />;
    }
    if (view === 'analytics') {
      return <AnalyticsView analytics={analytics} t={t} />;
    }
    return <PromptPanel prompts={prompts} onChanged={refresh} onMessage={setMessage} t={t} />;
  }, [analytics, candidates, prompts, refresh, t, view]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">APM</div>
          <div>
            <h1>Agent Prompt Miner</h1>
            <p>{t('app.subtitle')}</p>
          </div>
        </div>
        <nav className="nav-list" aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={view === item.id ? 'nav-item active' : 'nav-item'}
                key={item.id}
                onClick={() => setView(item.id)}
                type="button"
              >
                <Icon size={18} />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </nav>
        <div className="shortcut-note">
          <span>{t('shortcut.label')}</span>
          <strong>{t('shortcut.value')}</strong>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">{t('app.version')}</p>
            <h2>{t(NAV_ITEMS.find((item) => item.id === view)?.labelKey ?? 'nav.panel')}</h2>
          </div>
          <div className="status-pill">{message}</div>
        </header>
        {selectedView}
      </main>
    </div>
  );
}
