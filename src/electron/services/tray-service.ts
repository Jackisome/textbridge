import { Menu, Tray, app, nativeImage } from 'electron';
import path from 'path';

export interface TrayService {
  ensureTray(): Tray;
  dispose(): void;
}

export interface CreateTrayServiceOptions {
  onOpenSettings(): void;
  onExit(): void;
}

export function createTrayService({
  onOpenSettings,
  onExit
}: CreateTrayServiceOptions): TrayService {
  let tray: Tray | null = null;

  function buildContextMenu() {
    return Menu.buildFromTemplate([
      {
        label: 'Open Settings',
        click: onOpenSettings
      },
      {
        type: 'separator'
      },
      {
        label: 'Exit',
        click: () => {
          onExit();
          app.quit();
        }
      }
    ]);
  }

  function getIconPath(): string {
    // In production, icons are in build/icons/
    // In development, they are relative to project root
    const isDev = !app.isPackaged;
    if (isDev) {
      return path.join(app.getAppPath(), 'build', 'icons', 'tray-icon.png');
    }
    return path.join(process.resourcesPath, 'icons', 'tray-icon.png');
  }

  return {
    ensureTray(): Tray {
      if (tray) {
        tray.setContextMenu(buildContextMenu());
        return tray;
      }

      const iconPath = getIconPath();
      const icon = nativeImage.createFromPath(iconPath);
      tray = new Tray(icon);
      tray.setToolTip('TextBridge');
      tray.setContextMenu(buildContextMenu());
      tray.on('double-click', onOpenSettings);

      return tray;
    },
    dispose(): void {
      tray?.destroy();
      tray = null;
    }
  };
}
