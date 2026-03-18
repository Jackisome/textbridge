// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';

import { createMockProvider } from './mock-provider';

describe('createMockProvider', () => {
  describe('translate', () => {
    it('returns text with prefix prepended', async () => {
      const provider = createMockProvider();

      const result = await provider.translate({
        providerId: 'mock',
        text: 'Hello world',
        sourceLanguage: 'en',
        targetLanguage: 'zh-CN',
        providerSettings: {
          prefix: '[MOCK] ',
          latencyMs: 0
        },
        prompt: {
          user: 'Translate Hello world to zh-CN'
        },
        signal: new AbortController().signal,
        fetch: vi.fn()
      });

      expect(result.text).toBe('[MOCK] Hello world');
    });

    it('returns raw with providerId', async () => {
      const provider = createMockProvider();

      const result = await provider.translate({
        providerId: 'mock',
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'zh-CN',
        providerSettings: {
          prefix: '',
          latencyMs: 0
        },
        prompt: {
          user: 'Translate'
        },
        signal: new AbortController().signal,
        fetch: vi.fn()
      });

      expect(result.raw).toEqual({ providerId: 'mock' });
    });

    it('applies latencyMs delay', async () => {
      vi.useFakeTimers();

      const provider = createMockProvider();

      const translatePromise = provider.translate({
        providerId: 'mock',
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'zh-CN',
        providerSettings: {
          prefix: '',
          latencyMs: 1000
        },
        prompt: {
          user: 'Translate'
        },
        signal: new AbortController().signal,
        fetch: vi.fn()
      });

      // Should not resolve immediately after 500ms
      vi.advanceTimersByTime(500);
      const result500ms = await vi.waitFor(() => translatePromise, { timeout: 0 }).catch(() => null);
      expect(result500ms).toBeNull(); // Not resolved yet

      // Should resolve after full 1000ms
      vi.advanceTimersByTime(500);
      const result = await translatePromise;
      expect(result.text).toBe('Hello');

      vi.useRealTimers();
    });

    it('does not apply delay when latencyMs is 0', async () => {
      vi.useFakeTimers();

      const provider = createMockProvider();

      const before = Date.now();
      await provider.translate({
        providerId: 'mock',
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'zh-CN',
        providerSettings: {
          prefix: '',
          latencyMs: 0
        },
        prompt: {
          user: 'Translate'
        },
        signal: new AbortController().signal,
        fetch: vi.fn()
      });
      const after = Date.now();

      // Should complete almost instantly (within 10ms)
      expect(after - before).toBeLessThan(10);

      vi.useRealTimers();
    });

    it('rejects with abort reason when signal is aborted', async () => {
      vi.useFakeTimers();

      const provider = createMockProvider();
      const abortController = new AbortController();

      const translatePromise = provider.translate({
        providerId: 'mock',
        text: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'zh-CN',
        providerSettings: {
          prefix: '',
          latencyMs: 1000
        },
        prompt: {
          user: 'Translate'
        },
        signal: abortController.signal,
        fetch: vi.fn()
      });

      // Advance timer to start the delay
      vi.advanceTimersByTime(500);

      // Abort the request
      abortController.abort('User cancelled');

      await expect(translatePromise).rejects.toThrow('User cancelled');

      vi.useRealTimers();
    });

    it('works with empty prefix', async () => {
      const provider = createMockProvider();

      const result = await provider.translate({
        providerId: 'mock',
        text: 'Hello world',
        sourceLanguage: 'en',
        targetLanguage: 'zh-CN',
        providerSettings: {
          prefix: '',
          latencyMs: 0
        },
        prompt: {
          user: 'Translate'
        },
        signal: new AbortController().signal,
        fetch: vi.fn()
      });

      expect(result.text).toBe('Hello world');
    });

    it('works with special characters in prefix and text', async () => {
      const provider = createMockProvider();

      const result = await provider.translate({
        providerId: 'mock',
        text: '你好世界',
        sourceLanguage: 'zh',
        targetLanguage: 'en',
        providerSettings: {
          prefix: '[Mock]: ',
          latencyMs: 0
        },
        prompt: {
          user: 'Translate'
        },
        signal: new AbortController().signal,
        fetch: vi.fn()
      });

      expect(result.text).toBe('[Mock]: 你好世界');
    });
  });
});
