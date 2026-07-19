import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { resolveAppName } from '../shared/appIdentity';
import { calculateFloatingPanelPosition } from '../shared/floatingPlacement';
import {
  FLOATING_WINDOW_DEFAULT_HEIGHT,
  FLOATING_WINDOW_DEFAULT_WIDTH,
  FLOATING_WINDOW_MAX_HEIGHT,
  FLOATING_WINDOW_MAX_WIDTH,
  FLOATING_WINDOW_MIN_HEIGHT,
  FLOATING_WINDOW_MIN_WIDTH,
  MAIN_WINDOW_COMPACT_MIN_WIDTH,
  MAIN_WINDOW_DEFAULT_HEIGHT,
  MAIN_WINDOW_DEFAULT_WIDTH,
  MAIN_WINDOW_MIN_HEIGHT,
  MAIN_WINDOW_MIN_WIDTH,
  SPELL_LIBRARY_DEFAULT_RECOMMENDATION_WINDOW_DELTA
} from '../shared/layout';
import type {
  FloatingWindowState,
  SourceFileSummary,
  SpellCreateInput,
  SpellStatePatch,
  SpellUpdatePatch
} from '../shared/types';
import type { AppSettings, ShortcutAccelerator } from '../shared/settings';
import {
  DEFAULT_APP_SETTINGS,
  formatShortcutDisplay,
  normalizeShortcutAccelerator
} from '../shared/settings';
import { isDesktopPlatform, type DesktopPlatform } from '../shared/platform';
import type { PlatformPaths } from './services/platformPaths';
import { openAppDatabase } from './services/database';
import { createSpellService } from './services/spellService';
import { generateCandidates } from './services/candidateGenerator';
import {
  discoverJsonlFiles,
  hasSuccessfulSourceScan,
  scanJsonlFiles
} from './services/scanner';
import { resolveScanRequest } from './services/scanRequest';
import {
  areScanSourcesValid,
  createSettingsService,
  defaultScanSources,
  type SettingsService
} from './services/settingsService';
import { createSkillService, defaultSkillRoots } from './services/skillService';
import {
  createPlatformPathContext,
  createPlatformPaths
} from './services/platformPaths';
import {
  SQL_WASM_PATH,
  TRAY_ICON_PATH,
  WINDOWS_APP_ICON_PATH
} from './services/runtimeAssets';
import {
  applicationMenuTemplate,
  createTrayImage,
  mainWindowChromeOptions,
  optionalWindowsIcon
} from './services/nativeShell';
import { writePackagedSmokeEvidence } from './services/packagedSmoke';
import { runAppPreflight, runAppStartup } from './services/appStartup';
import {
  createAppReadinessBarrier,
  createWindowRestorer,
  registerSingleInstanceLifecycle
} from './services/appLifecycle';
import { registerSkillHandlers } from './ipc/skillHandlers';

let mainWindow: BrowserWindow | null = null;
let floatingWindow: BrowserWindow | null = null;
let floatingWindowPinned = false;
let tray: Tray | null = null;
let settingsService: SettingsService | null = null;
let databasePath = '';
let activeQuickPanelShortcut: ShortcutAccelerator | null = null;
let mainWindowCompact = false;
let mainWindowExpandedWidth = MAIN_WINDOW_DEFAULT_WIDTH;
let mainWindowRecommendationDelta = SPELL_LIBRARY_DEFAULT_RECOMMENDATION_WINDOW_DELTA;
let restoreMainWindowMaximized = false;
const desktopPlatform = requireDesktopPlatform(process.platform);
const platformPathContext = createPlatformPathContext(desktopPlatform);
let platformPaths: PlatformPaths | null = null;

function requireDesktopPlatform(value: string): DesktopPlatform {
  if (!isDesktopPlatform(value)) {
    throw new Error(`Unsupported desktop platform: ${value}`);
  }
  return value;
}

function getPlatformPaths(): PlatformPaths {
  if (!platformPaths) {
    throw new Error('Platform paths are not ready');
  }
  return platformPaths;
}

