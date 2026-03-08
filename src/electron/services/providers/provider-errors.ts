export type ProviderErrorCode =
  | 'PROVIDER_CONFIG_ERROR'
  | 'PROVIDER_AUTH_ERROR'
  | 'PROVIDER_NETWORK_ERROR'
  | 'PROVIDER_RESPONSE_ERROR';

interface ProviderErrorOptions {
  cause?: unknown;
  status?: number;
}

class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly status?: number;

  constructor(
    name: string,
    code: ProviderErrorCode,
    message: string,
    options: ProviderErrorOptions = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = name;
    this.code = code;
    this.status = options.status;
  }
}

export class ProviderConfigError extends ProviderError {
  constructor(message: string, options: ProviderErrorOptions = {}) {
    super('ProviderConfigError', 'PROVIDER_CONFIG_ERROR', message, options);
  }
}

export class ProviderAuthError extends ProviderError {
  constructor(message: string, options: ProviderErrorOptions = {}) {
    super('ProviderAuthError', 'PROVIDER_AUTH_ERROR', message, options);
  }
}

export class ProviderNetworkError extends ProviderError {
  constructor(message: string, options: ProviderErrorOptions = {}) {
    super('ProviderNetworkError', 'PROVIDER_NETWORK_ERROR', message, options);
  }
}

export class ProviderResponseError extends ProviderError {
  constructor(message: string, options: ProviderErrorOptions = {}) {
    super('ProviderResponseError', 'PROVIDER_RESPONSE_ERROR', message, options);
  }
}

export function createProviderConfigError(
  message: string,
  options: ProviderErrorOptions = {}
): ProviderConfigError {
  return new ProviderConfigError(message, options);
}

export function createProviderAuthError(
  message: string,
  options: ProviderErrorOptions = {}
): ProviderAuthError {
  return new ProviderAuthError(message, options);
}

export function createProviderNetworkError(
  message: string,
  options: ProviderErrorOptions = {}
): ProviderNetworkError {
  return new ProviderNetworkError(message, options);
}

export function createProviderResponseError(
  message: string,
  options: ProviderErrorOptions = {}
): ProviderResponseError {
  return new ProviderResponseError(message, options);
}
