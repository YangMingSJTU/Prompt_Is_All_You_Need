import {
  AlertTriangle,
  Archive,
  Check,
  FileText,
  FolderInput,
  ScanSearch
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import type {
  SkillInstallation,
  SkillLibraryItem,
  SkillLibraryState,
  SkillOperationError,
  SkillPlatform,
  SkillScanResult
} from '../../shared/skillTypes';
import type { TFunction } from '../i18n';
import {
  clearSkillActionError,
  filterSkillItems,
  pruneSkillActionErrors,
  runTrackedSkillAction,
  selectVisibleSkillId,
  type SkillActionErrors,
  type SkillPlatformFilter,
  type SkillSourceFilter
} from '../skillLibraryState';
import { calculateSplitRatio, clampSplitRatio, type SplitPaneConstraints } from '../splitPane';
import { useFeedbackToast } from './FeedbackToast';
import { SkillSearchFilter } from './SkillSearchFilter';

const SKILL_PANEL_MIN_LIST_WIDTH = 480;
const SKILL_PANEL_MIN_DETAIL_WIDTH = 360;
const SKILL_PANEL_SPLITTER_WIDTH = 8;
const SKILL_PANEL_MIN_WIDTH =
  SKILL_PANEL_MIN_LIST_WIDTH + SKILL_PANEL_MIN_DETAIL_WIDTH + SKILL_PANEL_SPLITTER_WIDTH;

interface SkillLibraryViewProps {
  t: TFunction;
}

export function SkillLibraryView({ t }: SkillLibraryViewProps) {
  const [library, setLibrary] = useState<SkillLibraryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState<SkillScanResult | null>(null);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<SkillSourceFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<SkillPlatformFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyActions, setBusyActions] = useState<Set<string>>(new Set());
  const [actionErrors, setActionErrors] = useState<SkillActionErrors>({});
  const [splitRatio, setSplitRatio] = useState(60);
  const [isResizing, setIsResizing] = useState(false);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  const panelRef = useRef<HTMLElement>(null);
  const resizingRef = useRef(false);
  const { showToast } = useFeedbackToast();

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setLibrary(await window.spellbook.getSkillLibraryState());
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  const localizedItems = useMemo(
    () => (library?.items ?? []).map((item) => localizeBundledItem(item, t)),
    [library, t]
  );
  const visibleItems = useMemo(
    () =>
      filterSkillItems(localizedItems, {
        query,
        source: sourceFilter,
        platform: platformFilter
      }).sort(compareSkillItems),
    [localizedItems, platformFilter, query, sourceFilter]
  );

  useEffect(() => {
    setSelectedId((current) => selectVisibleSkillId(current, visibleItems));
  }, [visibleItems]);

  useEffect(() => {
    setActionErrors((current) =>
      pruneSkillActionErrors(
        current,
        localizedItems.map((item) => item.id)
      )
    );
  }, [localizedItems]);

  const selectedItem =
    visibleItems.find((item) => item.id === selectedId) ?? null;
  const bundledItems = visibleItems.filter((item) => item.source === 'bundled');
  const localItems = visibleItems.filter((item) => item.source === 'local');
  const neverScanned =
    library?.sources.every((source) => source.status === 'never_scanned') ?? true;

  async function scanSkills(): Promise<void> {
    if (scanning) {
      return;
    }
    setScanning(true);
    try {
      const result = await window.spellbook.scanSkills();
      setLibrary(result.library);
      setScanNotice(result.outcome === 'success' ? null : result);
      if (result.outcome === 'success') {
        showToast(
          result.freshSkillCount === 0
            ? t('skill.scan.empty')
            : formatMessage(t('skill.scan.success'), {
                count: result.freshSkillCount
              })
        );
      }
    } catch {
      setScanNotice({
        outcome: 'failed',
        freshSkillCount: 0,
        sources: [],
        library: library ?? { items: [], sources: [] }
      });
    } finally {
      setScanning(false);
    }
  }

  async function installSkill(item: SkillLibraryItem, platform: SkillPlatform): Promise<void> {
    const errorKey = installErrorKey(item.id, platform);
    setActionErrors((current) => clearSkillActionError(current, errorKey));
    await runTrackedSkillAction(errorKey, setBusyActions, async () => {
      try {
        const result = await window.spellbook.installSkill({
          skillId: item.id,
          platform
        });
        if (!result.ok) {
          setActionErrors((current) => ({ ...current, [errorKey]: result.error }));
          if (result.item) {
            patchLibraryItem(result.item);
          }
          return;
        }
        patchLibraryItem(result.item);
        showToast(
          formatMessage(t('skill.install.success'), {
            name: item.name,
            platform: formatPlatform(platform)
          })
        );
      } catch {
        setActionErrors((current) => ({
          ...current,
          [errorKey]: { code: 'io_error', retryable: true }
        }));
      }
    });
  }

  async function packageSkill(item: SkillLibraryItem): Promise<void> {
    const errorKey = packageErrorKey(item.id);
    setActionErrors((current) => clearSkillActionError(current, errorKey));
    await runTrackedSkillAction(errorKey, setBusyActions, async () => {
      try {
        const result = await window.spellbook.packageSkill({ skillId: item.id });
        if (!result.ok) {
          setActionErrors((current) => ({ ...current, [errorKey]: result.error }));
          return;
        }
        showToast(
          formatMessage(t('skill.package.success'), {
            name: item.name,
            path: result.outputPath
          })
        );
      } catch {
        setActionErrors((current) => ({
          ...current,
          [errorKey]: { code: 'io_error', retryable: true }
        }));
      }
    });
  }

  function patchLibraryItem(nextItem: SkillLibraryItem): void {
    setLibrary((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === nextItem.id ? nextItem : item
            )
          }
        : current
    );
  }

  function clearFilters(): void {
    setSourceFilter('all');
    setPlatformFilter('all');
  }

  function moveListSelection(event: KeyboardEvent<HTMLButtonElement>, itemId: string): void {
    const currentIndex = visibleItems.findIndex((item) => item.id === itemId);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowDown') {
      nextIndex = Math.min(visibleItems.length - 1, currentIndex + 1);
    } else if (event.key === 'ArrowUp') {
      nextIndex = Math.max(0, currentIndex - 1);
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = visibleItems.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    const nextItem = visibleItems[nextIndex];
    if (nextItem) {
      setSelectedId(nextItem.id);
      rowRefs.current.get(nextItem.id)?.focus();
    }
  }

  function getSplitConstraints(): SplitPaneConstraints | null {
    const panel = panelRef.current;
    if (!panel) {
      return null;
    }
    return {
      containerWidth: panel.getBoundingClientRect().width,
      dividerWidth: SKILL_PANEL_SPLITTER_WIDTH,
      minStartWidth: SKILL_PANEL_MIN_LIST_WIDTH,
      minEndWidth: SKILL_PANEL_MIN_DETAIL_WIDTH
    };
  }

  function updateSplitFromPointer(clientX: number): void {
    const panel = panelRef.current;
    const constraints = getSplitConstraints();
    if (!panel || !constraints) {
      return;
    }
    setSplitRatio(calculateSplitRatio(clientX, panel.getBoundingClientRect().left, constraints));
  }

  function startResizing(event: ReactPointerEvent<HTMLDivElement>): void {
    event.preventDefault();
    resizingRef.current = true;
    setIsResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    updateSplitFromPointer(event.clientX);
  }

  function resizeWithPointer(event: ReactPointerEvent<HTMLDivElement>): void {
    if (resizingRef.current) {
      updateSplitFromPointer(event.clientX);
    }
  }

  function stopResizing(event: ReactPointerEvent<HTMLDivElement>): void {
    resizingRef.current = false;
    setIsResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    const constraints = getSplitConstraints();
    if (!constraints) {
      return;
    }
    event.preventDefault();
    setSplitRatio((current) => {
      if (event.key === 'Home') {
        return clampSplitRatio(0, constraints);
      }
      if (event.key === 'End') {
        return clampSplitRatio(100, constraints);
      }
      return clampSplitRatio(current + (event.key === 'ArrowLeft' ? -2 : 2), constraints);
    });
  }

  if (loading) {
    return <SkillLibrarySkeleton t={t} />;
  }

  if (loadError && !library) {
    return (
      <section className="skill-library-page skill-library-load-error">
        <div className="skill-page-error" role="alert">
          <span>{t('skill.load.failed')}</span>
          <button className="primary-button" onClick={() => void loadLibrary()} type="button">
            {t('skill.load.retry')}
          </button>
        </div>
      </section>
    );
  }

  const showLocalEmpty =
    sourceFilter !== 'bundled' &&
    query.trim().length === 0 &&
    platformFilter === 'all' &&
    localItems.length === 0;
  const showNoMatch = visibleItems.length === 0 && !showLocalEmpty;

  return (
    <section
      className={isResizing ? 'skill-library-page panel-grid resizing' : 'skill-library-page panel-grid'}
      ref={panelRef}
      style={{
        minWidth: SKILL_PANEL_MIN_WIDTH,
        gridTemplateColumns: `minmax(${SKILL_PANEL_MIN_LIST_WIDTH}px, ${splitRatio}fr) ${SKILL_PANEL_SPLITTER_WIDTH}px minmax(${SKILL_PANEL_MIN_DETAIL_WIDTH}px, ${100 - splitRatio}fr)`
      }}
    >
      <div className="skill-master-pane search-pane">
        <div className="skill-toolbar">
          <SkillSearchFilter
            onClear={clearFilters}
            onPlatformChange={setPlatformFilter}
            onQueryChange={setQuery}
            onSourceChange={setSourceFilter}
            platform={platformFilter}
            query={query}
            source={sourceFilter}
            t={t}
          />
          <button
            aria-busy={scanning}
            aria-label={t('skill.findLocal.aria')}
            className="secondary-button skill-scan-button"
            disabled={scanning}
            onClick={() => void scanSkills()}
            title={t('skill.findLocal.aria')}
            type="button"
          >
            <ScanSearch aria-hidden className={scanning ? 'spinning' : undefined} size={15} />
            <span>{scanning ? t('skill.findingLocal') : t('skill.findLocal')}</span>
          </button>
        </div>

        {library?.localLoadError ? (
          <div className="skill-inline-notice warning" role="alert">
            <AlertTriangle aria-hidden size={15} />
            <span>{t('skill.load.localFailed')}</span>
            <button onClick={() => void loadLibrary()} type="button">
              {t('skill.load.retry')}
            </button>
          </div>
        ) : null}
        {scanNotice ? (
          <SkillScanNotice notice={scanNotice} onRetry={() => void scanSkills()} t={t} />
        ) : null}

        <div
          aria-busy={scanning}
          aria-label={t('skill.title')}
          className="skill-master-list"
          role="listbox"
        >
          {showNoMatch ? (
            <SkillListEmpty text={t('skill.empty.noMatch')} />
          ) : (
            <>
              <SkillGroup
                busyActions={busyActions}
                items={bundledItems}
                label={formatMessage(t('skill.group.bundled'), { count: bundledItems.length })}
                moveSelection={moveListSelection}
                rowRefs={rowRefs}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                t={t}
              />
              <SkillGroup
                busyActions={busyActions}
                emptyText={
                  showLocalEmpty
                    ? neverScanned
                      ? t('skill.empty.neverScanned')
                      : t('skill.empty.local')
                    : undefined
                }
                items={localItems}
                label={formatMessage(t('skill.group.local'), { count: localItems.length })}
                moveSelection={moveListSelection}
                rowRefs={rowRefs}
                selectedId={selectedId}
                setSelectedId={setSelectedId}
                t={t}
              />
            </>
          )}
        </div>
      </div>

      <div
        aria-label={t('skill.resizePanels')}
        aria-orientation="vertical"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={Math.round(splitRatio)}
        className="quick-spell-resizer"
        onKeyDown={resizeWithKeyboard}
        onLostPointerCapture={stopResizing}
        onPointerDown={startResizing}
        onPointerMove={resizeWithPointer}
        onPointerUp={stopResizing}
        role="separator"
        tabIndex={0}
        title={t('skill.resizePanels')}
      />

      <aside className="skill-detail-pane quick-spell-detail" aria-label={t('skill.detail.label')}>
        {selectedItem ? (
          <SkillDetailPanel
            actionErrors={actionErrors}
            busyActions={busyActions}
            item={selectedItem}
            onInstall={installSkill}
            onPackage={packageSkill}
            t={t}
          />
        ) : (
          <div className="skill-detail-empty">{t('skill.empty.detail')}</div>
        )}
      </aside>
    </section>
  );
}

