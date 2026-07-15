import {
  AlertTriangle,
  Archive,
  Check,
  FileText,
  FolderInput,
  RefreshCw,
  Search
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
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
import { useFeedbackToast } from './FeedbackToast';

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
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
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
  const filtersActive =
    query.trim().length > 0 || sourceFilter !== 'all' || platformFilter !== 'all';
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
      } else if (result.outcome === 'partial') {
        const failureCount = result.sources.filter((source) => !source.refreshed).length;
        showToast(
          formatMessage(t('skill.scan.partial'), { count: failureCount }),
          { variant: 'warning' }
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

  function clearAll(): void {
    setQuery('');
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

  if (loading) {
    return <SkillLibrarySkeleton t={t} />;
  }

  if (loadError && !library) {
    return (
      <section className="skill-library-page">
        <div className="skill-page-error" role="alert">
          <strong>{t('skill.load.failed')}</strong>
          <button className="primary-button" onClick={() => void loadLibrary()} type="button">
            {t('skill.load.retry')}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="skill-library-page">
      <header className="skill-library-header">
        <div>
          <h3>{t('skill.title')}</h3>
          <p>{t('skill.description')}</p>
        </div>
        <button
          aria-busy={scanning}
          className="primary-button"
          disabled={scanning}
          onClick={() => void scanSkills()}
          type="button"
        >
          <RefreshCw aria-hidden size={16} />
          {scanning ? t('skill.findingLocal') : t('skill.findLocal')}
        </button>
      </header>

      {library?.localLoadError ? (
        <div className="skill-inline-notice warning" role="alert">
          <AlertTriangle aria-hidden size={16} />
          <span>{t('skill.load.localFailed')}</span>
          <button onClick={() => void loadLibrary()} type="button">
            {t('skill.load.retry')}
          </button>
        </div>
      ) : null}
      {scanNotice ? (
        <SkillScanNotice notice={scanNotice} onRetry={() => void scanSkills()} t={t} />
      ) : null}

      <div className="skill-toolbar">
        <label className="skill-search">
          <Search aria-hidden size={15} />
          <span className="sr-only">{t('skill.search.placeholder')}</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setQuery('');
              }
            }}
            placeholder={t('skill.search.placeholder')}
            value={query}
          />
        </label>
        <label className="skill-filter-control">
          <span>{t('skill.filter.source')}</span>
          <select
            aria-label={t('skill.filter.source')}
            onChange={(event) => setSourceFilter(event.target.value as SkillSourceFilter)}
            value={sourceFilter}
          >
            <option value="all">{t('skill.filter.source.all')}</option>
            <option value="bundled">{t('skill.filter.source.bundled')}</option>
            <option value="local">{t('skill.filter.source.local')}</option>
          </select>
        </label>
        <label className="skill-filter-control">
          <span>{t('skill.filter.platform')}</span>
          <select
            aria-label={t('skill.filter.platform')}
            onChange={(event) => setPlatformFilter(event.target.value as SkillPlatformFilter)}
            value={platformFilter}
          >
            <option value="all">{t('skill.filter.platform.all')}</option>
            <option value="claude">Claude</option>
            <option value="codex">Codex</option>
          </select>
        </label>
        {filtersActive ? (
          <button className="secondary-button" onClick={clearAll} type="button">
            {t('skill.filter.clearAll')}
          </button>
        ) : null}
      </div>

      <div className="skill-workspace">
        <div className="skill-master-pane">
          <div className="skill-result-count">
            {formatMessage(t('skill.resultCount'), { count: visibleItems.length })}
          </div>
          <div
            aria-busy={scanning}
            aria-label={t('skill.title')}
            className="skill-master-list"
            role="listbox"
          >
            {visibleItems.length === 0 ? (
              sourceFilter === 'local' &&
              query.trim().length === 0 &&
              platformFilter === 'all' ? (
                <SkillLocalEmpty
                  neverScanned={neverScanned}
                  onScan={() => void scanSkills()}
                  t={t}
                />
              ) : (
                <SkillNoMatch filtersActive={filtersActive} onClear={clearAll} t={t} />
              )
            ) : (
              <>
                <SkillGroup
                  busyActions={busyActions}
                  items={bundledItems}
                  label={t('skill.group.bundled')}
                  moveSelection={moveListSelection}
                  rowRefs={rowRefs}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                  t={t}
                />
                <SkillGroup
                  busyActions={busyActions}
                  items={localItems}
                  label={t('skill.group.local')}
                  moveSelection={moveListSelection}
                  rowRefs={rowRefs}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                  t={t}
                />
                {localItems.length === 0 && sourceFilter !== 'bundled' && !filtersActive ? (
                  <SkillLocalEmpty
                    neverScanned={neverScanned}
                    onScan={() => void scanSkills()}
                    t={t}
                  />
                ) : null}
              </>
            )}
          </div>
        </div>
        <div className="skill-detail-pane">
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
        </div>
      </div>
    </section>
  );
}

