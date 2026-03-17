import { contextBridge } from 'electron';

import { DEFAULT_SETTINGS } from '../shared/constants/default-settings';
import { exposeSettingsApi } from './security/expose-settings-api';
import type {
  ElectronInfo,
  PreloadContractShape,
  RuntimeStatus
} from '../shared/types/ipc';

const electronInfo: ElectronInfo = {
  chrome: process.versions.chrome,
  electron: process.versions.electron,
  node: process.versions.node,
  platform: process.platform
};

const runtimeStatus: RuntimeStatus = {
  ready: false,
  platform: process.platform,
  activeProvider: DEFAULT_SETTINGS.activeProviderId,
  registeredShortcuts: [],
  helperState: 'idle',
  helperLastErrorCode: null,
  helperPid: null,
  lastExecution: null,
  recentExecutions: []
};

const preloadContractShape: PreloadContractShape = {
  draftRequest: {
    text: '',
    sourceLanguage: DEFAULT_SETTINGS.sourceLanguage,
    targetLanguage: DEFAULT_SETTINGS.targetLanguage,
    outputMode: DEFAULT_SETTINGS.outputMode
  },
  lastExecution: null,
  settingsSnapshot: DEFAULT_SETTINGS
};

contextBridge.exposeInMainWorld('electronInfo', electronInfo);
contextBridge.exposeInMainWorld('textBridge', exposeSettingsApi());
contextBridge.exposeInMainWorld('textBridgeContracts', {
  ...preloadContractShape,
  runtimeStatus
});
