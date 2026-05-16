import { z } from 'zod';
import { IdeiaStatusEnum } from './enums';

export const IdeiaSchema = z.object({
  id: z.string(),
  titulo: z.string().min(1),
  descricao: z.string().nullable(),
  status: IdeiaStatusEnum,
  referencia: z.string().nullable(),
  criadaEm: z.string().datetime(),
});

export const IdeiaCreateSchema = IdeiaSchema.omit({ id: true, criadaEm: true });

export const ConteudoSchema = z.object({
  id: z.string(),
  titulo: z.string().min(1),
  url: z.string().url(),
  descricao: z.string().nullable(),
  tags: z.array(z.string()),
});

export const ConteudoCreateSchema = ConteudoSchema.omit({ id: true });

export type Ideia = z.infer<typeof IdeiaSchema>;
export type IdeiaCreate = z.infer<typeof IdeiaCreateSchema>;
export type Conteudo = z.infer<typeof ConteudoSchema>;
export type ConteudoCreate = z.infer<typeof ConteudoCreateSchema>;
