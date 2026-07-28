import { z } from 'zod';

export const PedidoStatusSchema = z.enum([
  'PENDENTE',
  'ATENDIDO',
  'BLOQUEADO',
  'CANCELADO',
  'ENVIADO',
]);
export type PedidoStatus = z.infer<typeof PedidoStatusSchema>;

export const PedidoItemAtendimentoSchema = z.enum([
  'SEM_VINCULO',
  'BAIXADO_ESTOQUE',
  'EM_PRODUCAO',
]);
export type PedidoItemAtendimento = z.infer<typeof PedidoItemAtendimentoSchema>;

/// Só Shopee e ML importam pedido. SITE e TIKTOK existem em `Canal` pra precificação,
/// mas não têm integração de pedidos — aceitar aqui deixaria criar registro órfão.
export const CanalPedidoSchema = z.enum(['SHOPEE', 'ML']);
export type CanalPedido = z.infer<typeof CanalPedidoSchema>;

export const PedidoItemImportSchema = z.object({
  skuExterno: z.string().min(1, 'SKU do marketplace não pode ser vazio'),
  nomeExterno: z.string().default(''),
  qtd: z.number().int().positive(),
  precoUnitarioCentavos: z.number().int().nonnegative(),
});
export type PedidoItemImport = z.infer<typeof PedidoItemImportSchema>;

// Datas chegam como string na borda (JSON não tem Date) e viram Date aqui, pra que o
// service receba o tipo certo sem cada chamador lembrar de converter.
const DataFlexivel = z.union([z.string(), z.date()]).pipe(z.coerce.date());

export const PedidoImportSchema = z.object({
  canal: CanalPedidoSchema,
  externalId: z.string().min(1),
  statusExterno: z.string().default(''),
  compradorNome: z.string().nullable().optional(),
  totalCentavos: z.number().int().nonnegative(),
  prazoEnvio: DataFlexivel.nullable().optional(),
  dataPedido: DataFlexivel,
  itens: z.array(PedidoItemImportSchema).min(1, 'Pedido sem itens não é importável'),
});
export type PedidoImport = z.infer<typeof PedidoImportSchema>;

export const PedidoListarSchema = z.object({
  status: PedidoStatusSchema.optional(),
  canal: CanalPedidoSchema.optional(),
  /// Só pedidos com item aguardando vínculo de SKU.
  somenteBloqueados: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type PedidoListar = z.infer<typeof PedidoListarSchema>;

export const PedidoVincularItemSchema = z.object({
  variacaoId: z.string().min(1, 'variacaoId é obrigatório para vincular o item'),
});
export type PedidoVincularItem = z.infer<typeof PedidoVincularItemSchema>;

// Janela de 1 a 168h (7 dias). O teto existe porque cada hora a mais é mais página
// paginada nos dois marketplaces — pedir 30 dias de uma vez estoura rate limit.
export const PedidoSyncSchema = z.object({
  horas: z.coerce.number().int().min(1).max(168).default(24),
});
export type PedidoSync = z.infer<typeof PedidoSyncSchema>;
