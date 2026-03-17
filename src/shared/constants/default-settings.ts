import type { TranslationClientSettings } from '../types/settings';

const defaultSystemPrompt = 'You are a professional translation engine. Return only the translated text.';
const defaultUserPromptTemplate =
  'Translate the following text to {{to}}. If the text does not need translation, return the original text only.\n\n{{origin}}';

export const defaultTranslationClientSettings: TranslationClientSettings = {
  sourceLanguage: 'auto',
  targetLanguage: 'zh-CN',
  activeProviderId: 'mock',
  quickTranslateShortcut: 'CommandOrControl+Shift+K',
  contextTranslateShortcut: 'CommandOrControl+Shift+L',
  outputMode: 'replace-original',
  captureMode: 'uia-first',
  closeToTray: true,
  startMinimized: false,
  enableClipboardFallback: true,
  enablePopupFallback: true,
  providers: {
    mock: {
      prefix: '[Mock] ',
      latencyMs: 150
    },
    claude: {
      apiKey: '',
      model: 'claude-3-5-haiku-latest',
      baseUrl: 'https://api.anthropic.com/v1/messages',
      systemPrompt: defaultSystemPrompt,
      userPromptTemplate: defaultUserPromptTemplate,
      timeoutMs: 20000
    },
    deepseek: {
      apiKey: '',
      model: 'deepseek-chat',
      baseUrl: 'https://api.deepseek.com/chat/completions',
      systemPrompt: defaultSystemPrompt,
      userPromptTemplate: defaultUserPromptTemplate,
      timeoutMs: 20000
    },
    minimax: {
      apiKey: '',
      model: 'MiniMax-Text-01',
      baseUrl: 'https://api.minimaxi.com/v1/text/chatcompletion_v2',
      systemPrompt: defaultSystemPrompt,
      userPromptTemplate: defaultUserPromptTemplate,
      timeoutMs: 20000
    },
    gemini: {
      apiKey: '',
      model: 'gemini-2.0-flash',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
      userPromptTemplate: defaultUserPromptTemplate,
      timeoutMs: 20000
    },
    google: {
      baseUrl: 'https://translate.googleapis.com/translate_a/single',
      timeoutMs: 20000
    },
    tencent: {
      secretId: '',
      secretKey: '',
      region: 'ap-beijing',
      baseUrl: 'https://tmt.tencentcloudapi.com',
      timeoutMs: 20000
    },
    tongyi: {
      apiKey: '',
      model: 'qwen-plus',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      systemPrompt: defaultSystemPrompt,
      userPromptTemplate: defaultUserPromptTemplate,
      timeoutMs: 20000
    },
    custom: {
      apiKey: '',
      model: 'gpt-4.1-mini',
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      requestFormat: 'openai-chat',
      systemPrompt: defaultSystemPrompt,
      userPromptTemplate: defaultUserPromptTemplate,
      timeoutMs: 20000
    }
  }
};

export const DEFAULT_SETTINGS = defaultTranslationClientSettings;
