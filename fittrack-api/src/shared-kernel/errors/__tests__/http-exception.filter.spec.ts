import { BadRequestException, NotFoundException, type ArgumentsHost } from '@nestjs/common';
import { z } from 'zod';
import { DomainError, NotFoundError } from '../domain-error.js';
import { HttpExceptionFilter, toApiError } from '../http-exception.filter.js';

class ActiveSessionExists extends DomainError {
  constructor() {
    super('ACTIVE_SESSION_EXISTS', 'Já existe uma sessão ativa.');
  }
}

describe('toApiError', () => {
  it('usa o código e o status do catálogo para DomainError', () => {
    const error = new ActiveSessionExists();
    expect(error.kind).toBe('CONFLICT');
    expect(error.name).toBe('ActiveSessionExists');
    expect(toApiError(error)).toEqual({
      status: 409,
      body: {
        code: 'ACTIVE_SESSION_EXISTS',
        message: 'Já existe uma sessão ativa.',
        details: undefined,
      },
    });
  });

  it('mantém details do erro (ex.: EXERCISE_IN_USE)', () => {
    const details = [{ mesocycleId: 'm1', mesocycleName: 'Hipertrofia', studentName: 'Carlos' }];
    const { status, body } = toApiError(new DomainError('EXERCISE_IN_USE', 'Em uso.', details));
    expect(status).toBe(409);
    expect(body.details).toEqual(details);
  });

  it('converte ZodError em 422 VALIDATION_ERROR com o caminho do campo', () => {
    const schema = z.object({ sets: z.array(z.object({ reps: z.number().max(100) })) });
    const result = schema.safeParse({ sets: [{ reps: 101 }] });
    if (result.success) throw new Error('deveria falhar');
    const { status, body } = toApiError(result.error);
    expect(status).toBe(422);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.details).toEqual([
      expect.objectContaining({ field: 'sets[0].reps', rule: 'too_big' }),
    ]);
  });

  it('mapeia exceções HTTP do Nest para códigos do catálogo', () => {
    expect(toApiError(new NotFoundException()).body.code).toBe('NOT_FOUND');
    expect(toApiError(new BadRequestException()).body.code).toBe('MALFORMED_REQUEST');
  });

  it('esconde o detalhe de falhas inesperadas', () => {
    expect(toApiError(new Error('senha do banco: 123'))).toEqual({
      status: 500,
      body: { code: 'INTERNAL_ERROR', message: 'Erro interno.' },
    });
  });
});

describe('HttpExceptionFilter', () => {
  function run(exception: unknown) {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({ id: 'req-12345678' }),
        getResponse: () => ({ status, getHeader: () => undefined }),
      }),
    } as unknown as ArgumentsHost;
    new HttpExceptionFilter().catch(exception, host);
    return { status, json };
  }

  it('responde no formato de erro da API com traceId e sem details vazio', () => {
    const { status, json } = run(new NotFoundError());
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'NOT_FOUND', message: 'Recurso não encontrado.', traceId: 'req-12345678' },
    });
  });
});