function SkillGroup({
  busyActions,
  emptyText,
  items,
  label,
  moveSelection,
  rowRefs,
  selectedId,
  setSelectedId,
  t
}: {
  busyActions: Set<string>;
  emptyText?: string;
  items: SkillLibraryItem[];
  label: string;
  moveSelection(event: KeyboardEvent<HTMLButtonElement>, itemId: string): void;
  rowRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  selectedId: string | null;
  setSelectedId(id: string): void;
  t: TFunction;
}) {
  if (items.length === 0 && !emptyText) {
    return null;
  }
  return (
    <section className="skill-list-group">
      <h4>{label}</h4>
      {emptyText ? <SkillListEmpty text={emptyText} /> : null}
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <button
            aria-busy={hasBusyAction(busyActions, item.id)}
            aria-selected={selected}
            className={selected ? 'skill-list-row selected' : 'skill-list-row'}
            key={item.id}
            onClick={() => setSelectedId(item.id)}
            onKeyDown={(event) => moveSelection(event, item.id)}
            ref={(element) => {
              if (element) {
                rowRefs.current.set(item.id, element);
              } else {
                rowRefs.current.delete(item.id);
              }
            }}
            role="option"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            <span className="skill-row-title">
              <strong>{item.name}</strong>
              {item.stale ? (
                <span className="skill-stale-icon" title={t('skill.scan.stale')}>
                  <AlertTriangle aria-hidden size={14} />
                  <span className="sr-only">{t('skill.scan.stale')}</span>
                </span>
              ) : null}
            </span>
            <small>{compactSkillMeta(item, t)}</small>
          </button>
        );
      })}
    </section>
  );
}

