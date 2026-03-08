import { createHmac, createHash } from 'node:crypto';

import {
  createProviderAuthError,
  createProviderNetworkError,
  createProviderResponseError
} from './provider-errors';
import type { TranslationProvider } from './types';

interface CreateTencentProviderOptions {
  now?: () => Date;
}

interface TencentTranslateResponse {
  Response?: {
    TargetText?: string;
  };
}

function hashSha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function hmacSha256(key: Buffer | string, content: string, encoding?: 'hex'): Buffer | string {
  const hmac = createHmac('sha256', key).update(content);

  return encoding === 'hex' ? hmac.digest('hex') : hmac.digest();
}

function mapTencentLanguage(language: string): string {
  switch (language) {
    case 'zh-CN':
      return 'zh';
    default:
      return language;
  }
}

export function createTencentProvider(
  options: CreateTencentProviderOptions = {}
): TranslationProvider<'tencent'> {
  return {
    id: 'tencent',
    async translate(context) {
      const now = options.now?.() ?? new Date();
      const timestamp = Math.floor(now.getTime() / 1000);
      const date = now.toISOString().slice(0, 10);
      const service = 'tmt';
      const host = new URL(context.providerSettings.baseUrl).host;
      const action = 'TextTranslate';
      const version = '2018-03-21';
      const body = JSON.stringify({
        SourceText: context.text,
        Source: mapTencentLanguage(context.sourceLanguage),
        Target: mapTencentLanguage(context.targetLanguage),
        ProjectId: 0
      });

      const canonicalRequest = [
        'POST',
        '/',
        '',
        [
          'content-type:application/json; charset=utf-8',
          `host:${host}`,
          `x-tc-action:${action.toLowerCase()}`
        ].join('\n') + '\n',
        'content-type;host;x-tc-action',
        hashSha256(body)
      ].join('\n');

      const credentialScope = `${date}/${service}/tc3_request`;
      const stringToSign = [
        'TC3-HMAC-SHA256',
        String(timestamp),
        credentialScope,
        hashSha256(canonicalRequest)
      ].join('\n');

      const secretDate = hmacSha256(`TC3${context.providerSettings.secretKey}`, date) as Buffer;
      const secretService = hmacSha256(secretDate, service) as Buffer;
      const secretSigning = hmacSha256(secretService, 'tc3_request') as Buffer;
      const signature = hmacSha256(secretSigning, stringToSign, 'hex') as string;
      const authorization =
        `TC3-HMAC-SHA256 Credential=${context.providerSettings.secretId}/${credentialScope}, ` +
        `SignedHeaders=content-type;host;x-tc-action, Signature=${signature}`;

      try {
        const response = await context.fetch(context.providerSettings.baseUrl, {
          method: 'POST',
          headers: {
            Authorization: authorization,
            'Content-Type': 'application/json; charset=utf-8',
            Host: host,
            'X-TC-Action': action,
            'X-TC-Timestamp': String(timestamp),
            'X-TC-Version': version,
            'X-TC-Region': context.providerSettings.region
          },
          body,
          signal: context.signal
        });

        if (!response.ok) {
          const errorText = await response.text();

          if (response.status === 401 || response.status === 403) {
            throw createProviderAuthError(errorText || 'Tencent authentication failed.', {
              status: response.status
            });
          }

          throw createProviderResponseError(errorText || 'Tencent request failed.', {
            status: response.status
          });
        }

        const payload = (await response.json()) as TencentTranslateResponse;
        const text = payload.Response?.TargetText?.trim() ?? '';

        if (text.length === 0) {
          throw createProviderResponseError('Tencent returned an empty translation response.');
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

        throw createProviderNetworkError('Tencent translation failed due to a network error.', {
          cause: error
        });
      }
    }
  };
}
