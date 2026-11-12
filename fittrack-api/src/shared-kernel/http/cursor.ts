import { z } from 'zod';
import { ValidationError } from '../errors/index.js';
import { paged, type PageEnvelope } from './envelope.js';

/**
 * Paginação por cursor. O cursor é opaco para o cliente (base64url de um JSON);
 * cada consulta define o que vai dentro (normalmente a chave de ordenação e o id).
 */
export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 100;

export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(DEFAULT_PAGE_LIMIT),
  cursor: z.string().min(1).optional(),
});

export type PageQuery = z.infer<typeof pageQuerySchema>;

export function encodeCursor(position: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(position), 'utf8').toString('base64url');
}

export function decodeCursor<T>(cursor: string, schema: z.ZodType<T>): T {
  const invalid = () =>
    new ValidationError([{ field: 'cursor', rule: 'cursor', message: 'Cursor inválido.' }]);
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw invalid();
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw invalid();
  return parsed.data;
}

/**
 * Monta a página a partir de `limit + 1` linhas lidas do banco: a linha extra só indica
 * que existe próxima página e não é devolvida.
 */
export function buildPage<Row, Item>(
  rows: Row[],
  limit: number,
  toItem: (row: Row) => Item,
  toCursor: (row: Row) => Record<string, unknown>,
): PageEnvelope<Item> {
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const last = visible.at(-1);
  return paged(visible.map(toItem), {
    limit,
    hasMore,
    nextCursor: hasMore && last !== undefined ? encodeCursor(toCursor(last)) : null,
  });
}
