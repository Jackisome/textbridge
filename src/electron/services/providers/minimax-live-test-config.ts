export interface MiniMaxLiveTestConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  sourceLanguage: string;
  targetLanguage: string;
  text: string;
}

export function loadMiniMaxLiveTestConfig(): MiniMaxLiveTestConfig | null {
  const apiKey = process.env.MINIMAX_API_KEY?.trim() ?? '';

  if (apiKey.length === 0) {
    return null;
  }

  return {
    apiKey,
    baseUrl:
      process.env.MINIMAX_BASE_URL?.trim() ?? 'https://api.minimaxi.com/v1/text/chatcompletion_v2',
    model: process.env.MINIMAX_MODEL?.trim() ?? 'MiniMax-Text-01',
    sourceLanguage: process.env.MINIMAX_SOURCE_LANGUAGE?.trim() ?? 'auto',
    targetLanguage: process.env.MINIMAX_TARGET_LANGUAGE?.trim() ?? 'zh-CN',
    text: process.env.MINIMAX_TEST_TEXT?.trim() ?? 'Hello world'
  };
}