async function createWindow(): Promise<BrowserWindow> {
  const preloadPath = join(__dirname, '../preload/preload.mjs');
  const appName = getCurrentAppName();
  const window = new BrowserWindow({
    width: MAIN_WINDOW_DEFAULT_WIDTH,
    height: MAIN_WINDOW_DEFAULT_HEIGHT,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    useContentSize: true,
    title: appName,
    ...mainWindowChromeOptions(desktopPlatform, WINDOWS_APP_ICON_PATH),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow = window;
  window.once('ready-to-show', () => {
    if (!window.isDestroyed()) {
      window.show();
    }
  });
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  await loadRenderer(window, 'main');
  return window;
}

const restoreMainWindow = createWindowRestorer<BrowserWindow>({
  getWindow: () => mainWindow,
  createWindow
});

async function createFloatingWindow(): Promise<void> {
  const preloadPath = join(__dirname, '../preload/preload.mjs');
  const appName = getCurrentAppName();
  floatingWindow = new BrowserWindow({
    width: FLOATING_WINDOW_DEFAULT_WIDTH,
    height: FLOATING_WINDOW_DEFAULT_HEIGHT,
    minWidth: FLOATING_WINDOW_MIN_WIDTH,
    minHeight: FLOATING_WINDOW_MIN_HEIGHT,
    maxWidth: FLOATING_WINDOW_MAX_WIDTH,
    maxHeight: FLOATING_WINDOW_MAX_HEIGHT,
    title: appName,
    icon: optionalWindowsIcon(desktopPlatform, WINDOWS_APP_ICON_PATH),
    show: false,
    frame: false,
    resizable: true,
    movable: true,
    thickFrame: true,
    alwaysOnTop: floatingWindowPinned,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  floatingWindow.on('blur', () => {
    if (!floatingWindowPinned) {
      floatingWindow?.hide();
    }
  });

  await loadRenderer(floatingWindow, 'floating');
}

async function loadRenderer(window: BrowserWindow, mode: 'main' | 'floating'): Promise<void> {
  if (process.env.ELECTRON_RENDERER_URL) {
    await window.loadURL(`${process.env.ELECTRON_RENDERER_URL}?mode=${mode}`);
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { mode }
    });
  }
}

async function bootstrap(): Promise<void> {
  const paths = getPlatformPaths();
  await Promise.all([
    mkdir(paths.dataDirectory, { recursive: true }),
    mkdir(paths.packageDirectory, { recursive: true })
  ]);
  databasePath = paths.databasePath;
  const db = await openAppDatabase(databasePath, SQL_WASM_PATH);
  const spellService = createSpellService(db);
  const scanSourceDefaults = defaultScanSources(paths);
  const skillService = createSkillService(db, {
    roots: defaultSkillRoots(paths),
    packageDirectory: paths.packageDirectory,
    pathContext: platformPathContext
  });
  settingsService = createSettingsService(db, {
    defaultScanSources: scanSourceDefaults,
    pathContext: platformPathContext
  });
  floatingWindowPinned = settingsService.getSettings().quickPanelPinned;
  await spellService.seedStarterSpells();
  applyAppIdentity();

  ipcMain.handle('spells:search', (_event, query: string) => spellService.searchSpells(query ?? ''));
  ipcMain.handle('spells:list', () => spellService.listSpells());
  ipcMain.handle('spells:popular', (_event, limit?: number) => spellService.listPopularSpells(limit ?? 6));
  ipcMain.handle('spells:copy', async (event, spellId: string) => {
    const spell = await spellService.copySpell(spellId);
    clipboard.writeText(spell.body);
    if (
      floatingWindow &&
      event.sender === floatingWindow.webContents &&
      !floatingWindowPinned
    ) {
      floatingWindow.hide();
    }
    return spell;
  });
  ipcMain.handle('spells:create', (_event, input: SpellCreateInput) => spellService.createSpell(input));
  ipcMain.handle('spells:update', (_event, spellId: string, patch: SpellUpdatePatch) =>
    spellService.updateSpell(spellId, patch)
  );
  ipcMain.handle('spells:updateState', (_event, spellId: string, patch: SpellStatePatch) =>
    spellService.updateSpellState(spellId, patch)
  );
  ipcMain.handle('spells:delete', (_event, spellId: string) => spellService.deleteSpell(spellId));
  ipcMain.handle('spells:deleteBatch', (_event, spellIds: string[]) => spellService.deleteSpells(spellIds));
  ipcMain.handle('candidates:list', () => spellService.listCandidates());
  ipcMain.handle(
    'candidates:createSpell',
    (_event, candidateId: string, input: SpellCreateInput) =>
      spellService.createSpellFromCandidate(candidateId, input)
  );
  ipcMain.handle('candidates:promoteBatch', (_event, candidateIds: string[]) =>
    spellService.promoteCandidates(candidateIds)
  );
  ipcMain.handle('analytics:get', () => spellService.getAnalytics());
  registerSkillHandlers(ipcMain, skillService);
  ipcMain.handle('settings:get', () => {
    if (!settingsService) {
      throw new Error('Settings service is not ready');
    }
    return settingsService.getSettings();
  });
  ipcMain.handle('settings:info', () => ({
    defaultScanSources: scanSourceDefaults,
    historyRoots: paths.historyRoots,
    platform: desktopPlatform
  }));
  ipcMain.handle(
    'window:setRecommendationPanelOpen',
    (event, open: boolean, requestedPanelWidth?: number) => {
      const owner = BrowserWindow.fromWebContents(event.sender);
      if (!owner || owner !== mainWindow) {
        return;
      }
      setMainWindowRecommendationPanelOpen(owner, open, requestedPanelWidth);
    }
  );
  ipcMain.handle('dialog:selectDirectory', async (event, defaultPath?: string) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    const options = {
      defaultPath: typeof defaultPath === 'string' && defaultPath.trim() ? defaultPath : undefined,
      properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'>
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  ipcMain.handle('settings:update', async (_event, patch: Partial<AppSettings>) => {
    if (!settingsService) {
      throw new Error('Settings service is not ready');
    }
    const current = settingsService.getSettings();
    const nextPatch: Partial<AppSettings> = { ...patch };
    if ('scanSources' in patch && !areScanSourcesValid(patch.scanSources, platformPathContext)) {
      return {
        settings: current,
        warning:
          desktopPlatform === 'darwin'
            ? 'History folders must use absolute macOS paths.'
            : 'History folders must use absolute Windows drive or UNC paths.'
      };
    }
    if ('quickPanelShortcut' in patch) {
      const requestedShortcut = normalizeShortcutAccelerator(patch.quickPanelShortcut);
      if (!requestedShortcut) {
        return {
          settings: current,
          warning: 'Invalid shortcut'
        };
      }
      if (requestedShortcut !== current.quickPanelShortcut) {
        const registered = registerQuickPanelShortcut(requestedShortcut);
        if (!registered) {
          return {
            settings: current,
            warning: `Shortcut conflict: ${formatShortcutDisplay(requestedShortcut, desktopPlatform)}`
          };
        }
      }
      nextPatch.quickPanelShortcut = requestedShortcut;
    }
    const settings = await settingsService.updateSettings(nextPatch);
    applyAppIdentity();
    return { settings };
  });
  ipcMain.handle('scanner:run', async (_event, request: unknown) => {
    if (!settingsService) {
      throw new Error('Settings service is not ready');
    }
    const scanRequest = resolveScanRequest(
      request,
      settingsService.getSettings().scanSources,
      platformPathContext
    );
    const roots = scanRequest.scanSources;
    const summaries: SourceFileSummary[] = [];
    const allPrompts = [];

    for (const root of roots) {
      const discovery = await discoverJsonlFiles(root.path, { pathContext: platformPathContext });
      if (discovery.status === 'missing') {
        summaries.push({
          id: `${root.provider}:${root.path}`,
          sourceTool: root.provider,
          path: root.path,
          status: 'missing',
          lineCount: 0,
          promptCount: 0,
          warningCount: 0,
          scannedAt: new Date().toISOString()
        });
        continue;
      }
      discovery.errors.forEach((error, index) => {
        summaries.push({
          id: `${root.provider}:${error.path}:discovery:${index}`,
          sourceTool: root.provider,
          path: error.path,
          status: error.code === 'permission_denied' ? 'unreadable' : 'failed',
          lineCount: 0,
          promptCount: 0,
          warningCount: 1,
          scannedAt: new Date().toISOString(),
          error
        });
      });
      if (discovery.files.length === 0 && discovery.errors.length === 0) {
        summaries.push({
          id: `${root.provider}:${root.path}`,
          sourceTool: root.provider,
          path: root.path,
          status: 'scanned',
          lineCount: 0,
          promptCount: 0,
          warningCount: 0,
          scannedAt: new Date().toISOString()
        });
      }
      const summary = await scanJsonlFiles(
        discovery.files,
        root.provider,
        { pathContext: platformPathContext }
      );
      summaries.push(...summary.sourceFiles);
      allPrompts.push(...summary.prompts);
    }

    if (hasSuccessfulSourceScan(summaries)) {
      const candidates = generateCandidates(allPrompts);
      await spellService.replaceCandidates(candidates);
    }

    return {
      id: randomUUID(),
      target: scanRequest.target,
      scannedPrompts: allPrompts.length,
      sourceFiles: summaries,
      candidates: await spellService.listCandidates(),
      warningCount: summaries.reduce((total, source) => total + source.warningCount, 0)
    };
  });
  ipcMain.handle('floating:close', () => {
    floatingWindow?.hide();
  });
  ipcMain.handle('floating:getState', () => getFloatingWindowState());
  ipcMain.handle('floating:setPinned', (_event, pinned: boolean) =>
    setFloatingWindowPinned(Boolean(pinned))
  );
}

function getFloatingWindowState(): FloatingWindowState {
  return { pinned: floatingWindowPinned };
}

async function setFloatingWindowPinned(pinned: boolean): Promise<FloatingWindowState> {
  if (!settingsService) {
    throw new Error('Settings service is not ready');
  }
  await settingsService.updateSettings({ quickPanelPinned: pinned });
  floatingWindowPinned = pinned;
  floatingWindow?.setAlwaysOnTop(pinned);
  return getFloatingWindowState();
}

function registerDesktopControls(): void {
  const shortcut = settingsService?.getSettings().quickPanelShortcut ?? DEFAULT_APP_SETTINGS.quickPanelShortcut;
  const registered = registerQuickPanelShortcut(shortcut);
  if (!registered && shortcut !== DEFAULT_APP_SETTINGS.quickPanelShortcut) {
    registerQuickPanelShortcut(DEFAULT_APP_SETTINGS.quickPanelShortcut);
  }

  const trayIcon = createTrayImage(desktopPlatform, TRAY_ICON_PATH, nativeImage);
  tray = new Tray(trayIcon);
  tray.setToolTip(getCurrentAppName());
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show', click: () => mainWindow?.show() },
      { label: 'Quick Panel', click: () => floatingWindow?.show() },
      { label: 'Hide', click: () => mainWindow?.hide() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() }
    ])
  );
}

async function completePackagedSmokeIfRequested(): Promise<void> {
  const outputPath = process.env.SPELLBOOK_PACKAGED_SMOKE_EVIDENCE;
  if (!outputPath) {
    return;
  }
  const paths = getPlatformPaths();
  const evidence = await writePackagedSmokeEvidence(outputPath, {
    platform: desktopPlatform,
    isPackaged: app.isPackaged,
    paths,
    pathContext: platformPathContext,
    sqlWasmPath: SQL_WASM_PATH,
    trayIconPath: TRAY_ICON_PATH,
    windowsIconPath:
      desktopPlatform === 'win32' ? WINDOWS_APP_ICON_PATH : undefined
  });
  app.exit(evidence.passed ? 0 : 1);
}

function getCurrentAppName(): string {
  const language = settingsService?.getSettings().language ?? DEFAULT_APP_SETTINGS.language;
  return resolveAppName(language, app.getLocale());
}

function applyAppIdentity(): void {
  const name = getCurrentAppName();
  app.setName(name);
  const menuTemplate = applicationMenuTemplate(desktopPlatform, name);
  Menu.setApplicationMenu(menuTemplate ? Menu.buildFromTemplate(menuTemplate) : null);
  mainWindow?.setTitle(name);
  floatingWindow?.setTitle(name);
  tray?.setToolTip(name);
}


function registerQuickPanelShortcut(shortcut: ShortcutAccelerator): boolean {
  const accelerator = normalizeShortcutAccelerator(shortcut);
  if (!accelerator) {
    return false;
  }
  if (activeQuickPanelShortcut === accelerator) {
    return true;
  }
  const registered = globalShortcut.register(accelerator, toggleFloatingWindow);
  if (!registered) {
    return false;
  }
  if (activeQuickPanelShortcut) {
    globalShortcut.unregister(activeQuickPanelShortcut);
  }
  activeQuickPanelShortcut = accelerator;
  return true;
}

function toggleFloatingWindow(): void {
  if (!floatingWindow) {
    return;
  }
  if (floatingWindow.isVisible()) {
    floatingWindow.hide();
    return;
  }
  positionFloatingWindow();
  floatingWindow.show();
  floatingWindow.focus();
  floatingWindow.webContents.send('floating:focus-search');
}

function positionFloatingWindow(): void {
  if (!floatingWindow) {
    return;
  }
  const cursorPoint = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursorPoint);
  const bounds = floatingWindow.getBounds();
  const placement = settingsService?.getSettings().quickPanelPlacement ?? DEFAULT_APP_SETTINGS.quickPanelPlacement;
  const position = calculateFloatingPanelPosition({
    placement,
    cursorPoint,
    workArea: display.workArea,
    panelBounds: bounds
  });
  floatingWindow.setPosition(position.x, position.y);
}

