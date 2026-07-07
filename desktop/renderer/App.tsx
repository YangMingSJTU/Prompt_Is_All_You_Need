import { BarChart3, Database, Library, Search, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../shared/settings';
import type { Candidate, Prompt, UsageAnalytics } from '../shared/types';
import { AnalyticsView } from './components/AnalyticsView';
import { FloatingPanel } from './components/FloatingPanel';
import { LibraryView } from './components/LibraryView';
import { PromptPanel } from './components/PromptPanel';
import { ScannerView } from './components/ScannerView';
import { SettingsView } from './components/SettingsView';
import { createTranslator, resolveLocalePreference } from './i18n';

type View = 'panel' | 'library' | 'scanner' | 'analytics' | 'settings';

const NAV_ITEMS: Array<{ id: View; labelKey: 'nav.panel' | 'nav.library' | 'nav.scanner' | 'nav.analytics'; icon: typeof Search }> = [
  { id: 'panel', labelKey: 'nav.panel', icon: Search },
  { id: 'library', labelKey: 'nav.library', icon: Library },
  { id: 'scanner', labelKey: 'nav.scanner', icon: Database },
  { id: 'analytics', labelKey: 'nav.analytics', icon: BarChart3 }
];

export function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const t = useMemo(
    () => createTranslator(resolveLocalePreference(settings.language, globalThis.navigator?.language)),
    [settings.language]
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

  useEffect(() => {
    void window.apm.getSettings().then(setSettings);
  }, []);

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
    if (view === 'settings') {
      return (
        <SettingsView
          settings={settings}
          onSettingsChanged={setSettings}
          onMessage={setMessage}
          t={t}
        />
      );
    }
    return <PromptPanel prompts={prompts} onChanged={refresh} onMessage={setMessage} t={t} />;
  }, [analytics, candidates, prompts, refresh, settings, t, view]);

  const selectedNavItem =
    view === 'settings'
      ? { id: 'settings' as const, labelKey: 'settings.title' as const, icon: Settings }
      : NAV_ITEMS.find((item) => item.id === view) ?? NAV_ITEMS[0];
  const PageIcon = selectedNavItem.icon;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">PM</div>
          <h1>{t('app.brand')}</h1>
        </div>
        <nav className="nav-list" aria-label="Navigation">
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
        <div className="sidebar-footer">
          <button
            className={view === 'settings' ? 'settings-entry active' : 'settings-entry'}
            onClick={() => setView('settings')}
            type="button"
          >
            <Settings size={16} />
            <span>{t('settings.title')}</span>
          </button>
        </div>
      </aside>
      <main className="workspace">
        <header className="topbar">
          <div className="topbar-title">
            <PageIcon size={16} />
            <h2>{t(selectedNavItem.labelKey)}</h2>
          </div>
          <div className="status-pill">{message}</div>
        </header>
        {selectedView}
      </main>
    </div>
  );
}
