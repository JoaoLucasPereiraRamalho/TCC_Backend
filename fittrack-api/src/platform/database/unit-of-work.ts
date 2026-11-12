import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';

/** Contexto transacional repassado aos repositórios. Eles nunca abrem transação sozinhos. */
export type TransactionContext = Prisma.TransactionClient;

/**
 * Transações só abrem no caso de uso (ou no service, nos módulos de nível A):
 *
 *   await this.uow.run(async (tx) => {
 *     const session = await this.sessions.findById(tx, id);
 *     ...
 *   });
 */
@Injectable()
export class UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(work: (tx: TransactionContext) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
