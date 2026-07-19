import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { resolveAppName } from '../shared/appIdentity';
import { calculateFloatingPanelPosition } from '../shared/floatingPlacement';
import {
  APP_TITLEBAR_HEIGHT,
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
  ScanProvider,
  ScanRunRequest,
  ScanSourceConfig,
  SkillPlatform,
  SpellCreateInput,
  SpellStatePatch,
  SpellUpdatePatch
} from '../shared/types';
import {
  DEFAULT_APP_SETTINGS,
  type AppSettingsPatch,
  type ShortcutPlatform,
  type ShortcutUpdateRequest
} from '../shared/settings';
import { openAppDatabase } from './services/database';
import { createSpellService } from './services/spellService';
import { generateCandidates } from './services/candidateGenerator';
import {
  defaultHistoryRoots,
  discoverJsonlFiles,
  hasSuccessfulSourceScan,
  scanJsonlFiles
} from './services/scanner';
import { createSettingsService, defaultScanSources, type SettingsService } from './services/settingsService';
import { createSkillService, defaultSkillRoots } from './services/skillService';
import { createSpellbookPaths } from './services/spellbookPaths';
import { getAppIconPath, getTrayIconPath } from './services/appAssets';
import { QuickPanelShortcutController } from './services/quickPanelShortcutController';

let mainWindow: BrowserWindow | null = null;
let floatingWindow: BrowserWindow | null = null;
let floatingWindowPinned = false;
let tray: Tray | null = null;
let settingsService: SettingsService | null = null;
let shortcutController: QuickPanelShortcutController | null = null;
let databasePath = '';
let mainWindowCompact = false;
let mainWindowExpandedWidth = MAIN_WINDOW_DEFAULT_WIDTH;
let mainWindowRecommendationDelta = SPELL_LIBRARY_DEFAULT_RECOMMENDATION_WINDOW_DELTA;
let restoreMainWindowMaximized = false;

