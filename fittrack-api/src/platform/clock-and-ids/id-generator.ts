import { randomBytes } from 'node:crypto';
import type { Clock } from './clock.js';

/** Porta de geração de identificadores. Ninguém fora daqui gera UUID direto. */
export interface IdGenerator {
  next(): string;
}

export const ID_GENERATOR = Symbol('ID_GENERATOR');

export type RandomSource = (size: number) => Uint8Array;

/**
 * UUID v7 (RFC 9562): 48 bits de timestamp em ms, versão 7, variante 10 e 74 bits aleatórios.
 * Ordenável por tempo, o que favorece índices B-tree. O tempo vem do Clock injetado.
 */
export class UuidV7Generator implements IdGenerator {
  constructor(
    private readonly clock: Clock,
    private readonly random: RandomSource = randomBytes,
  ) {}

  next(): string {
    const bytes = new Uint8Array(16);
    bytes.set(this.random(16).subarray(0, 16));

    const ms = BigInt(this.clock.now().getTime());
    for (let i = 0; i < 6; i++) {
      bytes[i] = Number((ms >> BigInt(8 * (5 - i))) & 0xffn);
    }
    bytes[6] = (bytes[6]! & 0x0f) | 0x70; // versão 7
    bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variante RFC 9562

    const hex = Buffer.from(bytes).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
}

/** Gerador previsível para testes: devolve os ids na ordem dada. */
export class SequentialIdGenerator implements IdGenerator {
  private index = 0;

  constructor(private readonly ids: string[]) {}

  next(): string {
    const id = this.ids[this.index++];
    if (id === undefined) throw new Error('SequentialIdGenerator: ids esgotados');
    return id;
  }
}
