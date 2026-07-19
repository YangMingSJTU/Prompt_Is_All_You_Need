import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('shortcut IPC and renderer UI', () => {
  it('routes shortcut changes through the authoritative controller and main-window-only IPC', () => {
    const main = readFileSync('desktop/main/index.ts', 'utf8');
    const controller = readFileSync(
      'desktop/main/services/quickPanelShortcutController.ts',
      'utf8'
    );
    const preload = readFileSync('desktop/main/preload.ts', 'utf8');
    const globals = readFileSync('desktop/renderer/global.d.ts', 'utf8');

    expect(main).toContain('new QuickPanelShortcutController');
    expect(main).toContain('await shortcutController.initialize()');
    expect(main).toContain("ipcMain.handle('shortcut:getState'");
    expect(main).toContain("ipcMain.handle('shortcut:update'");
    expect(main).toContain("ipcMain.handle('shortcut:beginCapture'");
    expect(main).toContain("ipcMain.handle('shortcut:endCapture'");
    expect(main).toContain('assertMainWindowSender(event)');
    expect(main).toContain('event.sender !== mainWindow.webContents');
    expect(main).toContain("'quickPanelShortcut' in patch");
    expect(main).not.toContain('globalShortcut.register(');
    expect(main).toContain("mainWindow.webContents.on('render-process-gone'");
    expect(main).toContain("mainWindow.webContents.on('destroyed'");
    expect(main).toContain("mainWindow.on('blur'");
    expect(main).toContain("captureWindow.webContents.send('shortcut:capture-ended'");

    expect(controller).toContain('this.registerOwned(candidate)');
    expect(controller).toContain('await this.settingsService.updateQuickPanelShortcut(candidate)');
    expect(controller).toContain('this.unregisterOwned(previous.activeAccelerator)');
    expect(controller).toContain('this.globalShortcut.setSuspended(true)');
    expect(controller).toContain('this.globalShortcut.setSuspended(false)');

    expect(preload).toContain("ipcRenderer.invoke('shortcut:getState')");
    expect(preload).toContain("ipcRenderer.invoke('shortcut:update', request)");
    expect(preload).toContain("ipcRenderer.invoke('shortcut:beginCapture')");
    expect(preload).toContain("ipcRenderer.invoke('shortcut:endCapture', sessionToken)");
    expect(preload).toContain("ipcRenderer.on('shortcut:capture-ended'");
    expect(globals).toContain('getQuickPanelShortcutState(): Promise<QuickPanelShortcutState>');
    expect(globals).toContain('updateQuickPanelShortcut(request: ShortcutUpdateRequest)');
    expect(globals).toContain('onShortcutCaptureEnded(');
  });

  it('renders authoritative active/fallback/disabled state with accessible capture lifecycle', () => {
    const component = readFileSync('desktop/renderer/components/SettingsView.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(component).toContain('shortcutState?.activeAccelerator');
    expect(component).toContain('shortcutState.configuredAccelerator');
    expect(component).toContain('beginShortcutCapture()');
    expect(component).toContain('endShortcutCapture(sessionToken)');
    expect(component).toContain("event.key === 'Tab'");
    expect(component).toContain("event.key === 'Escape'");
    expect(component).toContain("role=\"alert\"");
    expect(component).toContain('aria-busy={shortcutSaving}');
    expect(component).toContain('aria-disabled={saving || shortcutSaving || !shortcutState}');
    expect(component).toContain("'shortcut-capture-description shortcut-inline-error'");
    expect(component).toContain('shortcutButtonPresentation.label');
    expect(component).toContain('restoreShortcutButtonFocus');
    expect(component).toContain('getShortcutAccessibleText');
    expect(component).toContain('dismissShortcutStartupNotice()');
    expect(component).toContain("t('settings.shortcut.internalDescription')");
    expect(component).not.toContain('updateSettings({ quickPanelShortcut');

    expect(styles).toContain('.settings-shortcut-page');
    expect(styles).toContain('.shortcut-keycaps kbd');
    expect(styles).toContain('.shortcut-status.disabled');
    expect(styles).toContain('.shortcut-inline-notice.error');
    expect(styles).toContain('.shortcut-hint-row');
  });

  it('protects IME input and exposes fixed floating-panel keyboard hints and announcements', () => {
    const component = readFileSync('desktop/renderer/components/FloatingPanel.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(component).toContain('event.nativeEvent.isComposing');
    expect(component).toContain("event.key === 'ArrowDown'");
    expect(component).toContain("event.key === 'ArrowUp'");
    expect(component).toContain("event.key === 'Enter' && selected");
    expect(component).toContain('getNextFloatingSelectionIndex');
    expect(component).toContain('<ShortcutHintBar');
    expect(component).toContain('aria-live="polite"');
    expect(component).toContain('aria-disabled={!hasResults}');
    expect(component).toContain('if (isPinned)');
    expect(styles).toContain('.floating-shortcut-hints');
    expect(styles).toContain('grid-template-rows: 36px minmax(0, 1fr) 32px');
  });
});
