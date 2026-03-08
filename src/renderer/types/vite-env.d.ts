/// <reference types="vite/client" />

import type {
  DesktopApi,
  ElectronInfo,
  PreloadContractShape
} from '../../shared/types/ipc';

declare global {
  interface Window {
    electronInfo: ElectronInfo;
    textBridge: DesktopApi;
    textBridgeContracts: PreloadContractShape;
  }
}

export {};
