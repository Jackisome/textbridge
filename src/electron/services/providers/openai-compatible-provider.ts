import {
  createProviderAuthError,
  createProviderNetworkError,
  createProviderResponseError
} from './provider-errors';
import type { ProviderTranslationResult } from './types';

type OpenAiMessage = {
  role: 'system' | 'user';
  content: string;
};

export interface OpenAiCompatibleApiOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  systemPrompt?: string;
  userPrompt: string;
  signal: AbortSignal;
  fetch: typeof globalThis.fetch;
  temperature?: number;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

interface OpenAiCompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

function buildMessages(options: OpenAiCompatibleApiOptions): OpenAiMessage[] {
  const messages: OpenAiMessage[] = [];

  if (options.systemPrompt !== undefined && options.systemPrompt.trim().length > 0) {
    messages.push({
      role: 'system',
      content: options.systemPrompt
    });
  }

  messages.push({
    role: 'user',
    content: options.userPrompt
  });

  return messages;
}

function extractMessageText(
  content: string | Array<{ type?: string; text?: string }> | undefined
): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();
  }

  return '';
}

export async function translateWithOpenAiCompatibleApi(
  options: OpenAiCompatibleApiOptions
): Promise<ProviderTranslationResult> {
  try {
    const response = await options.fetch(options.baseUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${options.apiKey}`,
        ...options.headers
      },
      body: JSON.stringify({
        model: options.model,
        messages: buildMessages(options),
        ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
        ...options.body
      }),
      signal: options.signal
    });

    if (!response.ok) {
      const errorText = await response.text();

      if (response.status === 401 || response.status === 403) {
        throw createProviderAuthError(errorText || 'Provider authentication failed.', {
          status: response.status
        });
      }

      throw createProviderResponseError(errorText || 'Provider request failed.', {
        status: response.status
      });
    }

    const payload = (await response.json()) as OpenAiCompatibleResponse;
    const text = extractMessageText(payload.choices?.[0]?.message?.content);

    if (text.length === 0) {
      throw createProviderResponseError('Provider returned an empty translation response.');
    }

    return {
      text,
      raw: payload
    };
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
    ) {
      throw error;
    }

    throw createProviderNetworkError('Provider request failed due to a network error.', {
      cause: error
    });
  }
}