function SkillDetailPanel({
  actionErrors,
  busyActions,
  item,
  onInstall,
  onPackage,
  t
}: {
  actionErrors: SkillActionErrors;
  busyActions: Set<string>;
  item: SkillLibraryItem;
  onInstall(item: SkillLibraryItem, platform: SkillPlatform): Promise<void>;
  onPackage(item: SkillLibraryItem): Promise<void>;
  t: TFunction;
}) {
  const itemBusy = hasBusyAction(busyActions, item.id);
  const packaging = busyActions.has(`${item.id}:package`);
  const packageError = actionErrors[packageErrorKey(item.id)];
  const detailMeta = compactSkillMeta(item, t, true);
  return (
    <article className="skill-detail" aria-busy={itemBusy}>
      <header>
        <div className="skill-detail-title-line">
          <h3>{item.name}</h3>
          <span className="spell-identity-tag skill-source-badge">
            {item.source === 'bundled'
              ? t('skill.source.bundled')
              : t('skill.source.local')}
          </span>
        </div>
        <p title={item.description || t('skill.noDescription')}>
          {item.description || t('skill.noDescription')}
        </p>
        <small>{detailMeta}</small>
      </header>

      <section className="skill-detail-section">
        <h4>{t('skill.detail.installation')}</h4>
        <div className="skill-installation-list">
          {(['claude', 'codex'] as const).map((platform) => (
            <InstallationRow
              actionError={actionErrors[installErrorKey(item.id, platform)]}
              busy={busyActions.has(`${item.id}:install:${platform}`)}
              disabled={itemBusy}
              installation={item.installation[platform]}
              key={platform}
              onInstall={() => void onInstall(item, platform)}
              platform={platform}
              t={t}
            />
          ))}
        </div>
      </section>

      <section className="skill-detail-section skill-path-list">
        {item.source === 'local' && item.rootPath ? (
          <PathRow label={t('skill.detail.root')} value={item.rootPath} />
        ) : null}
        <PathRow label={t('skill.detail.entry')} value={item.entryFilePath} />
      </section>

      <section className="skill-detail-section skill-file-section">
        <div className="skill-file-heading">
          <h4>{formatMessage(t('skill.detail.files'), { count: item.fileCount })}</h4>
          <button
            className="secondary-button skill-package-button"
            disabled={!item.packageable || itemBusy}
            onClick={() => void onPackage(item)}
            type="button"
          >
            <Archive aria-hidden size={14} />
            {packaging ? t('skill.packaging') : t('skill.package')}
          </button>
        </div>
        {packageError ? (
          <OperationErrorMessage error={packageError} kind="package" t={t} />
        ) : item.packageUnavailableReason ? (
          <p className="skill-action-error">{t('skill.package.empty')}</p>
        ) : null}
        <SkillFileTree files={item.files} t={t} />
      </section>
    </article>
  );
}

