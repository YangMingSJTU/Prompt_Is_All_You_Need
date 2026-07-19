import type {
  BrowserWindowConstructorOptions,
  MenuItemConstructorOptions,
  NativeImage
} from 'electron';
import type { DesktopPlatform } from '../../shared/platform';
import { APP_TITLEBAR_HEIGHT } from '../../shared/layout';

export function mainWindowChromeOptions(
  platform: DesktopPlatform,
  windowsIconPath: string
): Pick<
  BrowserWindowConstructorOptions,
  'icon' | 'titleBarStyle' | 'titleBarOverlay' | 'trafficLightPosition'
> {
  if (platform === 'darwin') {
    return {
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 18, y: 18 }
    };
  }
  return {
    icon: windowsIconPath,
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#0f1115',
      symbolColor: '#f5f0df',
      height: APP_TITLEBAR_HEIGHT
    }
  };
}

export function optionalWindowsIcon(
  platform: DesktopPlatform,
  windowsIconPath: string
): string | undefined {
  return platform === 'win32' ? windowsIconPath : undefined;
}

export function applicationMenuTemplate(
  platform: DesktopPlatform,
  appName: string
): MenuItemConstructorOptions[] | null {
  if (platform !== 'darwin') {
    return null;
  }
  return [
    {
      label: appName,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ];
}

export interface NativeImageFactory {
  createEmpty(): NativeImage;
  createFromPath(path: string): NativeImage;
}

export function createTrayImage(
  platform: DesktopPlatform,
  iconPath: string,
  factory: NativeImageFactory
): NativeImage {
  const source = factory.createFromPath(iconPath);
  if (source.isEmpty()) {
    throw new Error(`Tray icon is missing or invalid: ${iconPath}`);
  }
  if (platform === 'win32') {
    return source.resize({ width: 16, height: 16 });
  }
  const image = factory.createEmpty();
  image.addRepresentation({ scaleFactor: 1, dataURL: source.resize({ width: 16, height: 16 }).toDataURL() });
  image.addRepresentation({ scaleFactor: 2, dataURL: source.resize({ width: 32, height: 32 }).toDataURL() });
  image.setTemplateImage(true);
  return image;
}
