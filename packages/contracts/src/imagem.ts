import { z } from 'zod';

export const OrigemImagemEnum = z.enum(['INSPIRACAO', 'MODELO_3D', 'GERADA', 'OUTRA']);

export const ProdutoImagemSchema = z.object({
  id: z.string(),
  produtoId: z.string(),
  /** URL absoluta servida pelo Nginx em prod (media.mahouprints.com) ou pelo Nest em dev. */
  url: z.string(),
  origem: OrigemImagemEnum,
  ordem: z.number().int(),
  larguraPx: z.number().int().nullable(),
  alturaPx: z.number().int().nullable(),
  bytes: z.number().int().nullable(),
  criadoEm: z.coerce.date(),
});

/** Update somente de metadados. Trocar o arquivo = delete + upload. */
export const ProdutoImagemUpdateSchema = z.object({
  origem: OrigemImagemEnum.optional(),
  ordem: z.number().int().optional(),
});

export type OrigemImagem = z.infer<typeof OrigemImagemEnum>;
export type ProdutoImagem = z.infer<typeof ProdutoImagemSchema>;
export type ProdutoImagemUpdate = z.infer<typeof ProdutoImagemUpdateSchema>;
