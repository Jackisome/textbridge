const HELPER_REQUEST_KIND_VALUES = [
  'health-check',
  'capture-text',
  'write-text',
  'clipboard-write',
  'capture-selection-context',
  'restore-target'
] as const;

export type HelperRequestKind = (typeof HELPER_REQUEST_KIND_VALUES)[number];

export interface HelperError {
  code: string;
  message: string;
}

export interface HelperRequest<
  TPayload = Record<string, unknown>,
  TKind extends HelperRequestKind = HelperRequestKind
> {
  id: string;
  kind: TKind;
  timestamp: string;
  payload: TPayload;
}

export interface HelperResponse<
  TPayload = Record<string, unknown>,
  TKind extends HelperRequestKind = HelperRequestKind
> {
  id: string;
  kind: TKind;
  ok: boolean;
  payload: TPayload;
  error: HelperError | null;
}

const HELPER_REQUEST_KINDS = new Set<HelperRequestKind>(HELPER_REQUEST_KIND_VALUES);

let nextRequestSequence = 0;

export function toHelperRequest<
  TPayload,
  TKind extends HelperRequestKind
>(kind: TKind, payload: TPayload): HelperRequest<TPayload, TKind> {
  nextRequestSequence += 1;

  return {
    id: `req-${Date.now()}-${nextRequestSequence}`,
    kind,
    timestamp: new Date().toISOString(),
    payload
  };
}

export function isHelperResponse(value: unknown): value is HelperResponse {
  if (!isRecord(value)) {
    return false;
  }

  if (
    typeof value.id !== 'string' ||
    !isHelperRequestKind(value.kind) ||
    typeof value.ok !== 'boolean' ||
    !('payload' in value) ||
    !isHelperPayload(value.payload) ||
    !('error' in value)
  ) {
    return false;
  }

  if (value.ok) {
    return value.error === null;
  }

  return isHelperError(value.error);
}

function isHelperRequestKind(value: unknown): value is HelperRequestKind {
  return typeof value === 'string' && HELPER_REQUEST_KINDS.has(value as HelperRequestKind);
}

function isHelperError(value: unknown): value is HelperError {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  );
}

function isHelperPayload(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
