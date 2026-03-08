export const providerIds = [
  'mock',
  'claude',
  'deepseek',
  'minimax',
  'gemini',
  'google',
  'tencent',
  'tongyi',
  'custom'
] as const;

export type ProviderId = (typeof providerIds)[number];

export type ProviderCategory = 'llm' | 'machine-translation' | 'debug';

export type CustomProviderRequestFormat = 'openai-chat';

interface TimeoutProviderSettings {
  timeoutMs: number;
}

interface PromptTemplateProviderSettings extends TimeoutProviderSettings {
  apiKey: string;
  model: string;
  baseUrl: string;
  systemPrompt: string;
  userPromptTemplate: string;
}

export interface ClaudeProviderSettings extends PromptTemplateProviderSettings {}

export interface DeepseekProviderSettings extends PromptTemplateProviderSettings {}

export interface MinimaxProviderSettings extends PromptTemplateProviderSettings {}

export interface TongyiProviderSettings extends PromptTemplateProviderSettings {}

export interface GeminiProviderSettings extends TimeoutProviderSettings {
  apiKey: string;
  model: string;
  baseUrl: string;
  userPromptTemplate: string;
}

export interface GoogleProviderSettings extends TimeoutProviderSettings {
  baseUrl: string;
}

export interface TencentProviderSettings extends TimeoutProviderSettings {
  secretId: string;
  secretKey: string;
  region: string;
  baseUrl: string;
}

export interface CustomProviderSettings extends PromptTemplateProviderSettings {
  requestFormat: CustomProviderRequestFormat;
}

export interface MockProviderSettings {
  prefix: string;
  latencyMs: number;
}

export interface ProviderSettingsMap {
  mock: MockProviderSettings;
  claude: ClaudeProviderSettings;
  deepseek: DeepseekProviderSettings;
  minimax: MinimaxProviderSettings;
  gemini: GeminiProviderSettings;
  google: GoogleProviderSettings;
  tencent: TencentProviderSettings;
  tongyi: TongyiProviderSettings;
  custom: CustomProviderSettings;
}

export type ProviderSettings<Id extends ProviderId = ProviderId> = ProviderSettingsMap[Id];
