import { z } from 'zod';

/** Payload pra endpoints de bulk-delete: { ids: string[] } (mínimo 1). */
export const BulkDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
});

export type BulkDelete = z.infer<typeof BulkDeleteSchema>;
