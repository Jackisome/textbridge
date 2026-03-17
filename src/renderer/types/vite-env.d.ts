/// <reference types="vite/client" />

import type { PreloadContractShape } from '../../shared/types/ipc';
import type { ElectronInfo, TextBridgeApi } from '../../shared/types/preload';

declare global {
  interface Window {
    electronInfo: ElectronInfo;
    textBridge: TextBridgeApi;
    textBridgeContracts?: PreloadContractShape;
  }
}

export {};