function setMainWindowRecommendationPanelOpen(
  window: BrowserWindow,
  open: boolean,
  requestedPanelWidth?: number
): void {
  if (open) {
    if (!mainWindowCompact) {
      window.setMinimumSize(MAIN_WINDOW_MIN_WIDTH, MAIN_WINDOW_MIN_HEIGHT);
      return;
    }

    mainWindowCompact = false;
    window.setMinimumSize(MAIN_WINDOW_COMPACT_MIN_WIDTH, MAIN_WINDOW_MIN_HEIGHT);
    if (restoreMainWindowMaximized) {
      restoreMainWindowMaximized = false;
      window.setMinimumSize(MAIN_WINDOW_MIN_WIDTH, MAIN_WINDOW_MIN_HEIGHT);
      window.maximize();
      return;
    }

    const bounds = window.getContentBounds();
    const display = screen.getDisplayMatching(bounds);
    const targetWidth = Math.min(
      Math.max(mainWindowExpandedWidth, bounds.width + mainWindowRecommendationDelta),
      display.workArea.width
    );
    const targetX = Math.max(
      display.workArea.x,
      Math.min(bounds.x, display.workArea.x + display.workArea.width - targetWidth)
    );
    window.setContentBounds({ ...bounds, x: targetX, width: targetWidth });
    window.setMinimumSize(MAIN_WINDOW_MIN_WIDTH, MAIN_WINDOW_MIN_HEIGHT);
    return;
  }

  if (mainWindowCompact) {
    return;
  }

  restoreMainWindowMaximized = window.isMaximized();
  if (restoreMainWindowMaximized) {
    window.unmaximize();
  }
  const bounds = window.getContentBounds();
  const maximumDelta = Math.max(0, bounds.width - MAIN_WINDOW_COMPACT_MIN_WIDTH);
  const measuredDelta =
    typeof requestedPanelWidth === 'number' && Number.isFinite(requestedPanelWidth)
      ? Math.round(requestedPanelWidth)
      : mainWindowRecommendationDelta;
  mainWindowRecommendationDelta = Math.min(
    Math.max(SPELL_LIBRARY_DEFAULT_RECOMMENDATION_WINDOW_DELTA, measuredDelta),
    maximumDelta
  );
  mainWindowExpandedWidth = bounds.width;
  mainWindowCompact = true;
  window.setMinimumSize(MAIN_WINDOW_COMPACT_MIN_WIDTH, MAIN_WINDOW_MIN_HEIGHT);
  window.setContentBounds({
    ...bounds,
    width: Math.max(MAIN_WINDOW_COMPACT_MIN_WIDTH, bounds.width - mainWindowRecommendationDelta)
  });
}

