import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import type { ApiErrorBody } from './api-error-body.js';
import { DomainError } from './domain-error.js';
import type { ErrorCode } from './error-codes.js';

const HTTP_STATUS_TO_CODE: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'MALFORMED_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'FILE_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

interface Converted {
  status: number;
  body: Omit<ApiErrorBody['error'], 'traceId'>;
}

/** Converte qualquer exceção para o formato de erro da API, com o traceId da requisição. */
export function toApiError(exception: unknown): Converted {
  if (exception instanceof DomainError) {
    return {
      status: exception.httpStatus,
      body: { code: exception.code, message: exception.message, details: exception.details },
    };
  }

  if (exception instanceof ZodError) {
    return {
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      body: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        details: exception.issues.map((issue) => ({
          field: formatPath(issue.path),
          rule: issue.code,
          message: issue.message,
        })),
      },
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code =
      HTTP_STATUS_TO_CODE[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'MALFORMED_REQUEST');
    return { status, body: { code, message: status >= 500 ? 'Erro interno.' : exception.message } };
  }

  return {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    body: { code: 'INTERNAL_ERROR', message: 'Erro interno.' },
  };
}

/** `sets[0].reps` a partir de ['sets', 0, 'reps']. */
function formatPath(path: PropertyKey[]): string {
  return path.reduce<string>((acc, key) => {
    if (typeof key === 'number') return `${acc}[${key}]`;
    return acc ? `${acc}.${String(key)}` : String(key);
  }, '');
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: unknown }>();
    const res = http.getResponse<Response>();
    const { status, body } = toApiError(exception);

    // Detalhe de falhas inesperadas vai só para o log (e Sentry), nunca para a resposta.
    if (status >= 500) this.logger.error(exception);

    const traceId =
      typeof req.id === 'string' ? req.id : String(res.getHeader('X-Request-Id') ?? '');
    const payload: ApiErrorBody = { error: { ...body, traceId } };
    if (!payload.error.details?.length) delete payload.error.details;
    res.status(status).json(payload);
  }
}
