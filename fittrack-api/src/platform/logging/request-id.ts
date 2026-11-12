import type { IncomingMessage, ServerResponse } from 'node:http';
import type { IdGenerator } from '../clock-and-ids/index.js';

export const REQUEST_ID_HEADER = 'x-request-id';
const VALID_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Reaproveita o X-Request-Id do cliente quando é seguro; senão gera um.
 * O mesmo valor volta no cabeçalho da resposta e em error.traceId.
 */
export function resolveRequestId(
  req: IncomingMessage,
  res: ServerResponse,
  ids: IdGenerator,
): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const requestId = candidate && VALID_REQUEST_ID.test(candidate) ? candidate : ids.next();
  res.setHeader('X-Request-Id', requestId);
  return requestId;
}
