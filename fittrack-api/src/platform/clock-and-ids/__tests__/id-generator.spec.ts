import { FixedClock } from '../clock.js';
import { SequentialIdGenerator, UuidV7Generator } from '../id-generator.js';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('UuidV7Generator', () => {
  it('gera UUID v7 válido com versão e variante corretas', () => {
    const generator = new UuidV7Generator(new FixedClock('2026-11-12T14:03:22Z'));
    for (let i = 0; i < 100; i++) expect(generator.next()).toMatch(UUID_V7);
  });

  it('codifica o instante do Clock nos 48 primeiros bits', () => {
    const instant = new Date('2026-11-12T14:03:22.123Z');
    const id = new UuidV7Generator(new FixedClock(instant)).next();
    const ms = parseInt(id.replace(/-/g, '').slice(0, 12), 16);
    expect(ms).toBe(instant.getTime());
  });

  it('é determinístico com fonte aleatória fixa', () => {
    const zeros = (size: number) => new Uint8Array(size);
    const generator = new UuidV7Generator(new FixedClock(new Date(0)), zeros);
    expect(generator.next()).toBe('00000000-0000-7000-8000-000000000000');
  });

  it('ordena por tempo quando o relógio avança', () => {
    const clock = new FixedClock('2026-11-12T14:00:00Z');
    const generator = new UuidV7Generator(clock);
    const first = generator.next();
    clock.advanceBy(1);
    const second = generator.next();
    expect(first < second).toBe(true);
  });

  it('não repete ids no mesmo milissegundo', () => {
    const generator = new UuidV7Generator(new FixedClock('2026-11-12T14:00:00Z'));
    const ids = new Set(Array.from({ length: 1000 }, () => generator.next()));
    expect(ids.size).toBe(1000);
  });
});

describe('SequentialIdGenerator', () => {
  it('devolve os ids na ordem e falha quando acabam', () => {
    const generator = new SequentialIdGenerator(['a', 'b']);
    expect(generator.next()).toBe('a');
    expect(generator.next()).toBe('b');
    expect(() => generator.next()).toThrow(/esgotados/);
  });
});
