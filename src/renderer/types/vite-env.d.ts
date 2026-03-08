/// <reference types="vite/client" />

import type { ElectronInfo, TextBridgeApi } from '../../shared/types/preload';

declare global {
  interface Window {
    electronInfo: ElectronInfo;
    textBridge: TextBridgeApi;
  }
}

export {};
