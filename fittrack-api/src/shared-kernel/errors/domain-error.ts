import { ERROR_CATALOG, type ErrorCode, type ErrorKind } from './error-codes.js';

export type ErrorDetail = Record<string, unknown>;

/**
 * Base de todos os erros de regra de negócio. Os módulos criam subclasses
 * (ex.: `class ActiveSessionExists extends DomainError`) e o filtro global converte
 * no formato de erro da API. Não depende de NestJS: pode ser lançado do domain/.
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details?: ErrorDetail[];

  constructor(code: ErrorCode, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }

  get kind(): ErrorKind {
    return ERROR_CATALOG[this.code].kind;
  }

  get httpStatus(): number {
    return ERROR_CATALOG[this.code].status;
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Recurso não encontrado.') {
    super('NOT_FOUND', message);
  }
}

export class ValidationError extends DomainError {
  constructor(
    details: { field: string; rule: string; message: string }[],
    message = 'Dados inválidos.',
  ) {
    super('VALIDATION_ERROR', message, details);
  }
}
