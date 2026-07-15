import { BarChart3, Library, Package, Search, Settings } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { resolveAppName } from '../shared/appIdentity';
import {
  APP_SIDEBAR_WIDTH,
  APP_TITLEBAR_HEIGHT,
  MAIN_WINDOW_COMPACT_MIN_WIDTH,
  MAIN_WINDOW_MIN_HEIGHT,
  MAIN_WINDOW_MIN_WIDTH
} from '../shared/layout';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '../shared/settings';
import type { Candidate, Spell, UsageAnalytics } from '../shared/types';
import appIconUrl from '../../assets/icons/app-icon.png';
import { AnalyticsView } from './components/AnalyticsView';
import { FeedbackToastProvider } from './components/FeedbackToast';
import { FloatingPanel } from './components/FloatingPanel';
import { LibraryView } from './components/LibraryView';
import { SettingsView, type SettingsTab } from './components/SettingsView';
import { SkillLibraryView } from './components/SkillLibraryView';
import { SpellPanel } from './components/SpellPanel';
import { createTranslator, resolveLocalePreference } from './i18n';

type View = 'panel' | 'library' | 'skills' | 'analytics' | 'settings';

const NAV_ITEMS: Array<{
  id: View;
  labelKey: 'nav.panel' | 'nav.library' | 'nav.skills' | 'nav.analytics';
  icon: typeof Search;
}> = [
  { id: 'panel', labelKey: 'nav.panel', icon: Search },
  { id: 'library', labelKey: 'nav.library', icon: Library },
  { id: 'skills', labelKey: 'nav.skills', icon: Package },
  { id: 'analytics', labelKey: 'nav.analytics', icon: BarChart3 }
];

const APP_FRAME_BASE_STYLE = {
  '--app-min-height': `${MAIN_WINDOW_MIN_HEIGHT}px`,
  '--app-sidebar-width': `${APP_SIDEBAR_WIDTH}px`,
  '--app-titlebar-height': `${APP_TITLEBAR_HEIGHT}px`
} as CSSProperties;

export function App() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const t = useMemo(
    () => createTranslator(resolveLocalePreference(settings.language, globalThis.navigator?.language)),
    [settings.language]
  );
  const mode = useMemo(() => new URLSearchParams(globalThis.location.search).get('mode'), []);
  const [view, setView] = useState<View>('panel');
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('preferences');
  const [spells, setSpells] = useState<Spell[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [analytics, setAnalytics] = useState<UsageAnalytics | null>(null);

  if (mode === 'floating') {
    return (
      <FeedbackToastProvider>
        <FloatingPanel t={t} />
      </FeedbackToastProvider>
    );
  }

  const refresh = useCallback(async () => {
    const [spellList, candidateList, usage] = await Promise.all([
      window.spellbook.listSpells(),
      window.spellbook.listCandidates(),
      window.spellbook.getAnalytics()
    ]);
    setSpells(spellList);
    setCandidates(candidateList);
    setAnalytics(usage);
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

  useEffect(() => {
    const recommendationWindowOpen =
      view !== 'library' || settings.recommendationPanelOpen;
    void window.spellbook.setRecommendationPanelWindowOpen(recommendationWindowOpen);
  }, [settings.recommendationPanelOpen, view]);

  const updateRecommendationPanelOpen = useCallback(async (open: boolean, panelWidth?: number) => {
    const result = await window.spellbook.updateSettings({ recommendationPanelOpen: open });
    await window.spellbook.setRecommendationPanelWindowOpen(open, panelWidth);
    setSettings(result.settings);
  }, []);

  const openSettings = useCallback((tab: SettingsTab) => {
    setSettingsTab(tab);
    setView('settings');
  }, []);

  const selectedView = useMemo(() => {
    if (view === 'library') {
      return (
        <LibraryView
          spells={spells}
          candidates={candidates}
          onChanged={refresh}
          onOpenRecommendationDiscovery={() => openSettings('localData')}
          onRecommendationPanelOpenChange={updateRecommendationPanelOpen}
          recommendationPanelOpen={settings.recommendationPanelOpen}
          t={t}
        />
      );
    }
    if (view === 'skills') {
      return <SkillLibraryView t={t} />;
    }
    if (view === 'analytics') {
      return <AnalyticsView analytics={analytics} t={t} />;
    }
    if (view === 'settings') {
      return (
        <SettingsView
          activeTab={settingsTab}
          onChanged={refresh}
          onTabChange={setSettingsTab}
          settings={settings}
          onSettingsChanged={setSettings}
          t={t}
        />
      );
    }
    return <SpellPanel spells={spells} onChanged={refresh} t={t} />;
  }, [analytics, candidates, openSettings, refresh, settings, settingsTab, spells, t, updateRecommendationPanelOpen, view]);

  const compactLibraryWindow = view === 'library' && !settings.recommendationPanelOpen;
  const appFrameStyle = {
    ...APP_FRAME_BASE_STYLE,
    '--app-min-width': `${compactLibraryWindow ? MAIN_WINDOW_COMPACT_MIN_WIDTH : MAIN_WINDOW_MIN_WIDTH}px`
  } as CSSProperties;

  return (
    <FeedbackToastProvider>
      <div className="app-frame" style={appFrameStyle}>
        <header className="app-titlebar">
          <div className="titlebar-brand">
            <img alt="" src={appIconUrl} />
            <span>{resolveAppName(settings.language, globalThis.navigator?.language)}</span>
          </div>
          <div className="titlebar-window-controls" aria-hidden />
        </header>
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
                onClick={() => openSettings('preferences')}
                type="button"
              >
                <Settings size={16} />
                <span>{t('settings.title')}</span>
              </button>
            </div>
          </aside>
          <main className="workspace">{selectedView}</main>
        </div>
      </div>
    </FeedbackToastProvider>
  );
}
