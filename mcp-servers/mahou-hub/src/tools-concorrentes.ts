import { z } from 'zod';
import { apiCall } from './client.js';

// Tools de concorrentes — leitura rápida do snapshot de produtos das lojas
// monitoradas. Snapshots são repopulados pelo cron domingo 03h America/Sao_Paulo.

export const tools = [
  {
    name: 'listar_produtos_concorrentes',
    description:
      'Retorna produtos do snapshot mais recente de cada loja concorrente em formato ' +
      'denso (`headers + rows`, tipo CSV) — economiza ~50% dos tokens vs JSON tradicional ' +
      'e facilita análise tabular. Use quando o usuário quiser: "que produtos os concorrentes ' +
      'vendem?", "top mais vendidos por preço X-Y", "buscar miniaturas no catálogo agregado", ' +
      'comparações de mercado etc. ' +
      'Filtros: `concorrenteId` (1 loja específica via cuid), `vendasMin` (vendas afiliado/mês ≥), ' +
      '`precoMinCentavos` / `precoMaxCentavos`, `q` (busca textual case+accent-insensitive no nome), ' +
      '`sortBy` (vendas|preco|rating|nome, default `vendas`), `sortDir` (asc|desc, default `desc`), ' +
      '`limit` (1-500, default 100). ' +
      'A coluna `vendasAfiliadoMes` é o `sales` da Shopee Affiliate normalizado pra 30 dias — ' +
      'NÃO é o histórico total real. A coluna `vendasReais` é enriquecimento manual via Seller ' +
      'Center (null = ainda não preenchido).',
    inputSchema: z.object({
      concorrenteId: z.string().min(1).optional(),
      vendasMin: z.number().int().nonnegative().optional(),
      precoMinCentavos: z.number().int().nonnegative().optional(),
      precoMaxCentavos: z.number().int().nonnegative().optional(),
      q: z.string().min(1).max(200).optional(),
      sortBy: z.enum(['vendas', 'preco', 'rating', 'nome']).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }),
    handler: async (input: unknown) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        if (v !== undefined && v !== null) params.set(k, String(v));
      }
      const qs = params.toString();
      return apiCall('GET', `/concorrentes/produtos${qs ? `?${qs}` : ''}`);
    },
  },
];
