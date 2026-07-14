import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { resolveAppName } from '../shared/appIdentity';
import { calculateFloatingPanelPosition } from '../shared/floatingPlacement';
import {
  APP_TITLEBAR_HEIGHT,
  MAIN_WINDOW_DEFAULT_HEIGHT,
  MAIN_WINDOW_DEFAULT_WIDTH,
  MAIN_WINDOW_MIN_HEIGHT,
  MAIN_WINDOW_MIN_WIDTH
} from '../shared/layout';
import type {
  ScanProvider,
  ScanRunRequest,
  ScanSourceConfig,
  SkillPlatform,
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
import { openAppDatabase } from './services/database';
import { createSpellService } from './services/spellService';
import { generateCandidates } from './services/candidateGenerator';
import { defaultHistoryRoots, discoverJsonlFiles, scanJsonlFiles } from './services/scanner';
import { createSettingsService, defaultScanSources, type SettingsService } from './services/settingsService';
import { createSkillService, defaultSkillRoots } from './services/skillService';
import { createSpellbookPaths } from './services/spellbookPaths';
import { getAppIconPath, getTrayIconPath } from './services/appAssets';

let mainWindow: BrowserWindow | null = null;
let floatingWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settingsService: SettingsService | null = null;
let databasePath = '';
let activeQuickPanelShortcut: ShortcutAccelerator | null = null;

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

  await loadRenderer(mainWindow, 'main');
}

async function createFloatingWindow(): Promise<void> {
  const preloadPath = join(__dirname, '../preload/preload.mjs');
  const appName = getCurrentAppName();
  floatingWindow = new BrowserWindow({
    width: 420,
    height: 320,
    minWidth: 380,
    minHeight: 280,
    maxWidth: 460,
    maxHeight: 360,
    title: appName,
    icon: getAppIconPath(),
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
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
    floatingWindow?.hide();
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
  await spellService.seedStarterSpells();
  applyAppIdentity();

  ipcMain.handle('spells:search', (_event, query: string) => spellService.searchSpells(query ?? ''));
  ipcMain.handle('spells:list', () => spellService.listSpells());
  ipcMain.handle('spells:popular', (_event, limit?: number) => spellService.listPopularSpells(limit ?? 6));
  ipcMain.handle('spells:copy', async (_event, spellId: string) => {
    const spell = await spellService.copySpell(spellId);
    clipboard.writeText(spell.body);
    floatingWindow?.hide();
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
  ipcMain.handle('settings:info', () => ({
    databasePath,
    defaultScanSources: defaultScanSources(),
    historyRoots: defaultHistoryRoots(),
    skillRoots: skillService.getSkillRoots()
  }));
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
            warning: `Shortcut conflict: ${formatShortcutDisplay(requestedShortcut)}`
          };
        }
      }
      nextPatch.quickPanelShortcut = requestedShortcut;
    }
    const settings = await settingsService.updateSettings(nextPatch);
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

    const candidates = generateCandidates(allPrompts);
    await spellService.replaceCandidates(candidates);

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
}

function registerDesktopControls(): void {
  const shortcut = settingsService?.getSettings().quickPanelShortcut ?? DEFAULT_APP_SETTINGS.quickPanelShortcut;
  const registered = registerQuickPanelShortcut(shortcut);
  if (!registered && shortcut !== DEFAULT_APP_SETTINGS.quickPanelShortcut) {
    registerQuickPanelShortcut(DEFAULT_APP_SETTINGS.quickPanelShortcut);
  }

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
  globalShortcut.unregisterAll();
});
