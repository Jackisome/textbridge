/// <reference types="vite/client" />

interface ElectronInfo {
  chrome: string;
  electron: string;
  node: string;
  platform: string;
}

interface Window {
  electronInfo: ElectronInfo;
}
