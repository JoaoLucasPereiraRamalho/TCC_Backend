import { Test } from '@nestjs/testing';
import { CLOCK, FixedClock, type Clock } from '../clock.js';
import { ClockAndIdsModule } from '../clock-and-ids.module.js';
import { ID_GENERATOR, type IdGenerator } from '../id-generator.js';

describe('FixedClock', () => {
  it('devolve sempre o instante fixado', () => {
    const clock = new FixedClock('2026-11-12T14:03:22Z');
    expect(clock.now().toISOString()).toBe('2026-11-12T14:03:22.000Z');
    expect(clock.now().toISOString()).toBe('2026-11-12T14:03:22.000Z');
  });

  it('pode ser avançado e redefinido', () => {
    const clock = new FixedClock('2026-11-12T14:00:00Z');
    clock.advanceBy(15 * 60 * 1000);
    expect(clock.now().toISOString()).toBe('2026-11-12T14:15:00.000Z');
    clock.set('2026-11-16T00:05:00Z');
    expect(clock.now().toISOString()).toBe('2026-11-16T00:05:00.000Z');
  });

  it('não deixa quem chama alterar o instante interno', () => {
    const clock = new FixedClock('2026-11-12T14:00:00Z');
    clock.now().setFullYear(2000);
    expect(clock.now().getUTCFullYear()).toBe(2026);
  });

  it('substitui o relógio do sistema na injeção de dependências', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ClockAndIdsModule] })
      .overrideProvider(CLOCK)
      .useValue(new FixedClock('2026-01-01T00:00:00Z'))
      .compile();

    const clock = moduleRef.get<Clock>(CLOCK);
    const ids = moduleRef.get<IdGenerator>(ID_GENERATOR);
    expect(clock.now().toISOString()).toBe('2026-01-01T00:00:00.000Z');
    // O gerador de ids usa o mesmo relógio fixado: prefixo = timestamp de 2026-01-01.
    expect(ids.next().replace(/-/g, '').slice(0, 12)).toBe(
      new Date('2026-01-01T00:00:00Z').getTime().toString(16).padStart(12, '0'),
    );
  });
});
