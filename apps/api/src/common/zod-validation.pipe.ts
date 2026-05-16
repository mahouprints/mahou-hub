import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Pipe que valida o body/query/params com um Zod schema do @mahou-hub/contracts.
 * Falha rapidamente com 400 + lista de erros legíveis.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Payload inválido',
        issues: result.error.issues,
      });
    }
    return result.data;
  }
}