async function createWindow(): Promise<void> {
  const preloadPath = join(__dirname, '../preload/preload.mjs');
  const appName = getCurrentAppName();
  mainWindow = new BrowserWindow({
    width: MAIN_WINDOW_DEFAULT_WIDTH,
    height: MAIN_WINDOW_DEFAULT_HEIGHT,
    minWidth: MAIN_WINDOW_MIN_WIDTH,
    minHeight: MAIN_WINDOW_MIN_HEIGHT,
    useContentSize: true,
    title: appName,
    icon: getAppIconPath(),
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f1115',
      symbolColor: '#f5f0df',
      height: APP_TITLEBAR_HEIGHT
    },
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });
  mainWindow.webContents.on('did-start-loading', () => {
    shortcutController?.forceEndCapture();
  });
  mainWindow.webContents.on('render-process-gone', () => {
    shortcutController?.forceEndCapture();
  });
  mainWindow.webContents.on('destroyed', () => {
    shortcutController?.forceEndCapture();
  });
  mainWindow.on('blur', () => {
    const controller = shortcutController;
    if (!controller?.getState().captureActive) {
      return;
    }
    const result = controller.forceEndCapture();
    const captureWindow = mainWindow;
    if (captureWindow && !captureWindow.isDestroyed()) {
      captureWindow.webContents.send('shortcut:capture-ended', result);
    }
  });
  mainWindow.on('closed', () => {
    shortcutController?.forceEndCapture();
    mainWindow = null;
  });

  await loadRenderer(mainWindow, 'main');
}

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
    icon: getAppIconPath(),
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
  const spellbookPaths = createSpellbookPaths();
  databasePath = spellbookPaths.databasePath;
  const db = await openAppDatabase(databasePath);
  const spellService = createSpellService(db);
  const skillService = createSkillService(db, {
    roots: defaultSkillRoots(),
    packageDirectory: spellbookPaths.packageDirectory
  });
  settingsService = createSettingsService(db);
  shortcutController = new QuickPanelShortcutController({
    platform: getShortcutPlatform(),
    globalShortcut,
    settingsService,
    onToggle: toggleFloatingWindow
  });
  await shortcutController.initialize();
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
  ipcMain.handle('skills:list', () => skillService.listSkills());
  ipcMain.handle('skills:scan', () => skillService.scanSkills());
  ipcMain.handle('skills:package', (_event, skillId: string) => skillService.packageSkill(skillId));
  ipcMain.handle('skills:install', (_event, skillId: string, targetPlatform: SkillPlatform) =>
    skillService.installSkill(skillId, targetPlatform)
  );
  ipcMain.handle('settings:get', () => {
    if (!settingsService) {
      throw new Error('Settings service is not ready');
    }
    return settingsService.getSettings();
  });
  ipcMain.handle('shortcut:getState', (event) => {
    assertMainWindowSender(event);
    return getShortcutController().getState();
  });
  ipcMain.handle('shortcut:update', (event, request: ShortcutUpdateRequest) => {
    assertMainWindowSender(event);
    if (!isShortcutUpdateRequest(request)) {
      throw new Error('Invalid shortcut update request');
    }
    return getShortcutController().update(request);
  });
  ipcMain.handle('shortcut:beginCapture', (event) => {
    assertMainWindowSender(event);
    return getShortcutController().beginCapture();
  });
  ipcMain.handle('shortcut:endCapture', (event, sessionToken: string) => {
    assertMainWindowSender(event);
    if (typeof sessionToken !== 'string' || !sessionToken) {
      throw new Error('Invalid shortcut capture session');
    }
    return getShortcutController().endCapture(sessionToken);
  });
  ipcMain.handle('shortcut:dismissStartupNotice', (event) => {
    assertMainWindowSender(event);
    return getShortcutController().dismissStartupNotice();
  });
  ipcMain.handle('settings:info', () => ({
    databasePath,
    defaultScanSources: defaultScanSources(),
    historyRoots: defaultHistoryRoots(),
    skillRoots: skillService.getSkillRoots()
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
  ipcMain.handle('settings:update', async (_event, patch: AppSettingsPatch) => {
    if (!settingsService) {
      throw new Error('Settings service is not ready');
    }
    if (!patch || typeof patch !== 'object' || 'quickPanelShortcut' in patch) {
      throw new Error('Shortcut updates require the dedicated shortcut API');
    }
    const settings = await settingsService.updateSettings(patch);
    applyAppIdentity();
    return { settings };
  });
  ipcMain.handle('scanner:run', async (_event, request: ScanRunRequest) => {
    if (!settingsService) {
      throw new Error('Settings service is not ready');
    }
    const scanRequest = normalizeScanRunRequest(request, settingsService.getSettings().scanSources);
    const roots = scanRequest.scanSources.filter(
      (source) =>
        source.enabled &&
        source.target === scanRequest.target &&
        scanRequest.providers.includes(source.provider)
    );
    if (scanRequest.target === 'skills') {
      const skills = await skillService.scanSkills(
        roots.map((root) => ({ platform: root.provider, path: root.path }))
      );
      return {
        id: randomUUID(),
        target: scanRequest.target,
        scannedPrompts: 0,
        sourceFiles: [],
        candidates: await spellService.listCandidates(),
        skills,
        warningCount: 0
      };
    }

    const summaries = [];
    const allPrompts = [];

    for (const root of roots) {
      const files = await discoverJsonlFiles(root.path);
      const summary = await scanJsonlFiles(files, root.provider);
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
      skills: await skillService.listSkills(),
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
  const trayIcon = nativeImage.createFromPath(getTrayIconPath()).resize({ width: 16, height: 16 });
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

function getCurrentAppName(): string {
  const language = settingsService?.getSettings().language ?? DEFAULT_APP_SETTINGS.language;
  return resolveAppName(language, app.getLocale());
}

function applyAppIdentity(): void {
  const name = getCurrentAppName();
  app.setName(name);
  mainWindow?.setTitle(name);
  floatingWindow?.setTitle(name);
  tray?.setToolTip(name);
}

function normalizeScanRunRequest(request: ScanRunRequest, fallbackSources: ScanSourceConfig[]): ScanRunRequest {
  const target = request?.target === 'skills' ? 'skills' : 'spells';
  const providers = Array.isArray(request?.providers)
    ? request.providers.filter((provider): provider is ScanProvider => provider === 'claude' || provider === 'codex')
    : [];
  const scanSources = Array.isArray(request?.scanSources)
    ? request.scanSources.filter(isScanSourceConfig)
    : [];
  return {
    target,
    providers: providers.length ? [...new Set(providers)] : ['claude', 'codex'],
    scanSources: scanSources.length ? scanSources : fallbackSources
  };
}

function isScanSourceConfig(value: unknown): value is ScanSourceConfig {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const source = value as Record<string, unknown>;
  return (
    (source.provider === 'claude' || source.provider === 'codex') &&
    (source.target === 'spells' || source.target === 'skills') &&
    typeof source.path === 'string' &&
    typeof source.enabled === 'boolean'
  );
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

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await bootstrap();
  await createWindow();
  await createFloatingWindow();
  registerDesktopControls();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow();
    await createFloatingWindow();
  }
});

app.on('will-quit', () => {
  shortcutController?.dispose();
});

function getShortcutPlatform(): ShortcutPlatform {
  return process.platform === 'darwin' ? 'darwin' : 'win32';
}

function getShortcutController(): QuickPanelShortcutController {
  if (!shortcutController) {
    throw new Error('Shortcut controller is not ready');
  }
  return shortcutController;
}

function assertMainWindowSender(event: IpcMainInvokeEvent): void {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
    throw new Error('Shortcut IPC is only available to the main window');
  }
}

function isShortcutUpdateRequest(value: unknown): value is ShortcutUpdateRequest {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const request = value as Record<string, unknown>;
  return (
    request.intent === 'reset' ||
    (request.intent === 'set' && typeof request.accelerator === 'string')
  );
}
