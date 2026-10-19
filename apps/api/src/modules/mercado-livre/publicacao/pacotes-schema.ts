import { MercadoLivrePacoteSchema } from '@mahou-hub/contracts';
import { z } from 'zod';

export const PacotesEntradaSchema = z
  .object({
    modo: z.enum(['inspecionar_pacotes', 'corrigir_pacotes']),
    itens: z
      .array(
        z
          .object({
            produtoId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
            itemId: z.string().regex(/^MLB\d+$/),
            sku: z
              .string()
              .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
              .max(24),
            userProductId: z.string().regex(/^MLBU\d+$/),
            categoriaId: z.string().regex(/^MLB\d+$/),
            precoCentavos: z.number().int().positive(),
            pacote: MercadoLivrePacoteSchema.strict().refine(
              (pacote) =>
                [pacote.alturaCm, pacote.larguraCm, pacote.comprimentoCm].every(Number.isInteger),
              'O envio de SELLER_PACKAGE exige centímetros inteiros.',
            ),
          })
          .strict(),
      )
      .min(1)
      .max(14),
  })
  .strict()
  .refine(
    ({ itens }) =>
      ['itemId', 'sku', 'userProductId'].every(
        (campo) =>
          new Set(itens.map((item) => item[campo as keyof typeof item])).size === itens.length,
      ),
    'Anúncio, SKU e User Product devem ser únicos no lote.',
  );

export type PacoteItem = z.infer<typeof PacotesEntradaSchema>['itens'][number];
export interface ProdutoPacote {
  id: string;
  ativo: boolean;
  rascunho: boolean;
  precoCentavos: number;
  pesoG: number;
  mercadoLivre: unknown;
  variacoes: Array<{
    sku: string;
    ativo: boolean;
    precoCentavos: number | null;
    pesoG: number | null;
  }>;
}
export interface RepositorioPacotes {
  carregar(ids: string[]): Promise<ProdutoPacote[]>;
}
