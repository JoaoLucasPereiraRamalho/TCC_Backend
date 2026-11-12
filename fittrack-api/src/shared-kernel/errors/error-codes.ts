/** Catálogo de erros da API (Especificação da API, seção 10). `code` é estável; o cliente decide por ele. */
export type ErrorKind =
  | 'MALFORMED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'GONE'
  | 'PAYLOAD'
  | 'VALIDATION'
  | 'LOCKED'
  | 'UPGRADE_REQUIRED'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'UNAVAILABLE';

interface ErrorDefinition {
  status: number;
  kind: ErrorKind;
}

export const ERROR_CATALOG = {
  MALFORMED_REQUEST: { status: 400, kind: 'MALFORMED' },
  UNAUTHENTICATED: { status: 401, kind: 'UNAUTHENTICATED' },
  TOKEN_EXPIRED: { status: 401, kind: 'UNAUTHENTICATED' },
  INVALID_CREDENTIALS: { status: 401, kind: 'UNAUTHENTICATED' },
  REFRESH_REUSED: { status: 401, kind: 'UNAUTHENTICATED' },
  FORBIDDEN: { status: 403, kind: 'FORBIDDEN' },
  EMAIL_NOT_VERIFIED: { status: 403, kind: 'FORBIDDEN' },
  NOT_FOUND: { status: 404, kind: 'NOT_FOUND' },
  IDEMPOTENCY_CONFLICT: { status: 409, kind: 'CONFLICT' },
  ALREADY_LINKED: { status: 409, kind: 'CONFLICT' },
  LINK_NOT_ACTIVE: { status: 409, kind: 'CONFLICT' },
  INVITE_USED: { status: 409, kind: 'CONFLICT' },
  EXERCISE_IN_USE: { status: 409, kind: 'CONFLICT' },
  EXERCISE_NAME_TAKEN: { status: 409, kind: 'CONFLICT' },
  ACTIVE_SESSION_EXISTS: { status: 409, kind: 'CONFLICT' },
  SESSION_EDIT_WINDOW_EXPIRED: { status: 409, kind: 'CONFLICT' },
  MESOCYCLE_NOT_EDITABLE: { status: 409, kind: 'CONFLICT' },
  INVITE_EXPIRED: { status: 410, kind: 'GONE' },
  INVITE_REVOKED: { status: 410, kind: 'GONE' },
  FILE_TOO_LARGE: { status: 413, kind: 'PAYLOAD' },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, kind: 'PAYLOAD' },
  VALIDATION_ERROR: { status: 422, kind: 'VALIDATION' },
  ACCOUNT_LOCKED: { status: 423, kind: 'LOCKED' },
  UPDATE_REQUIRED: { status: 426, kind: 'UPGRADE_REQUIRED' },
  RATE_LIMITED: { status: 429, kind: 'RATE_LIMITED' },
  INTERNAL_ERROR: { status: 500, kind: 'INTERNAL' },
  SERVICE_UNAVAILABLE: { status: 503, kind: 'UNAVAILABLE' },
} as const satisfies Record<string, ErrorDefinition>;

export type ErrorCode = keyof typeof ERROR_CATALOG;
