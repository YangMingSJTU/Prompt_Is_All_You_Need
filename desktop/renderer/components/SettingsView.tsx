import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FolderOpen,
  Keyboard,
  Languages,
  RotateCw,
  X,
  XCircle
} from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_APP_SETTINGS,
  getShortcutAccessibleText,
  getShortcutKeycaps,
  shortcutFromKeyInput,
  type AppLanguage,
  type AppSettings,
  type AppSettingsPatch,
  type QuickPanelShortcutState,
  type QuickPanelPlacement,
  type SettingsInfo,
  type ShortcutCaptureEndResult,
  type ShortcutPlatform,
  type ShortcutUpdateRequest,
  type ShortcutUpdateResult
} from '../../shared/settings';
import type { Candidate, ScanProvider, ScanSourceConfig, ScanTarget, SkillRecord } from '../../shared/types';
import type { TFunction } from '../i18n';
import {
  getShortcutButtonPresentation,
  restoreShortcutButtonFocus,
  type ShortcutFocusEvent
} from '../shortcutCaptureUi';
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

const SCAN_TARGET_OPTIONS: Array<{
  value: ScanTarget;
  labelKey: 'settings.scanTarget.spells' | 'settings.scanTarget.skills';
}> = [
  { value: 'spells', labelKey: 'settings.scanTarget.spells' },
  { value: 'skills', labelKey: 'settings.scanTarget.skills' }
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
  const [shortcutState, setShortcutState] = useState<QuickPanelShortcutState | null>(null);
  const [shortcutSaving, setShortcutSaving] = useState(false);
  const [recordingShortcut, setRecordingShortcut] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [shortcutCandidate, setShortcutCandidate] = useState<string | null>(null);
  const [modifierPreview, setModifierPreview] = useState<string[]>([]);
  const [scanTarget, setScanTarget] = useState<ScanTarget>('spells');
  const [selectedProviders, setSelectedProviders] = useState<ScanProvider[]>(['claude', 'codex']);
  const [scanCandidates, setScanCandidates] = useState<Candidate[]>([]);
  const [scanSkills, setScanSkills] = useState<SkillRecord[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);
  const [runningScan, setRunningScan] = useState(false);
  const [addingCandidates, setAddingCandidates] = useState(false);
  const shortcutButtonRef = useRef<HTMLButtonElement>(null);
  const shortcutSettingRef = useRef<HTMLDivElement>(null);
  const shortcutCaptureTokenRef = useRef<string | null>(null);
  const { showToast } = useFeedbackToast();
  const scanSources = Array.isArray(settings.scanSources) ? settings.scanSources : [];
  const activeScanSources = scanSources.length ? scanSources : info?.defaultScanSources ?? [];
  const shortcutButtonPresentation = getShortcutButtonPresentation({
    state: shortcutState,
    recording: recordingShortcut,
    applying: shortcutSaving,
    candidate: shortcutCandidate,
    modifierPreview,
    t
  });

  useEffect(() => {
    void window.spellbook.getSettingsInfo().then(setInfo);
  }, []);

  useEffect(() => {
    if (activeTab === 'shortcut') {
      void window.spellbook.getQuickPanelShortcutState().then(setShortcutState);
    } else {
      void cancelShortcutCapture(false);
    }
  }, [activeTab]);

  useEffect(() => {
    return () => {
      const sessionToken = shortcutCaptureTokenRef.current;
      shortcutCaptureTokenRef.current = null;
      if (sessionToken) {
        void window.spellbook.endShortcutCapture(sessionToken);
      }
    };
  }, []);

  useEffect(
    () =>
      window.spellbook.onShortcutCaptureEnded((result) => {
        shortcutCaptureTokenRef.current = null;
        setRecordingShortcut(false);
        setModifierPreview([]);
        setShortcutCandidate(null);
        applyShortcutCaptureEndResult(result);
      }),
    [t]
  );

  useEffect(() => {
    if (!recordingShortcut) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!shortcutSettingRef.current?.contains(event.target as Node)) {
        void cancelShortcutCapture(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [recordingShortcut]);

  useEffect(() => {
    if (recordingShortcut) {
      shortcutButtonRef.current?.focus();
    }
  }, [recordingShortcut]);

  async function updateSettings(patch: AppSettingsPatch): Promise<void> {
    setSaving(true);
    try {
      const result = await window.spellbook.updateSettings(patch);
      onSettingsChanged(result.settings);
      showToast(t('settings.saved'), { variant: 'success' });
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
          <div className="settings-shortcut-page">
            <SettingsSection title={t('settings.shortcut.globalSection')} icon={Keyboard}>
              <div
                aria-busy={shortcutSaving}
                className="shortcut-setting"
                id="quick-panel-shortcut-setting"
                ref={shortcutSettingRef}
              >
                <div className="shortcut-setting-copy">
                  <div className="shortcut-setting-title">
                    <strong>{t('settings.quickPanelShortcut')}</strong>
                    <span className="shortcut-scope">{t('settings.shortcut.scopeGlobal')}</span>
                  </div>
                  <p>{t('settings.shortcut.quickPanelDescription')}</p>
                  {shortcutState ? <ShortcutStatus state={shortcutState} t={t} /> : null}
                </div>
                <div className="shortcut-editor">
                  <button
                    aria-describedby={
                      shortcutError
                        ? 'shortcut-capture-description shortcut-inline-error'
                        : 'shortcut-capture-description'
                    }
                    aria-disabled={saving || shortcutSaving || !shortcutState}
                    aria-label={shortcutButtonPresentation.label}
                    aria-pressed={recordingShortcut}
                    className={
                      recordingShortcut ? 'shortcut-capture recording' : 'shortcut-capture'
                    }
                    disabled={!shortcutState}
                    onClick={() => void startRecordingShortcut()}
                    onKeyDown={handleShortcutKeyDown}
                    ref={shortcutButtonRef}
                    type="button"
                  >
                    <span className="shortcut-capture-value">
                      {recordingShortcut ? (
                        modifierPreview.length ? (
                          <ShortcutPreview labels={modifierPreview} />
                        ) : (
                          t('settings.shortcut.recording')
                        )
                      ) : shortcutCandidate && shortcutState ? (
                        <ShortcutKeycaps
                          accelerator={shortcutCandidate}
                          platform={shortcutState.platform}
                        />
                      ) : shortcutState?.activeAccelerator ? (
                        <ShortcutKeycaps
                          accelerator={shortcutState.activeAccelerator}
                          platform={shortcutState.platform}
                        />
                      ) : (
                        t('settings.shortcut.set')
                      )}
                    </span>
                    <small>
                      {shortcutSaving
                        ? t('settings.shortcut.applying')
                        : recordingShortcut
                          ? t('settings.shortcut.recordingHint')
                          : t('settings.shortcut.change')}
                    </small>
                  </button>
                  <span className="sr-only" id="shortcut-capture-description">
                    {shortcutButtonPresentation.description}
                  </span>
                  <button
                    className="secondary-button shortcut-reset"
                    disabled={
                      saving ||
                      shortcutSaving ||
                      !shortcutState ||
                      shortcutState.configuredAccelerator ===
                        DEFAULT_APP_SETTINGS.quickPanelShortcut
                    }
                    onClick={() => void resetShortcut()}
                    type="button"
                  >
                    {t('settings.shortcut.reset')}
                  </button>
                  {shortcutState?.activeAccelerator ? (
                    <span className="shortcut-kind">
                      {shortcutState.activeAccelerator === DEFAULT_APP_SETTINGS.quickPanelShortcut
                        ? t('settings.shortcut.default')
                        : t('settings.shortcut.custom')}
                    </span>
                  ) : null}
                </div>
              </div>
              {shortcutState?.startupNotice ? (
                <InlineNotice
                  dismissLabel={t('settings.shortcut.dismissNotice')}
                  onDismiss={() => void dismissShortcutNotice()}
                  variant="warning"
                >
                  {shortcutNoticeText(shortcutState, t)}
                </InlineNotice>
              ) : null}
              {shortcutError ? (
                <InlineNotice id="shortcut-inline-error" role="alert" variant="error">
                  {shortcutError}
                </InlineNotice>
              ) : null}
            </SettingsSection>

            <SettingsSection title={t('settings.shortcut.internalSection')} icon={Keyboard}>
              <div className="shortcut-fixed-description">
                {t('settings.shortcut.internalDescription')}
              </div>
              <ShortcutHintRow
                label={t('settings.shortcut.selectResult')}
                keys={['↑', '↓']}
              />
              <ShortcutHintRow
                label={t('settings.shortcut.copyResult')}
                keys={[shortcutState?.platform === 'darwin' ? '↩ Return' : 'Enter']}
              />
              <ShortcutHintRow
                label={t('settings.shortcut.closePanel')}
                keys={[shortcutState?.platform === 'darwin' ? 'esc' : 'Esc']}
              />
            </SettingsSection>

            <SettingsSection title={t('settings.quickPanelPlacement')} icon={Keyboard}>
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
          </div>
        ) : null}

        {activeTab === 'localData' ? (
          <SettingsSection title={t('settings.localData')} icon={Database} fill>
            <InfoRow label={t('settings.databasePath')} value={info?.databasePath ?? t('settings.loading')} />
            <SettingRow label={t('settings.scanTarget')}>
              <div className="settings-segmented">
                {SCAN_TARGET_OPTIONS.map((option) => (
                  <button
                    className={scanTarget === option.value ? 'active' : ''}
                    key={option.value}
                    onClick={() => {
                      setScanTarget(option.value);
                      setSelectedCandidateIds([]);
                    }}
                    type="button"
                  >
                    {t(option.labelKey)}
                  </button>
                ))}
              </div>
            </SettingRow>
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
                .filter((source) => source.target === scanTarget)
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
            {scanTarget === 'spells' ? (
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
            ) : (
              <div className="skill-scan-results">
                {scanSkills.map((skill) => (
                  <div className="settings-info-row" key={skill.id}>
                    <span>{skill.name}</span>
                    <code title={skill.rootPath}>{skill.rootPath}</code>
                  </div>
                ))}
                {scanSkills.length === 0 ? <div className="empty-state">{t('skill.empty')}</div> : null}
              </div>
            )}
          </SettingsSection>
        ) : null}
      </div>
    </section>
  );

  async function startRecordingShortcut(preserveError = false): Promise<void> {
    if (saving || shortcutSaving || shortcutCaptureTokenRef.current) {
      return;
    }
    if (!preserveError) {
      setShortcutError(null);
    }
    setModifierPreview([]);
    const result = await window.spellbook.beginShortcutCapture();
    setShortcutState(result.state);
    if (!result.ok) {
      setShortcutError(
        t(
          result.error === 'busy'
            ? 'settings.shortcut.busy'
            : 'settings.shortcut.captureFailed'
        )
      );
      restoreShortcutButtonFocus('recovery_failed', shortcutButtonRef.current);
      return;
    }
    shortcutCaptureTokenRef.current = result.sessionToken;
    setRecordingShortcut(true);
  }

  function handleShortcutKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (saving || shortcutSaving) {
      event.preventDefault();
      return;
    }
    if (!recordingShortcut) {
      return;
    }

    if (
      event.key === 'Tab' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      !event.shiftKey
    ) {
      void cancelShortcutCapture(false, 'tab');
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Escape') {
      void cancelShortcutCapture(true, 'escape');
      return;
    }
    if (event.key === 'Control' || event.key === 'Shift' || event.key === 'Alt' || event.key === 'Meta') {
      if (shortcutState) {
        setModifierPreview(shortcutModifierPreview(event, shortcutState.platform));
      }
      return;
    }

    if (!shortcutState) {
      return;
    }

    const shortcut = shortcutFromKeyInput(
      {
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        shiftKey: event.shiftKey
      },
      shortcutState.platform
    );
    if (!shortcut) {
      setShortcutError(t('settings.shortcut.invalid'));
      return;
    }

    setRecordingShortcut(false);
    setModifierPreview([]);
    setShortcutError(null);
    setShortcutCandidate(shortcut.accelerator);
    void applyCapturedShortcut(shortcut.accelerator);
  }

  async function applyCapturedShortcut(accelerator: string): Promise<void> {
    await endShortcutCapture();
    await updateShortcut({ intent: 'set', accelerator });
  }

  async function resetShortcut(): Promise<void> {
    await cancelShortcutCapture(true);
    setShortcutCandidate(DEFAULT_APP_SETTINGS.quickPanelShortcut);
    await updateShortcut({ intent: 'reset' });
  }

  async function updateShortcut(request: ShortcutUpdateRequest): Promise<void> {
    setShortcutSaving(true);
    let restartCapture = false;
    let focusEvent: ShortcutFocusEvent = 'recovery_failed';
    try {
      const result = await window.spellbook.updateQuickPanelShortcut(request);
      applyShortcutResult(result);
      if (result.ok) {
        focusEvent = 'success';
        setShortcutError(null);
        showToast(
          t(
            result.change === 'reset'
              ? 'settings.shortcut.resetDone'
              : 'settings.shortcut.updated'
          ),
          { variant: 'success' }
        );
      } else {
        focusEvent =
          result.error === 'conflict' ||
          result.error === 'persist_failed' ||
          result.error === 'recovery_failed'
            ? result.error
            : 'recovery_failed';
        setShortcutError(shortcutErrorText(result.error, t));
        restartCapture = request.intent === 'set' && result.error !== 'busy';
      }
    } finally {
      setShortcutCandidate(null);
      setShortcutSaving(false);
    }
    restoreShortcutButtonFocus(focusEvent, shortcutButtonRef.current);
    if (restartCapture) {
      await startRecordingShortcut(true);
    }
  }

  function applyShortcutResult(result: ShortcutUpdateResult): void {
    setShortcutState(result.state);
    onSettingsChanged({
      ...settings,
      quickPanelShortcut: result.state.configuredAccelerator
    });
  }

  async function endShortcutCapture(): Promise<void> {
    const sessionToken = shortcutCaptureTokenRef.current;
    shortcutCaptureTokenRef.current = null;
    if (sessionToken) {
      applyShortcutCaptureEndResult(
        await window.spellbook.endShortcutCapture(sessionToken)
      );
    }
  }

  function applyShortcutCaptureEndResult(result: ShortcutCaptureEndResult): void {
    setShortcutState(result.state);
    if (!result.ok) {
      setShortcutError(t('settings.shortcut.recoveryFailed'));
    }
  }

  async function cancelShortcutCapture(
    clearError: boolean,
    focusEvent: ShortcutFocusEvent = 'outside'
  ): Promise<void> {
    setRecordingShortcut(false);
    setModifierPreview([]);
    setShortcutCandidate(null);
    if (clearError) {
      setShortcutError(null);
    }
    await endShortcutCapture();
    restoreShortcutButtonFocus(focusEvent, shortcutButtonRef.current);
  }

  async function dismissShortcutNotice(): Promise<void> {
    setShortcutState(await window.spellbook.dismissShortcutStartupNotice());
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
        target: scanTarget,
        providers: selectedProviders,
        scanSources: activeScanSources
      });
      setScanCandidates(result.candidates);
      setScanSkills(result.skills);
      setSelectedCandidateIds([]);
      showToast(
        scanTarget === 'spells'
          ? `${t('status.scanFinished')}: ${result.candidates.length}`
          : `${t('status.skillScanFinished')}: ${result.skills.length}`
      );
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

