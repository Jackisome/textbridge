import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electronInfo', {
  chrome: process.versions.chrome,
  electron: process.versions.electron,
  node: process.versions.node,
  platform: process.platform
});