function InstallationRow({
  actionError,
  busy,
  disabled,
  installation,
  onInstall,
  platform,
  t
}: {
  actionError?: SkillOperationError;
  busy: boolean;
  disabled: boolean;
  installation: SkillInstallation;
  onInstall(): void;
  platform: SkillPlatform;
  t: TFunction;
}) {
  const installed = installation.state === 'installed';
  const statusRef = useRef<HTMLSpanElement>(null);
  const wasBusy = useRef(false);
  useEffect(() => {
    if (wasBusy.current && !busy && installed) {
      statusRef.current?.focus();
    }
    wasBusy.current = busy;
  }, [busy, installed]);
  const derivedError =
    actionError ??
    (installation.state === 'conflict'
      ? ({
          code: 'target_conflict',
          path: installation.targetPath,
          retryable: true
        } satisfies SkillOperationError)
      : installation.state === 'failed'
        ? ({
            code:
              installation.errorCode === 'permission_denied'
                ? 'permission_denied'
                : 'io_error',
            path: installation.targetPath,
            retryable: true
          } satisfies SkillOperationError)
        : undefined);
  return (
    <div className="skill-installation-row">
      <strong>{formatPlatform(platform)}</strong>
      <span
        className={installed ? 'installed' : ''}
        ref={statusRef}
        tabIndex={installed ? -1 : undefined}
      >
        {installed ? <Check aria-hidden size={15} /> : null}
        {busy
          ? t('skill.installing')
          : installed
            ? t('skill.installed')
            : t('skill.notInstalled')}
      </span>
      {!installed ? (
        <button
          className="secondary-button"
          disabled={disabled}
          onClick={onInstall}
          type="button"
        >
          <FolderInput aria-hidden size={15} />
          {busy
            ? t('skill.installing')
            : installation.state === 'missing' && !actionError
              ? t('skill.install')
              : t('skill.retry')}
        </button>
      ) : null}
      {derivedError ? (
        <div className="skill-install-error">
          <OperationErrorMessage error={derivedError} kind="install" t={t} />
        </div>
      ) : null}
    </div>
  );
}

