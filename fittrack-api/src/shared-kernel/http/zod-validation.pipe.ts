import { Injectable, type PipeTransform } from '@nestjs/common';
import type { z } from 'zod';

/**
 * Valida corpo, query ou params com um schema Zod. Em falha lança ZodError, que o filtro
 * global converte em 422 VALIDATION_ERROR com `details` por campo.
 *
 *   @Body(new ZodValidationPipe(createInviteSchema)) body: CreateInviteInput
 */
@Injectable()
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    return this.schema.parse(value);
  }
}
