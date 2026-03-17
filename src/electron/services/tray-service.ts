import { Menu, Tray, app, nativeImage } from 'electron';

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

  return {
    ensureTray(): Tray {
      if (tray) {
        tray.setContextMenu(buildContextMenu());
        return tray;
      }

      tray = new Tray(nativeImage.createEmpty());
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
