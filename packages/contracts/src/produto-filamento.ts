import { z } from 'zod';

/** Consumo em gramas por unidade, com a mesma precisão usada no estoque. */
export const ProdutoFilamentoInputSchema = z.object({
  filamentoId: z.string().min(1, 'Selecione o filamento'),
  pesoG: z.number().positive('Informe o peso por unidade').max(99999999.99).multipleOf(0.01),
});

export const ComposicaoFilamentosSchema = z
  .array(ProdutoFilamentoInputSchema)
  .min(1, 'Adicione pelo menos um filamento')
  .superRefine((itens, ctx) => {
    const ids = new Set<string>();
    itens.forEach((item, index) => {
      if (ids.has(item.filamentoId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'filamentoId'],
          message: 'Filamento repetido; some os gramas na mesma linha',
        });
      }
      ids.add(item.filamentoId);
    });
    if (itens.reduce((total, item) => total + item.pesoG, 0) > 99999999.99) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Peso total excede o limite permitido',
      });
    }
  });

export type ProdutoFilamentoInput = z.infer<typeof ProdutoFilamentoInputSchema>;
