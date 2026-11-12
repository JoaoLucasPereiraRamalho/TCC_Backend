import { z } from 'zod';
import { ValidationError } from '../../errors/index.js';
import { buildPage, decodeCursor, encodeCursor, pageQuerySchema } from '../cursor.js';
import { ok } from '../envelope.js';

const positionSchema = z.object({ finishedAt: z.string(), id: z.string() });

describe('cursor', () => {
  it('ida e volta preserva a posição', () => {
    const position = { finishedAt: '2026-11-12T20:58:10Z', id: '0193b000' };
    expect(decodeCursor(encodeCursor(position), positionSchema)).toEqual(position);
  });

  it('cursor adulterado vira 422 VALIDATION_ERROR', () => {
    expect(() => decodeCursor('isto-nao-e-json', positionSchema)).toThrow(ValidationError);
    expect(() => decodeCursor(encodeCursor({ outro: 1 }), positionSchema)).toThrow(ValidationError);
  });
});

describe('pageQuerySchema', () => {
  it('usa limit 20 por padrão e recusa acima de 100', () => {
    expect(pageQuerySchema.parse({})).toEqual({ limit: 20 });
    expect(pageQuerySchema.parse({ limit: '50' }).limit).toBe(50);
    expect(pageQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
  });
});

describe('buildPage', () => {
  const rows = [1, 2, 3].map((n) => ({ id: `id-${n}`, finishedAt: `t${n}` }));

  it('com linha extra: hasMore e cursor apontando para o último visível', () => {
    const page = buildPage(
      rows,
      2,
      (r) => r.id,
      (r) => ({ finishedAt: r.finishedAt, id: r.id }),
    );
    expect(page.data).toEqual(['id-1', 'id-2']);
    expect(page.page.hasMore).toBe(true);
    expect(decodeCursor(page.page.nextCursor!, positionSchema)).toEqual({
      finishedAt: 't2',
      id: 'id-2',
    });
  });

  it('última página: sem cursor', () => {
    const page = buildPage(
      rows,
      5,
      (r) => r.id,
      (r) => ({ id: r.id }),
    );
    expect(page.page).toEqual({ limit: 5, hasMore: false, nextCursor: null });
  });
});

describe('ok', () => {
  it('envelopa em { data }', () => {
    expect(ok({ id: '1' })).toEqual({ data: { id: '1' } });
  });
});
