import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { Server } from 'node:http';
import { AppModule } from '../../src/app.module.js';
import { CLOCK, FixedClock } from '../../src/platform/clock-and-ids/index.js';
import { PrismaService } from '../../src/platform/database/index.js';

// Sobe o processo api de verdade (módulos, filtro global, logging), sem banco:
// o PrismaService é trocado por um dublê. Testes com Postgres real ficam em test/integration.
// As variáveis de ambiente vêm de test/setup-env.ts.

describe('processo api (HTTP)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer() as Server);
  const queryRaw = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({ $queryRaw: queryRaw, $connect: vi.fn(), $disconnect: vi.fn() })
      .overrideProvider(CLOCK)
      .useValue(new FixedClock('2026-11-12T14:03:22Z'))
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /v1/health responde 200 no envelope { data } com X-Request-Id', async () => {
    queryRaw.mockResolvedValueOnce([1]);
    const res = await http().get('/v1/health').expect(200);
    expect(res.body).toEqual({
      data: { status: 'up', checks: { database: 'up' }, checkedAt: '2026-11-12T14:03:22.000Z' },
    });
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('GET /v1/health responde 503 quando o banco cai', async () => {
    queryRaw.mockRejectedValueOnce(new Error('offline'));
    const res = await http().get('/v1/health').expect(503);
    expect(res.body.data.status).toBe('down');
  });

  it('rota inexistente usa o formato de erro da API com o mesmo traceId do cabeçalho', async () => {
    const res = await http()
      .get('/v1/nao-existe')
      .set('X-Request-Id', 'cliente-req-0001')
      .expect(404);
    expect(res.headers['x-request-id']).toBe('cliente-req-0001');
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String), traceId: 'cliente-req-0001' },
    });
  });
});