function ShortcutKeycaps({
  accelerator,
  platform
}: {
  accelerator: string;
  platform: ShortcutPlatform;
}) {
  const keycaps = getShortcutKeycaps(accelerator, platform);
  return (
    <span className="shortcut-keycaps" aria-label={getShortcutAccessibleText(accelerator, platform)}>
      {keycaps.map((keycap, index) => (
        <kbd aria-hidden key={`${keycap.key}-${index}`}>
          {keycap.label}
        </kbd>
      ))}
    </span>
  );
}

function ShortcutPreview({ labels }: { labels: string[] }) {
  return (
    <span className="shortcut-keycaps shortcut-keycaps-preview">
      {labels.map((label) => (
        <kbd aria-hidden key={label}>
          {label}
        </kbd>
      ))}
    </span>
  );
}

function ShortcutStatus({
  state,
  t
}: {
  state: QuickPanelShortcutState;
  t: TFunction;
}) {
  const enabled = state.status !== 'disabled';
  const Icon = enabled ? CheckCircle2 : XCircle;
  return (
    <span className={enabled ? 'shortcut-status enabled' : 'shortcut-status disabled'}>
      <Icon aria-hidden size={13} />
      {t(enabled ? 'settings.shortcut.enabled' : 'settings.shortcut.disabled')}
    </span>
  );
}

