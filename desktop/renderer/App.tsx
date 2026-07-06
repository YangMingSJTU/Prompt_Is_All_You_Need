import { BarChart3, Database, Library, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Candidate, Prompt, UsageAnalytics } from '../shared/types';
import { AnalyticsView } from './components/AnalyticsView';
import { LibraryView } from './components/LibraryView';
import { PromptPanel } from './components/PromptPanel';
import { ScannerView } from './components/ScannerView';

type View = 'panel' | 'library' | 'scanner' | 'analytics';

const NAV_ITEMS: Array<{ id: View; label: string; icon: typeof Search }> = [
  { id: 'panel', label: 'Prompt Panel', icon: Search },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'scanner', label: 'Scanner', icon: Database },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 }
];

export function App() {
  const [view, setView] = useState<View>('panel');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [message, setMessage] = useState('Ready');

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
        />
      );
    }
    if (view === 'scanner') {
      return <ScannerView onChanged={refresh} onMessage={setMessage} />;
    }
    if (view === 'analytics') {
      return <AnalyticsView analytics={analytics} />;
    }
    return <PromptPanel prompts={prompts} onChanged={refresh} onMessage={setMessage} />;
  }, [analytics, candidates, prompts, refresh, view]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">APM</div>
          <div>
            <h1>Agent Prompt Miner</h1>
            <p>Local prompt launcher</p>
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
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="shortcut-note">
          <span>Hotkey</span>
          <strong>Ctrl Shift Space</strong>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Desktop v0.1</p>
            <h2>{NAV_ITEMS.find((item) => item.id === view)?.label}</h2>
          </div>
          <div className="status-pill">{message}</div>
        </header>
        {selectedView}
      </main>
    </div>
  );
}
