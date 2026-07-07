import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, nativeImage, Tray } from 'electron';
import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { ExportablePrompt, ExportTarget } from '../shared/types';
import { openAppDatabase } from './services/database';
import { previewExport, writeExport } from './services/exporter';
import { createPromptService } from './services/promptService';
import { generateCandidates } from './services/ranker';
import { defaultHistoryRoots, discoverJsonlFiles, scanJsonlFiles } from './services/scanner';

let mainWindow: BrowserWindow | null = null;
let floatingWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

async function createWindow(): Promise<void> {
  const preloadPath = join(__dirname, '../preload/preload.mjs');
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 900,
    minHeight: 620,
    title: 'Agent Prompt Miner',
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
    title: 'Agent Prompt Miner Quick Panel',
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
  const db = await openAppDatabase(join(app.getPath('userData'), 'agent-prompt-miner.sqlite'));
  const promptService = createPromptService(db);
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
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!floatingWindow) {
      return;
    }
    if (floatingWindow.isVisible()) {
      floatingWindow.hide();
    } else {
      const focusedWindow = BrowserWindow.getFocusedWindow();
      const bounds = focusedWindow?.getBounds();
      if (bounds) {
        floatingWindow.setPosition(
          Math.round(bounds.x + bounds.width / 2 - 280),
          Math.round(bounds.y + 110)
        );
      }
      floatingWindow.show();
      floatingWindow.focus();
      floatingWindow.webContents.send('floating:focus-search');
    }
  });

  const trayIcon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIklEQVR4AWP4z8Dwn4ECwESJ5lEDRg0YNWDUgFEDBg0A2b4DHXcCpJcAAAAASUVORK5CYII='
  );
  tray = new Tray(trayIcon);
  tray.setToolTip('Agent Prompt Miner');
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

app.whenReady().then(async () => {
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
