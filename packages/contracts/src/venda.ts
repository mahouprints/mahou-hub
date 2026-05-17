import { z } from 'zod';
import { CanalEnum } from './enums';

export const VendaSchema = z.object({
  id: z.string(),
  produtoId: z.string(),
  qtd: z.number().int().positive(),
  precoUnitarioCentavos: z.number().int().positive(),
  canal: CanalEnum,
  dataVenda: z.coerce.date(),
  observacao: z.string().nullable(),
});

export const VendaCreateSchema = VendaSchema.omit({ id: true });
export const VendaUpdateSchema = VendaCreateSchema.partial();

export type Venda = z.infer<typeof VendaSchema>;
export type VendaCreate = z.infer<typeof VendaCreateSchema>;
export type VendaUpdate = z.infer<typeof VendaUpdateSchema>;
