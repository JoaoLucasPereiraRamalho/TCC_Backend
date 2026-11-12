import type { ErrorCode } from './error-codes.js';
import type { ErrorDetail } from './domain-error.js';

/** Formato único de falha da API (Especificação da API, seção 2). */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
    traceId: string;
  };
}
