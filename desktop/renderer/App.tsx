import { BarChart3, Database, Library, Package, Search, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveAppName } from '../shared/appIdentity';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../shared/settings';
import type { Candidate, SkillRecord, Spell, UsageAnalytics } from '../shared/types';
import { AnalyticsView } from './components/AnalyticsView';
import { FloatingPanel } from './components/FloatingPanel';
import { LibraryView } from './components/LibraryView';
import { ScannerView } from './components/ScannerView';
import { SettingsView } from './components/SettingsView';
import { SkillLibraryView } from './components/SkillLibraryView';
import { SpellPanel } from './components/SpellPanel';
import { createTranslator, resolveLocalePreference } from './i18n';

type View = 'panel' | 'library' | 'skills' | 'scanner' | 'analytics' | 'settings';

const NAV_ITEMS: Array<{
  id: View;
  labelKey: 'nav.panel' | 'nav.library' | 'nav.skills' | 'nav.scanner' | 'nav.analytics';
  icon: typeof Search;
}> = [
  { id: 'panel', labelKey: 'nav.panel', icon: Search },
  { id: 'library', labelKey: 'nav.library', icon: Library },
  { id: 'skills', labelKey: 'nav.skills', icon: Package },
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
  const [spells, setSpells] = useState<Spell[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);
  const [message, setMessage] = useState('');

  if (mode === 'floating') {
    return <FloatingPanel t={t} />;
  }

  const refresh = useCallback(async () => {
    const [spellList, candidateList, usage, skillList] = await Promise.all([
      window.spellbook.listSpells(),
      window.spellbook.listCandidates(),
      window.spellbook.getAnalytics(),
      window.spellbook.listSkills()
    ]);
    setSpells(spellList);
    setCandidates(candidateList);
    setAnalytics(usage);
    setSkills(skillList);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void window.spellbook.getSettings().then(setSettings);
  }, []);

  useEffect(() => {
    document.title = resolveAppName(settings.language, globalThis.navigator?.language);
  }, [settings.language]);

  const selectedView = useMemo(() => {
    if (view === 'library') {
      return (
        <LibraryView
          spells={spells}
          candidates={candidates}
          onChanged={refresh}
          onMessage={setMessage}
          t={t}
        />
      );
    }
    if (view === 'skills') {
      return <SkillLibraryView skills={skills} onChanged={refresh} onMessage={setMessage} t={t} />;
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
    return <SpellPanel spells={spells} onChanged={refresh} onMessage={setMessage} t={t} />;
  }, [analytics, candidates, refresh, settings, skills, spells, t, view]);

  const selectedNavItem =
    view === 'settings'
      ? { id: 'settings' as const, labelKey: 'settings.title' as const, icon: Settings }
      : NAV_ITEMS.find((item) => item.id === view) ?? NAV_ITEMS[0];
  const PageIcon = selectedNavItem.icon;

  return (
    <div className="app-shell">
      <aside className="sidebar">
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
          {message ? <div className="status-pill">{message}</div> : null}
        </header>
        {selectedView}
      </main>
    </div>
  );
}
