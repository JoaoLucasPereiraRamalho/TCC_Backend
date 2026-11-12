import type { IncomingMessage, ServerResponse } from 'node:http';
import { SequentialIdGenerator } from '../../clock-and-ids/index.js';
import { resolveRequestId } from '../request-id.js';

function fakeHttp(headers: Record<string, string>) {
  const setHeader = vi.fn();
  return {
    req: { headers } as unknown as IncomingMessage,
    res: { setHeader } as unknown as ServerResponse,
    setHeader,
  };
}

describe('resolveRequestId', () => {
  it('reaproveita um X-Request-Id válido do cliente', () => {
    const { req, res, setHeader } = fakeHttp({ 'x-request-id': 'abc-12345678' });
    expect(resolveRequestId(req, res, new SequentialIdGenerator(['gerado']))).toBe('abc-12345678');
    expect(setHeader).toHaveBeenCalledWith('X-Request-Id', 'abc-12345678');
  });

  it('gera um novo quando o cabeçalho falta ou é inseguro', () => {
    const ids = new SequentialIdGenerator(['id-gerado-1', 'id-gerado-2']);
    const missing = fakeHttp({});
    expect(resolveRequestId(missing.req, missing.res, ids)).toBe('id-gerado-1');
    const injected = fakeHttp({ 'x-request-id': 'x\n{"forjado":true}' });
    expect(resolveRequestId(injected.req, injected.res, ids)).toBe('id-gerado-2');
  });
});
