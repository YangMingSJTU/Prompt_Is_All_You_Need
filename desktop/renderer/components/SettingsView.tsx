import { Database, FolderSearch, Keyboard, Languages } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_APP_SETTINGS,
  formatShortcutDisplay,
  shortcutFromKeyInput,
  type AppLanguage,
  type AppSettings,
  type QuickPanelPlacement,
  type SettingsInfo
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

const PLACEMENT_OPTIONS: Array<{
  value: QuickPanelPlacement;
  labelKey: 'settings.placement.center' | 'settings.placement.mouse';
}> = [
  { value: 'center', labelKey: 'settings.placement.center' },
  { value: 'mouse', labelKey: 'settings.placement.mouse' }
];

export function SettingsView({ settings, onSettingsChanged, onMessage, t }: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('preferences');
  const [info, setInfo] = useState<SettingsInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [recordingShortcut, setRecordingShortcut] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const shortcutButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    void window.spellbook.getSettingsInfo().then(setInfo);
  }, []);

  useEffect(() => {
    if (recordingShortcut) {
      shortcutButtonRef.current?.focus();
    }
  }, [recordingShortcut]);

  async function updateSettings(patch: Partial<AppSettings>): Promise<void> {
    setSaving(true);
    try {
      const result = await window.spellbook.updateSettings(patch);
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
            <SettingRow label={t('settings.quickPanelShortcut')}>
              <div className="shortcut-editor">
                <button
                  aria-label={t('settings.shortcut.change')}
                  className={
                    recordingShortcut ? 'shortcut-capture recording' : 'shortcut-capture'
                  }
                  disabled={saving}
                  onClick={startRecordingShortcut}
                  onKeyDown={handleShortcutKeyDown}
                  ref={shortcutButtonRef}
                  title={formatShortcutDisplay(settings.quickPanelShortcut)}
                  type="button"
                >
                  <span>
                    {recordingShortcut
                      ? t('settings.shortcut.recording')
                      : formatShortcutDisplay(settings.quickPanelShortcut)}
                  </span>
                  {recordingShortcut ? <small>{t('settings.shortcut.recordingHint')}</small> : null}
                </button>
                <button
                  className="secondary-button shortcut-reset"
                  disabled={
                    saving ||
                    settings.quickPanelShortcut === DEFAULT_APP_SETTINGS.quickPanelShortcut
                  }
                  onClick={() => void updateShortcut(DEFAULT_APP_SETTINGS.quickPanelShortcut)}
                  type="button"
                >
                  {t('settings.shortcut.reset')}
                </button>
                {shortcutError ? <span className="settings-error">{shortcutError}</span> : null}
              </div>
            </SettingRow>
            <SettingRow label={t('settings.quickPanelPlacement')}>
              <div className="settings-segmented placement-options">
                {PLACEMENT_OPTIONS.map((option) => (
                  <button
                    className={settings.quickPanelPlacement === option.value ? 'active' : ''}
                    disabled={saving}
                    key={option.value}
                    onClick={() => void updateSettings({ quickPanelPlacement: option.value })}
                    type="button"
                  >
                    {t(option.labelKey)}
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
            {(info?.skillRoots ?? []).map((root) => (
              <InfoRow
                key={root.platform}
                label={`${root.platform === 'claude' ? 'Claude' : 'Codex'} ${t('settings.skillRoot')}`}
                value={root.path}
              />
            ))}
          </SettingsSection>
        ) : null}
      </div>
    </section>
  );

  function startRecordingShortcut(): void {
    setShortcutError(null);
    setRecordingShortcut(true);
  }

  function handleShortcutKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!recordingShortcut) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      setRecordingShortcut(false);
      setShortcutError(null);
      return;
    }
    if (event.key === 'Control' || event.key === 'Shift' || event.key === 'Alt' || event.key === 'Meta') {
      return;
    }

    const shortcut = shortcutFromKeyInput({
      key: event.key,
      code: event.code,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      shiftKey: event.shiftKey
    });
    if (!shortcut) {
      setShortcutError(t('settings.shortcut.invalid'));
      return;
    }

    setRecordingShortcut(false);
    setShortcutError(null);
    void updateShortcut(shortcut.accelerator);
  }

  async function updateShortcut(accelerator: string): Promise<void> {
    await updateSettings({ quickPanelShortcut: accelerator });
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
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <strong>{label}</strong>
        {description ? <span>{description}</span> : null}
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
