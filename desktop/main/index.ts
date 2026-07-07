import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { calculateFloatingPanelPosition } from '../shared/floatingPlacement';
import type { ExportablePrompt, ExportTarget } from '../shared/types';
import type { AppSettings, ShortcutAccelerator } from '../shared/settings';
import {
  DEFAULT_APP_SETTINGS,
  formatShortcutDisplay,
  normalizeShortcutAccelerator
} from '../shared/settings';
import { openAppDatabase } from './services/database';
import { previewExport, writeExport } from './services/exporter';
import { createPromptService } from './services/promptService';
import { generateCandidates } from './services/ranker';
import { defaultHistoryRoots, discoverJsonlFiles, scanJsonlFiles } from './services/scanner';
import { createSettingsService, type SettingsService } from './services/settingsService';

let mainWindow: BrowserWindow | null = null;
let floatingWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let settingsService: SettingsService | null = null;
let databasePath = '';
let activeQuickPanelShortcut: ShortcutAccelerator | null = null;

async function createWindow(): Promise<void> {
  const preloadPath = join(__dirname, '../preload/preload.mjs');
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    title: 'Prompt Miner',
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
  floatingWindow = new BrowserWindow({
    width: 560,
    height: 420,
    minWidth: 520,
    minHeight: 360,
    maxWidth: 680,
    maxHeight: 520,
    title: 'Prompt Miner',
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
  databasePath = join(app.getPath('userData'), 'agent-prompt-miner.sqlite');
  const db = await openAppDatabase(databasePath);
  const promptService = createPromptService(db);
  settingsService = createSettingsService(db);
  await promptService.seedStarterPrompts();

  ipcMain.handle('prompts:search', (_event, query: string) => promptService.searchPrompts(query ?? ''));
  ipcMain.handle('prompts:list', () => promptService.listPrompts());
  ipcMain.handle('prompts:popular', (_event, limit?: number) => promptService.listPopularPrompts(limit ?? 6));
  ipcMain.handle('prompts:copy', async (_event, promptId: string) => {
    const prompt = await promptService.copyPrompt(promptId);
    clipboard.writeText(prompt.body);
    floatingWindow?.hide();
    return prompt;
  });
  ipcMain.handle('candidates:list', () => promptService.listCandidates());
  ipcMain.handle('candidates:promote', (_event, candidateId: string) =>
    promptService.promoteCandidate(candidateId)
  );
  ipcMain.handle('analytics:get', () => promptService.getAnalytics());
  ipcMain.handle('settings:get', () => {
    if (!settingsService) {
      throw new Error('Settings service is not ready');
    }
    return settingsService.getSettings();
  });
  ipcMain.handle('settings:info', () => ({
    databasePath,
    historyRoots: defaultHistoryRoots(),
    exportTargets: [
      { label: 'Snippet', path: defaultExportBase('snippet') },
      { label: 'Claude Skill', path: defaultExportBase('claude-skill') },
      { label: 'Codex Skill', path: defaultExportBase('codex-skill') }
    ]
  }));
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
    return { settings };
  });
  ipcMain.handle('scanner:run', async () => {
    const roots = defaultHistoryRoots();
    const summaries = [];
    const allPrompts = [];

    for (const root of roots) {
      const files = await discoverJsonlFiles(root.path);
      const summary = await scanJsonlFiles(files, root.sourceTool);
      summaries.push(...summary.sourceFiles);
      allPrompts.push(...summary.prompts);
    }

    const candidates = generateCandidates(allPrompts);
    await promptService.saveCandidates(candidates);

    return {
      id: randomUUID(),
      scannedPrompts: allPrompts.length,
      sourceFiles: summaries,
      candidates,
      warningCount: summaries.reduce((total, source) => total + source.warningCount, 0)
    };
  });
  ipcMain.handle(
    'export:preview',
    (_event, prompt: ExportablePrompt, target: ExportTarget, baseDirectory?: string) =>
      previewExport(prompt, target, baseDirectory ?? defaultExportBase(target))
  );
  ipcMain.handle(
    'export:write',
    async (
      _event,
      prompt: ExportablePrompt,
      target: ExportTarget,
      baseDirectory?: string,
      promptId?: string | null,
      candidateId?: string | null
    ) => {
      const result = await writeExport(prompt, target, baseDirectory ?? defaultExportBase(target));
      await promptService.recordExport({
        promptId,
        candidateId,
        assetType: target,
        path: result.path
      });
      return result;
    }
  );
  ipcMain.handle('floating:close', () => {
    floatingWindow?.hide();
  });
}

function defaultExportBase(target: ExportTarget): string {
  const home = homedir();
  if (target === 'snippet') {
    return join(home, '.apm', 'snippets');
  }
  if (target === 'claude-skill') {
    return join(home, '.claude', 'skills');
  }
  return join(home, '.codex', 'skills');
}

function registerDesktopControls(): void {
  const shortcut = settingsService?.getSettings().quickPanelShortcut ?? DEFAULT_APP_SETTINGS.quickPanelShortcut;
  const registered = registerQuickPanelShortcut(shortcut);
  if (!registered && shortcut !== DEFAULT_APP_SETTINGS.quickPanelShortcut) {
    registerQuickPanelShortcut(DEFAULT_APP_SETTINGS.quickPanelShortcut);
  }

  const trayIcon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIklEQVR4AWP4z8Dwn4ECwESJ5lEDRg0YNWDUgFEDBg0A2b4DHXcCpJcAAAAASUVORK5CYII='
  );
  tray = new Tray(trayIcon);
  tray.setToolTip('Prompt Miner');
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