const preflightResult = runAppPreflight({
  prepare() {},
  showFailure(feedback) {
    dialog.showErrorBox(feedback.title, feedback.message);
  },
  exit(code) {
    app.exit(code);
  }
});

const appReadiness = createAppReadinessBarrier({
  async startApplication() {
    return runAppStartup({
      async initialize() {
        await app.whenReady();
        platformPaths = createPlatformPaths({
          platform: desktopPlatform,
          homeDirectory: homedir(),
          userDataDirectory: app.getPath('userData'),
          env: process.env
        });
        await bootstrap();
      },
      async createWindows() {
        await restoreMainWindow();
        await createFloatingWindow();
        registerDesktopControls();
        await completePackagedSmokeIfRequested();
      },
      showFailure(feedback) {
        dialog.showErrorBox(feedback.title, feedback.message);
      },
      quit() {
        app.quit();
      }
    });
  },
  restorePrimaryWindow: restoreMainWindow
});

const instanceRole =
  preflightResult === 'ready'
    ? registerSingleInstanceLifecycle({
        requestLock: () => app.requestSingleInstanceLock(),
        onSecondInstance(handler) {
          app.on('second-instance', () => handler());
        },
        async restorePrimaryWindow() {
          await appReadiness.restorePrimaryWindow();
        },
        reportRestoreFailure(error) {
          const detail = error instanceof Error ? error.message : String(error);
          dialog.showErrorBox(
            'Spellbook could not restore its window',
            `The existing Spellbook process is still running, but its window could not be restored.\n\nDetails: ${detail}`
          );
        },
        quitSecondary: () => app.quit()
      })
    : 'secondary';

if (preflightResult === 'ready' && instanceRole === 'primary') {
  void appReadiness.start();
}

app.on('window-all-closed', () => {
  if (desktopPlatform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (!(await appReadiness.restorePrimaryWindow())) {
    return;
  }
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    await createFloatingWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
