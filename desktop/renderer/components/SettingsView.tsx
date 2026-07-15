import { Database, FolderOpen, Keyboard, Languages, RotateCw } from 'lucide-react';
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
import type { Candidate, ScanProvider, ScanSourceConfig } from '../../shared/types';
import type { TFunction } from '../i18n';
import { useFeedbackToast } from './FeedbackToast';

interface SettingsViewProps {
  activeTab: SettingsTab;
  onChanged(): Promise<void>;
  onTabChange(tab: SettingsTab): void;
  settings: AppSettings;
  onSettingsChanged(settings: AppSettings): void;
  t: TFunction;
}

export type SettingsTab = 'preferences' | 'shortcut' | 'localData';

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

const SCAN_PROVIDERS: ScanProvider[] = ['claude', 'codex'];

export function SettingsView({
  activeTab,
  onChanged,
  onSettingsChanged,
  onTabChange,
  settings,
  t
}: SettingsViewProps) {
  const [info, setInfo] = useState<SettingsInfo | null>(null);
  const [saving, setSaving] = useState(false);
  const [recordingShortcut, setRecordingShortcut] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [selectedProviders, setSelectedProviders] = useState<ScanProvider[]>(['claude', 'codex']);
  const [scanCandidates, setScanCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [runningScan, setRunningScan] = useState(false);
  const [addingCandidates, setAddingCandidates] = useState(false);
  const shortcutButtonRef = useRef<HTMLButtonElement>(null);
  const { showToast } = useFeedbackToast();
  const scanSources = Array.isArray(settings.scanSources) ? settings.scanSources : [];
  const activeScanSources = scanSources.length ? scanSources : info?.defaultScanSources ?? [];

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
      showToast(result.warning ?? t('settings.saved'), {
        variant: result.warning ? 'warning' : 'success'
      });
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
                onClick={() => onTabChange(item.id)}
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
          <SettingsSection title={t('settings.localData')} icon={Database} fill>
            <SettingRow label={t('settings.scanProvider')}>
              <div className="settings-segmented">
                {SCAN_PROVIDERS.map((provider) => (
                  <button
                    className={selectedProviders.includes(provider) ? 'active' : ''}
                    key={provider}
                    onClick={() => toggleProvider(provider)}
                    type="button"
                  >
                    {provider === 'claude' ? 'Claude' : 'Codex'}
                  </button>
                ))}
              </div>
            </SettingRow>
            <div className="scan-source-list">
              {activeScanSources
                .map((source) => (
                  <div className="scan-source-row" key={`${source.provider}:${source.target}`}>
                    <span>{source.provider === 'claude' ? 'Claude' : 'Codex'}</span>
                    <input
                      aria-label={`${source.provider === 'claude' ? 'Claude' : 'Codex'} ${t('metric.path')}`}
                      readOnly
                      title={source.path}
                      value={source.path}
                    />
                    <button
                      className="secondary-button icon-text-button"
                      onClick={() => void chooseScanSourceDirectory(source)}
                      type="button"
                    >
                      <FolderOpen size={15} />
                      {t('settings.scanPath.choose')}
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => resetScanSource(source)}
                      type="button"
                    >
                      {t('settings.scanPath.reset')}
                    </button>
                  </div>
                ))}
            </div>
            <div className="scan-actions">
              <button
                className="primary-button"
                disabled={runningScan || selectedProviders.length === 0}
                onClick={() => void runLocalScan()}
                type="button"
              >
                <RotateCw size={16} />
                {runningScan ? t('scanner.running') : t('scanner.run')}
              </button>
            </div>
            <div className="candidate-results">
                <div className="section-heading compact">
                  <h3>{t('library.candidates')}</h3>
                  <div className="button-row">
                    <button className="secondary-button" onClick={selectAllCandidates} type="button">
                      {t('scanner.selectAll')}
                    </button>
                    <button
                      className="primary-button"
                      disabled={addingCandidates || selectedCandidateIds.length === 0}
                      onClick={() => void promoteSelectedCandidates()}
                      type="button"
                    >
                      {t('scanner.addSelected')}
                    </button>
                  </div>
                </div>
                <div className="candidate-selection-list">
                  {scanCandidates.map((candidate) => {
                    const saved = candidate.status === 'saved';
                    const selected = selectedCandidateIds.includes(candidate.id);
                    return (
                      <label className={saved ? 'candidate-select-row saved' : 'candidate-select-row'} key={candidate.id}>
                        <input
                          checked={selected}
                          disabled={saved}
                          onChange={() => toggleCandidate(candidate.id)}
                          type="checkbox"
                        />
                        <span>
                          <strong>{candidate.title}</strong>
                          <small>{candidate.template}</small>
                        </span>
                        <em>
                          {saved
                            ? t('scanner.candidateSaved')
                            : `${candidate.sourceCount} ${t('metric.sources')}`}
                        </em>
                      </label>
                    );
                  })}
                  {scanCandidates.length === 0 ? <div className="empty-state">{t('scanner.noCandidates')}</div> : null}
                </div>
            </div>
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

  function toggleProvider(provider: ScanProvider): void {
    setSelectedProviders((current) =>
      current.includes(provider)
        ? current.filter((item) => item !== provider)
        : [...current, provider]
    );
  }

  function updateScanSource(source: ScanSourceConfig, patch: Partial<ScanSourceConfig>): void {
    void updateSettings({
      scanSources: activeScanSources.map((item) =>
        item.provider === source.provider && item.target === source.target
          ? { ...item, ...patch }
          : item
      )
    });
  }

  function resetScanSource(source: ScanSourceConfig): void {
    const fallback = info?.defaultScanSources.find(
      (item) => item.provider === source.provider && item.target === source.target
    );
    if (fallback) {
      updateScanSource(source, { path: fallback.path, enabled: fallback.enabled });
    }
  }

  async function chooseScanSourceDirectory(source: ScanSourceConfig): Promise<void> {
    const selectedPath = await window.spellbook.selectDirectory(source.path);
    if (selectedPath) {
      updateScanSource(source, { path: selectedPath });
    }
  }

  async function runLocalScan(): Promise<void> {
    setRunningScan(true);
    try {
      const result = await window.spellbook.runScan({
        target: 'spells',
        providers: selectedProviders,
        scanSources: activeScanSources
      });
      setScanCandidates(result.candidates);
      setSelectedCandidateIds([]);
      showToast(`${t('status.scanFinished')}: ${result.candidates.length}`);
      await onChanged();
    } finally {
      setRunningScan(false);
    }
  }

  function toggleCandidate(candidateId: string): void {
    setSelectedCandidateIds((current) =>
      current.includes(candidateId)
        ? current.filter((item) => item !== candidateId)
        : [...current, candidateId]
    );
  }

  function selectAllCandidates(): void {
    setSelectedCandidateIds(
      scanCandidates
        .filter((candidate) => candidate.status !== 'saved')
        .map((candidate) => candidate.id)
    );
  }

  async function promoteSelectedCandidates(): Promise<void> {
    setAddingCandidates(true);
    try {
      const result = await window.spellbook.promoteCandidates(selectedCandidateIds);
      setScanCandidates(await window.spellbook.listCandidates());
      setSelectedCandidateIds([]);
      showToast(
        `${t('scanner.addedCandidates')}: ${result.created.length}, ${t('scanner.skippedCandidates')}: ${result.skipped.length}`
      );
      await onChanged();
    } finally {
      setAddingCandidates(false);
    }
  }
}

function SettingsSection({
  title,
  icon: Icon,
  children,
  fill = false
}: {
  title: string;
  icon: typeof Languages;
  children: ReactNode;
  fill?: boolean;
}) {
  return (
    <div className={fill ? 'settings-section fill' : 'settings-section'}>
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
