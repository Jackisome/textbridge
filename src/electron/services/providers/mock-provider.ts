import type { TranslationProvider } from './types';

export function createMockProvider(): TranslationProvider<'mock'> {
  return {
    id: 'mock',
    async translate(context) {
      const { latencyMs, prefix } = context.providerSettings;

      if (latencyMs > 0) {
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(resolve, latencyMs);

          context.signal.addEventListener(
            'abort',
            () => {
              clearTimeout(timeoutId);
              reject(context.signal.reason ?? new Error('Mock translation aborted'));
            },
            { once: true }
          );
        });
      }

      return {
        text: `${prefix}${context.text}`,
        raw: {
          providerId: 'mock'
        }
      };
    }
  };
}