function SkillFileTree({
  files,
  t
}: {
  files: string[];
  t: TFunction;
}) {
  const rowHeight = 28;
  const viewportHeight = 360;
  const [scrollTop, setScrollTop] = useState(0);
  const virtualized = files.length > 120;
  const start = virtualized ? Math.max(0, Math.floor(scrollTop / rowHeight) - 5) : 0;
  const end = virtualized
    ? Math.min(files.length, start + Math.ceil(viewportHeight / rowHeight) + 10)
    : files.length;
  const visibleFiles = files.slice(start, end);
  return (
    <div
      className="skill-file-tree"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      role="tree"
      style={files.length > 40 ? { maxHeight: viewportHeight } : undefined}
    >
      {virtualized && start > 0 ? (
        <div aria-hidden style={{ height: start * rowHeight }} />
      ) : null}
      {visibleFiles.map((file) => (
        <div
          aria-level={Math.max(1, file.split('/').length)}
          className="skill-tree-item"
          key={file}
          role="treeitem"
          style={{ paddingLeft: `${12 + Math.min(5, file.split('/').length - 1) * 14}px` }}
        >
          <FileText aria-hidden size={14} />
          <code>{file}</code>
          {file === 'SKILL.md' ? <span>{t('skill.detail.entryBadge')}</span> : null}
        </div>
      ))}
      {virtualized && end < files.length ? (
        <div aria-hidden style={{ height: (files.length - end) * rowHeight }} />
      ) : null}
    </div>
  );
}

function SkillScanNotice({
  notice,
  onRetry,
  t
}: {
  notice: SkillScanResult;
  onRetry(): void;
  t: TFunction;
}) {
  const failedSources = notice.sources.filter((source) => !source.refreshed);
  const failedSource = failedSources[0];
  const text =
    notice.outcome === 'partial' && failedSource
      ? formatMessage(t('skill.scan.sourceFailed'), {
          platform: formatPlatform(failedSource.platform)
        })
      : t('skill.scan.failed');
  return (
    <div className="skill-inline-notice warning" role="alert">
      <AlertTriangle aria-hidden size={15} />
      <span title={failedSources.map((source) => source.path).join('\n') || undefined}>{text}</span>
      <button onClick={onRetry} type="button">
        {t('skill.retry')}
      </button>
    </div>
  );
}

function SkillListEmpty({ text }: { text: string }) {
  return <div className="skill-list-empty">{text}</div>;
}

