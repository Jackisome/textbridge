import type { ProviderCategory, ProviderId } from '../types/provider';

export interface ProviderMetadata {
  id: ProviderId;
  label: string;
  category: ProviderCategory;
  description: string;
}

export const providerMetadata: Record<ProviderId, ProviderMetadata> = {
  mock: {
    id: 'mock',
    label: 'Mock',
    category: 'debug',
    description: '用于本地联调与稳定测试输出。'
  },
  claude: {
    id: 'claude',
    label: 'Claude',
    category: 'llm',
    description: 'Anthropic Claude 系列模型。'
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    category: 'llm',
    description: '兼容 OpenAI Chat Completions 的 DeepSeek 接口。'
  },
  minimax: {
    id: 'minimax',
    label: 'MiniMax',
    category: 'llm',
    description: 'MiniMax 文本翻译与生成接口。'
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    category: 'llm',
    description: 'Google Gemini generateContent 接口。'
  },
  google: {
    id: 'google',
    label: 'Google',
    category: 'machine-translation',
    description: 'Google 机器翻译接口。'
  },
  tencent: {
    id: 'tencent',
    label: '腾讯云',
    category: 'machine-translation',
    description: '腾讯云机器翻译 TextTranslate 接口。'
  },
  tongyi: {
    id: 'tongyi',
    label: '通义千问',
    category: 'llm',
    description: '阿里云通义千问与翻译模型。'
  },
  custom: {
    id: 'custom',
    label: 'Custom',
    category: 'llm',
    description: '自定义 OpenAI 兼容翻译入口。'
  }
};

export const providerMetadataList = Object.values(providerMetadata);