function SkillGroup({
  busyActions,
  items,
  label,
  moveSelection,
  rowRefs,
  selectedId,
  setSelectedId,
  t
}: {
  busyActions: Set<string>;
  items: SkillLibraryItem[];
  label: string;
  moveSelection(event: KeyboardEvent<HTMLButtonElement>, itemId: string): void;
  rowRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  selectedId: string | null;
  setSelectedId(id: string): void;
  t: TFunction;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <section className="skill-list-group">
      <h4>
        <span>{label}</span>
        <small>{items.length}</small>
      </h4>
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
            <strong>{item.name}</strong>
            <span>{item.description || t('skill.noDescription')}</span>
            <small>
              {item.source === 'bundled'
                ? `${t('skill.source.bundled')} · ${summarizeInstallations(item, t)}`
                : `${t('skill.source.local')} · ${formatPlatform(item.discoveredPlatform!)} · ${item.fileCount} ${t('skill.detail.files')}`}
              {item.stale ? ` · ${t('skill.scan.stale')}` : ''}
              {hasBusyAction(busyActions, item.id)
                ? ` · ${busyActions.has(packageErrorKey(item.id)) ? t('skill.packaging') : t('skill.installing')}`
                : ''}
            </small>
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
  return (
    <article className="skill-detail" aria-busy={itemBusy}>
      <header>
        <div className="skill-detail-title-line">
          <h3>{item.name}</h3>
          <span className="skill-source-badge">
            {item.source === 'bundled'
              ? t('skill.source.bundled')
              : t('skill.source.local')}
          </span>
        </div>
        <p>{item.description || t('skill.noDescription')}</p>
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

      <section className="skill-detail-section">
        <h4>{t('skill.detail.info')}</h4>
        <dl className="skill-info-grid">
          <InfoRow
            label={t('skill.detail.source')}
            value={
              item.source === 'bundled'
                ? t('skill.detail.bundledSource')
                : t('skill.source.local')
            }
          />
          {item.source === 'local' && item.discoveredPlatform ? (
            <InfoRow
              label={t('skill.detail.discoveredIn')}
              value={formatPlatform(item.discoveredPlatform)}
            />
          ) : (
            <InfoRow
              label={t('skill.detail.compatibleWith')}
              value={item.compatiblePlatforms.map(formatPlatform).join(', ')}
            />
          )}
          {item.updatedAt && formatDate(item.updatedAt) ? (
            <InfoRow label={t('skill.detail.updatedAt')} value={formatDate(item.updatedAt)} />
          ) : null}
          {item.rootPath ? (
            <InfoRow code label={t('skill.detail.root')} value={item.rootPath} />
          ) : null}
          <InfoRow code label={t('skill.detail.entry')} value={item.entryFilePath} />
          <InfoRow label={t('skill.detail.fileCount')} value={String(item.fileCount)} />
        </dl>
      </section>

      <section className="skill-detail-section skill-file-section">
        <h4>{t('skill.detail.files')}</h4>
        <SkillFileTree
          directoryName={item.directoryName}
          files={item.files}
          t={t}
        />
      </section>

      <div className="skill-detail-actions">
        {packageError ? (
          <OperationErrorMessage error={packageError} kind="package" t={t} />
        ) : item.packageUnavailableReason ? (
          <p className="skill-action-error">{t('skill.package.empty')}</p>
        ) : null}
        <button
          className="secondary-button"
          disabled={!item.packageable || itemBusy}
          onClick={() => void onPackage(item)}
          type="button"
        >
          <Archive aria-hidden size={15} />
          {packaging ? t('skill.packaging') : t('skill.package')}
        </button>
      </div>
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
            : installation.state === 'missing'
              ? t('skill.notInstalled')
              : derivedError
                ? operationErrorTitle(derivedError, 'install', t)
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
  directoryName,
  files,
  t
}: {
  directoryName: string;
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
      <div className="skill-tree-root">
        <strong>{directoryName}</strong>
      </div>
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
  return (
    <div className="skill-inline-notice warning" role="alert">
      <AlertTriangle aria-hidden size={16} />
      <div>
        <strong>
          {notice.outcome === 'partial'
            ? formatMessage(t('skill.scan.partial'), { count: failedSources.length })
            : t('skill.scan.failed')}
        </strong>
        {failedSources.map((source) => (
          <p key={source.platform}>
            {formatMessage(t('skill.scan.sourceUnreadable'), {
              platform: formatPlatform(source.platform),
              path: source.path
            })}
          </p>
        ))}
      </div>
      <button onClick={onRetry} type="button">
        {t('skill.retry')}
      </button>
    </div>
  );
}

function SkillNoMatch({
  filtersActive,
  onClear,
  t
}: {
  filtersActive: boolean;
  onClear(): void;
  t: TFunction;
}) {
  return (
    <div className="skill-no-match">
      <strong>
        {filtersActive
          ? t('skill.empty.noMatch.title')
          : t('skill.empty.local.title')}
      </strong>
      <p>
        {filtersActive
          ? t('skill.empty.noMatch.body')
          : t('skill.empty.local.body')}
      </p>
      {filtersActive ? (
        <button className="secondary-button" onClick={onClear} type="button">
          {t('skill.filter.clearAll')}
        </button>
      ) : null}
    </div>
  );
}

function SkillLocalEmpty({
  neverScanned,
  onScan,
  t
}: {
  neverScanned: boolean;
  onScan(): void;
  t: TFunction;
}) {
  return (
    <div className="skill-local-empty">
      <strong>
        {neverScanned
          ? t('skill.empty.neverScanned.title')
          : t('skill.empty.local.title')}
      </strong>
      <p>
        {neverScanned
          ? t('skill.empty.neverScanned.body')
          : t('skill.empty.local.body')}
      </p>
      <button className="secondary-button" onClick={onScan} type="button">
        {neverScanned ? t('skill.findLocal') : t('skill.scan.again')}
      </button>
    </div>
  );
}

function SkillLibrarySkeleton({ t }: { t: TFunction }) {
  return (
    <section aria-busy className="skill-library-page">
      <header className="skill-library-header">
        <div>
          <h3>{t('skill.title')}</h3>
          <p>{t('skill.description')}</p>
        </div>
      </header>
      <div className="skill-workspace skill-skeleton">
        <div>
          {Array.from({ length: 5 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
        <div />
      </div>
    </section>
  );
}

function InfoRow({
  code = false,
  label,
  value
}: {
  code?: boolean;
  label: string;
  value: string;
}) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{code ? <code>{value}</code> : value}</dd>
    </>
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
  return (
    <p className="skill-action-error">
      <strong>{operationErrorTitle(error, kind, t)}</strong>
      {operationErrorBody(error, kind, t)}
    </p>
  );
}

function operationErrorTitle(
  error: SkillOperationError,
  kind: 'install' | 'package',
  t: TFunction
): string {
  if (kind === 'install' && error.code === 'target_conflict') {
    return t('skill.install.conflict.title');
  }
  if (kind === 'package' && error.code === 'empty_skill') {
    return t('skill.package.empty');
  }
  if (kind === 'package' && error.code === 'source_unreadable') {
    return t('skill.package.unreadable');
  }
  return kind === 'install' ? t('skill.install.failed') : t('skill.package.failed');
}

function operationErrorBody(
  error: SkillOperationError,
  kind: 'install' | 'package',
  t: TFunction
): string {
  if (kind === 'install' && error.code === 'target_conflict') {
    return ` ${formatMessage(t('skill.install.conflict.body'), {
      path: error.path ?? ''
    })}`;
  }
  if (kind === 'install' && error.code === 'permission_denied') {
    return ` ${formatMessage(t('skill.install.permissionDenied'), {
      path: error.path ?? ''
    })}`;
  }
  if (
    kind === 'install' &&
    (error.code === 'source_missing' || error.code === 'source_unreadable')
  ) {
    return ` ${t('skill.install.sourceMissing')}`;
  }
  if (
    kind === 'package' &&
    (error.code === 'write_failed' || error.code === 'permission_denied')
  ) {
    return ` ${formatMessage(t('skill.package.writeFailed'), {
      path: error.path ?? ''
    })}`;
  }
  return '';
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

function summarizeInstallations(item: SkillLibraryItem, t: TFunction): string {
  return (['claude', 'codex'] as const)
    .map(
      (platform) =>
        `${formatPlatform(platform)} ${item.installation[platform].state === 'installed' ? t('skill.installed') : t('skill.notInstalled')}`
    )
    .join(' · ');
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