function SkillLibrarySkeleton({ t }: { t: TFunction }) {
  return (
    <section
      aria-busy
      className="skill-library-page panel-grid skill-skeleton"
      style={{ minWidth: SKILL_PANEL_MIN_WIDTH }}
    >
      <div className="skill-master-pane search-pane">
        <div className="skill-skeleton-toolbar">
          <span />
          <span />
        </div>
        <div className="skill-skeleton-list">
          {Array.from({ length: 5 }, (_, index) => <span key={index} />)}
        </div>
      </div>
      <div aria-hidden className="quick-spell-resizer" />
      <aside aria-label={t('skill.detail.label')} className="skill-detail-pane quick-spell-detail">
        <div className="skill-skeleton-detail">
          {Array.from({ length: 3 }, (_, index) => <span key={index} />)}
        </div>
      </aside>
    </section>
  );
}

function PathRow({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="skill-path-row">
      <span>{label}</span>
      <code>{value}</code>
    </div>
  );
}

function OperationErrorMessage({
  error,
  kind,
  t
}: {
  error: SkillOperationError;
  kind: 'install' | 'package';
  t: TFunction;
}) {
  return <p className="skill-action-error">{operationErrorText(error, kind, t)}</p>;
}

function operationErrorText(
  error: SkillOperationError,
  kind: 'install' | 'package',
  t: TFunction
): string {
  if (kind === 'install' && error.code === 'target_conflict') {
    return formatMessage(t('skill.install.conflict'), { path: error.path ?? '' });
  }
  if (kind === 'install' && error.code === 'permission_denied') {
    return formatMessage(t('skill.install.permissionDenied'), { path: error.path ?? '' });
  }
  if (
    kind === 'install' &&
    (error.code === 'source_missing' || error.code === 'source_unreadable')
  ) {
    return t('skill.install.sourceMissing');
  }
  if (kind === 'package' && error.code === 'empty_skill') {
    return t('skill.package.empty');
  }
  if (kind === 'package' && error.code === 'source_unreadable') {
    return t('skill.package.unreadable');
  }
  if (
    kind === 'package' &&
    (error.code === 'write_failed' || error.code === 'permission_denied')
  ) {
    return formatMessage(t('skill.package.writeFailed'), {
      path: error.path ?? ''
    });
  }
  return kind === 'install' ? t('skill.install.failed') : t('skill.package.failed');
}

function localizeBundledItem(item: SkillLibraryItem, t: TFunction): SkillLibraryItem {
  if (item.bundledKey === 'prompt-refiner') {
    return {
      ...item,
      name: t('skill.bundled.promptRefiner.name'),
      description: t('skill.bundled.promptRefiner.description')
    };
  }
  if (item.bundledKey === 'task-planner') {
    return {
      ...item,
      name: t('skill.bundled.taskPlanner.name'),
      description: t('skill.bundled.taskPlanner.description')
    };
  }
  return item;
}

function compareSkillItems(left: SkillLibraryItem, right: SkillLibraryItem): number {
  if (left.source !== right.source) {
    return left.source === 'bundled' ? -1 : 1;
  }
  return left.name.localeCompare(right.name);
}

function compactSkillMeta(item: SkillLibraryItem, t: TFunction, includeDate = false): string {
  const fileCount = formatMessage(t('skill.fileCount'), { count: item.fileCount });
  if (item.source === 'bundled') {
    return `Claude / Codex · ${fileCount}`;
  }
  const base = `${formatPlatform(item.discoveredPlatform!)} · ${fileCount}`;
  const updatedAt = includeDate && item.updatedAt ? formatDate(item.updatedAt) : '';
  return updatedAt ? `${base} · ${updatedAt}` : base;
}

function formatMessage(
  template: string,
  values: Record<string, string | number>
): string {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function formatPlatform(platform: SkillPlatform): string {
  return platform === 'claude' ? 'Claude' : 'Codex';
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function installErrorKey(skillId: string, platform: SkillPlatform): string {
  return `${skillId}:install:${platform}`;
}

function packageErrorKey(skillId: string): string {
  return `${skillId}:package`;
}

function hasBusyAction(busyActions: Set<string>, skillId: string): boolean {
  for (const actionKey of busyActions) {
    if (actionKey.startsWith(`${skillId}:`)) {
      return true;
    }
  }
  return false;
}
