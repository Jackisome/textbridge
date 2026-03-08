import { DEFAULT_SETTINGS } from '../constants/default-settings';
import type {
  AppSettings,
  CaptureMethodPreference,
  OutputMode,
  TranslationProviderKind
} from '../types/settings';

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function readProviderKind(value: unknown): TranslationProviderKind {
  return value === 'http' ? 'http' : DEFAULT_SETTINGS.provider.kind;
}

function readCaptureMethodPreference(value: unknown): CaptureMethodPreference {
  return value === 'clipboard' ? 'clipboard' : DEFAULT_SETTINGS.capture.preferredMethod;
}

function readOutputMode(value: unknown): OutputMode {
  return value === 'append-translation'
    ? 'append-translation'
    : DEFAULT_SETTINGS.writeBack.outputMode;
}

export function normalizeAppSettings(value: unknown): AppSettings {
  const settings = isRecord(value) ? value : {};
  const provider = isRecord(settings.provider) ? settings.provider : {};
  const shortcuts = isRecord(settings.shortcuts) ? settings.shortcuts : {};
  const capture = isRecord(settings.capture) ? settings.capture : {};
  const writeBack = isRecord(settings.writeBack) ? settings.writeBack : {};
  const ui = isRecord(settings.ui) ? settings.ui : {};

  return {
    sourceLanguage: readString(settings.sourceLanguage, DEFAULT_SETTINGS.sourceLanguage),
    targetLanguage: readString(settings.targetLanguage, DEFAULT_SETTINGS.targetLanguage),
    provider: {
      kind: readProviderKind(provider.kind),
      endpoint: readString(provider.endpoint, DEFAULT_SETTINGS.provider.endpoint),
      apiKey: readString(provider.apiKey, DEFAULT_SETTINGS.provider.apiKey),
      model: readString(provider.model, DEFAULT_SETTINGS.provider.model),
      timeoutMs:
        typeof provider.timeoutMs === 'number'
          ? provider.timeoutMs
          : DEFAULT_SETTINGS.provider.timeoutMs
    },
    shortcuts: {
      quickTranslate: readString(
        shortcuts.quickTranslate,
        DEFAULT_SETTINGS.shortcuts.quickTranslate
      ),
      contextTranslate: readString(
        shortcuts.contextTranslate,
        DEFAULT_SETTINGS.shortcuts.contextTranslate
      )
    },
    capture: {
      preferredMethod: readCaptureMethodPreference(capture.preferredMethod),
      allowClipboardFallback: readBoolean(
        capture.allowClipboardFallback,
        DEFAULT_SETTINGS.capture.allowClipboardFallback
      )
    },
    writeBack: {
      outputMode: readOutputMode(writeBack.outputMode),
      allowPasteFallback: readBoolean(
        writeBack.allowPasteFallback,
        DEFAULT_SETTINGS.writeBack.allowPasteFallback
      ),
      allowPopupFallback: readBoolean(
        writeBack.allowPopupFallback,
        DEFAULT_SETTINGS.writeBack.allowPopupFallback
      )
    },
    ui: {
      closeMainWindowToTray: readBoolean(
        ui.closeMainWindowToTray,
        DEFAULT_SETTINGS.ui.closeMainWindowToTray
      ),
      startMinimized: readBoolean(ui.startMinimized, DEFAULT_SETTINGS.ui.startMinimized)
    }
  };
}
