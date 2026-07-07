import { Database, FolderSearch, Keyboard, Languages } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import {
  SHORTCUT_OPTIONS,
  type AppLanguage,
  type AppSettings,
  type SettingsInfo,
  type ShortcutId
} from '../../shared/settings';
import type { TFunction } from '../i18n';

interface SettingsViewProps {
  settings: AppSettings;
  onSettingsChanged(settings: AppSettings): void;
  onMessage(message: string): void;
  t: TFunction;
}

type SettingsTab = 'preferences' | 'shortcut' | 'localData';

const SETTINGS_TABS: Array<{
  id: SettingsTab;
  labelKey: 'settings.preferences' | 'settings.shortcut' | 'settings.localData';
  icon: typeof Languages;
}> = [
  { id: 'preferences', labelKey: 'settings.preferences', icon: Languages },
  { id: 'shortcut', labelKey: 'settings.shortcut', icon: Keyboard },
  { id: 'localData', labelKey: 'settings.localData', icon: Database }
];

const LANGUAGE_OPTIONS: Array<{
  value: AppLanguage;
  labelKey: 'settings.language.system' | 'settings.language.zh' | 'settings.language.en';
}> = [
  { value: 'system', labelKey: 'settings.language.system' },
  { value: 'zh', labelKey: 'settings.language.zh' },
  { value: 'en', labelKey: 'settings.language.en' }
];

export function SettingsView({ settings, onSettingsChanged, onMessage, t }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('preferences');
  const [info, setInfo] = useState<SettingsInfo | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void window.apm.getSettingsInfo().then(setInfo);
  }, []);

  async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
    setSaving(true);
    try {
      const result = await window.apm.updateSettings(patch);
      onSettingsChanged(result.settings);
      onMessage(result.warning ?? t('settings.saved'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settings-layout">
      <aside className="settings-tabs" aria-label={t('settings.title')}>
        <h3>{t('settings.title')}</h3>
        <div className="settings-tab-list">
          {SETTINGS_TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={activeTab === item.id ? 'settings-tab active' : 'settings-tab'}
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                type="button"
              >
                <Icon size={15} />
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="settings-content">
        {activeTab === 'preferences' ? (
          <SettingsSection title={t('settings.preferences')} icon={Languages}>
            <SettingRow label={t('settings.language')} description={t('settings.language.description')}>
              <div className="settings-segmented">
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    className={settings.language === option.value ? 'active' : ''}
                    disabled={saving}
                    key={option.value}
                    onClick={() => void updateSettings({ language: option.value })}
                    type="button"
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </SettingRow>
          </SettingsSection>
        ) : null}

        {activeTab === 'shortcut' ? (
          <SettingsSection title={t('settings.shortcut')} icon={Keyboard}>
            <SettingRow label={t('settings.quickPanelShortcut')} description={t('settings.shortcut.description')}>
              <div className="settings-segmented shortcut-options">
                {SHORTCUT_OPTIONS.map((option) => (
                  <button
                    className={settings.quickPanelShortcut === option.id ? 'active' : ''}
                    disabled={saving}
                    key={option.id}
                    onClick={() => void updateShortcut(option.id)}
                    type="button"
                  >
                    {option.display}
                  </button>
                ))}
              </div>
            </SettingRow>
          </SettingsSection>
        ) : null}

        {activeTab === 'localData' ? (
          <SettingsSection title={t('settings.localData')} icon={FolderSearch}>
            <InfoRow label={t('settings.databasePath')} value={info?.databasePath ?? t('settings.loading')} />
            {(info?.historyRoots ?? []).map((root) => (
              <InfoRow
                key={root.sourceTool}
                label={`${root.sourceTool === 'claude' ? 'Claude' : 'Codex'} ${t('settings.historyRoot')}`}
                value={root.path}
              />
            ))}
            {(info?.exportTargets ?? []).map((target) => (
              <InfoRow key={target.label} label={target.label} value={target.path} />
            ))}
          </SettingsSection>
        ) : null}
      </div>
    </section>
  );

  async function updateShortcut(shortcutId: ShortcutId): Promise<void> {
    await updateSettings({ quickPanelShortcut: shortcutId });
  }
}

function SettingsSection({
  title,
  icon: Icon,
  children
}: {
  title: string;
  icon: typeof Languages;
  children: ReactNode;
}) {
  return (
    <div className="settings-section">
      <div className="settings-section-heading">
        <Icon size={15} />
        <h3>{title}</h3>
      </div>
      <div className="settings-card">{children}</div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children
}: {
  label: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{label}</strong>
        <span>{description}</span>
      </div>
      <div className="setting-control">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-info-row">
      <span>{label}</span>
      <code title={value}>{value}</code>
    </div>
  );
}