function InlineNotice({
  children,
  dismissLabel,
  id,
  onDismiss,
  role,
  variant
}: {
  children: ReactNode;
  dismissLabel?: string;
  id?: string;
  onDismiss?: () => void;
  role?: 'alert' | 'status';
  variant: 'warning' | 'error';
}) {
  return (
    <div className={`shortcut-inline-notice ${variant}`} id={id} role={role}>
      {variant === 'warning' ? <AlertTriangle aria-hidden size={15} /> : <XCircle aria-hidden size={15} />}
      <span>{children}</span>
      {onDismiss ? (
        <button aria-label={dismissLabel} onClick={onDismiss} type="button">
          <X aria-hidden size={14} />
        </button>
      ) : null}
    </div>
  );
}

function ShortcutHintRow({ label, keys }: { label: string; keys: string[] }) {
  return (
    <div className="shortcut-hint-row">
      <span>{label}</span>
      <span className="shortcut-keycaps">
        {keys.map((key) => (
          <kbd key={key}>{key}</kbd>
        ))}
      </span>
    </div>
  );
}

function shortcutNoticeText(state: QuickPanelShortcutState, t: TFunction): string {
  const key = state.startupNotice;
  if (key === 'custom_unavailable_fallback_applied') {
    return t('settings.shortcut.fallbackApplied');
  }
  if (key === 'fallback_persist_failed') {
    return t('settings.shortcut.fallbackPersistFailed');
  }
  return t('settings.shortcut.allUnavailable');
}

function shortcutErrorText(
  error: Extract<ShortcutUpdateResult, { ok: false }>['error'],
  t: TFunction
): string {
  const keys = {
    invalid: 'settings.shortcut.invalid',
    conflict: 'settings.shortcut.conflict',
    persist_failed: 'settings.shortcut.persistFailed',
    busy: 'settings.shortcut.busy',
    recovery_failed: 'settings.shortcut.recoveryFailed'
  } as const;
  return t(keys[error]);
}

function shortcutModifierPreview(
  event: KeyboardEvent<HTMLButtonElement>,
  platform: ShortcutPlatform
): string[] {
  const labels: string[] = [];
  if (platform === 'darwin') {
    if (event.metaKey) labels.push('⌘');
    if (event.ctrlKey) labels.push('⌃');
  } else {
    if (event.ctrlKey) labels.push('Ctrl');
    if (event.metaKey) labels.push('Win');
  }
  if (event.altKey) labels.push(platform === 'darwin' ? '⌥' : 'Alt');
  if (event.shiftKey) labels.push(platform === 'darwin' ? '⇧' : 'Shift');
  return labels;
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-info-row">
      <span>{label}</span>
      <code title={value}>{value}</code>
    </div>
  );
}
