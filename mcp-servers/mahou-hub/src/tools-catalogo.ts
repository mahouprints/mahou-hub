import { z } from 'zod';
import { apiCall } from './client.js';

// Tools de catálogo Mahou — produtos, filamentos, insumos, calculadora.
// Os schemas Zod abaixo replicam os contratos da API (não importam @mahou-hub/contracts
// pra deixar o MCP server publicável standalone).

const CanalSchema = z.enum(['SHOPEE', 'ML', 'SITE', 'TIKTOK']);
const ImpressoraSchema = z.enum(['A1', 'H2C']);

const ProdutoCreateSchema = z.object({
  nome: z.string().min(1),
  inspiracao: z.string().nullable().optional(),
  modelo3dUrl: z.string().url().nullable().optional(),
  larguraCm: z.number().positive().nullable().optional(),
  alturaCm: z.number().positive().nullable().optional(),
  profundidadeCm: z.number().positive().nullable().optional(),
  filamentoId: z.string().min(1),
  pesoG: z.number().positive(),
  tempoH: z.number().positive(),
  impressora: ImpressoraSchema,
  embalagemCentavos: z.number().int().nonnegative(),
  precoCentavos: z.number().int().positive(),
  canalPrincipal: CanalSchema,
  ativo: z.boolean().optional(),
  anunciado: z.boolean().optional(),
  insumos: z
    .array(
      z.object({
        insumoId: z.string().min(1),
        qtd: z.number().positive(),
      }),
    )
    .optional(),
});

const ProdutoUpdateSchema = ProdutoCreateSchema.partial();

// Input livre pra calculadora — calcula pricing dum produto hipotético sem persistir.
// Usado pra "quanto custaria imprimir X?" sem precisar criar Produto.
const CalcularInputSchema = z.object({
  filamentoId: z.string().min(1),
  pesoG: z.number().positive(),
  tempoH: z.number().positive(),
  impressora: ImpressoraSchema,
  embalagemCentavos: z.number().int().nonnegative().default(0),
  precoCentavos: z.number().int().positive(),
  insumos: z
    .array(
      z.object({
        insumoId: z.string().min(1),
        qtd: z.number().positive(),
      }),
    )
    .optional(),
});

export const tools = [
  {
    name: 'listar_produtos',
    description:
      'Lista produtos cadastrados na Mahou com filtros e paginação. ' +
      'Devolve produto + pricing calculado (custos, margem, lucro por canal). ' +
      'Use `q` pra busca textual (nome+inspiração), `anunciado` pra filtrar publicados, ' +
      '`canal` pra filtrar canal principal, `temImagens` pra filtrar por presença de foto final, ' +
      '`temReferencia` pra filtrar por presença de inspiração/modelo3dUrl.',
    inputSchema: z.object({
      anunciado: z.enum(['true', 'false']).optional(),
      canal: CanalSchema.optional(),
      temImagens: z.enum(['true', 'false']).optional(),
      temReferencia: z.enum(['true', 'false']).optional(),
      q: z.string().min(1).max(200).optional(),
      page: z.number().int().positive().optional(),
      pageSize: z.number().int().min(1).max(200).optional(),
      sortBy: z.enum(['criadoEm', 'atualizadoEm', 'nome', 'precoCentavos']).optional(),
      sortDir: z.enum(['asc', 'desc']).optional(),
    }),
    handler: async (input: unknown) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        if (v !== undefined && v !== null) params.set(k, String(v));
      }
      const qs = params.toString();
      return apiCall('GET', `/produtos${qs ? `?${qs}` : ''}`);
    },
  },

  {
    name: 'listar_produtos_pendentes_imagem',
    description:
      'Atalho pro fluxo da skill de geração de imagem: lista produtos `anunciado=false` ' +
      'que JÁ TÊM imagem upada (refs reais — INSPIRACAO/MODELO_3D) MAS AINDA NÃO TÊM ' +
      'foto final GERADA. Esses são os candidatos imediatos pra skill. Por padrão filtra ' +
      '`metodoImagem=IA` — só puxa produtos marcados pra geração via skill. Passe ' +
      '`metodoImagem: "FOTO"` pra ver a fila de fotografia física, ou `"TODOS"` pra ' +
      'ignorar o filtro (inclui produtos sem decisão).',
    inputSchema: z.object({
      page: z.number().int().positive().optional(),
      pageSize: z.number().int().min(1).max(200).optional(),
      metodoImagem: z.enum(['IA', 'FOTO', 'NULL', 'TODOS']).optional(),
    }),
    handler: async (input: unknown) => {
      const { metodoImagem, ...rest } = (input ?? {}) as { metodoImagem?: string };
      // Antes filtrava temReferencia=true & temImagens=false — bug: URL textual em
      // `inspiracao`/`modelo3dUrl` não dá pra usar como ref no Flow (precisa de pixels),
      // e `temImagens=false` excluía produtos que JÁ tinham as INSPIRACAO upadas.
      // Agora exige imagem upada (qualquer origem) E ausência de GERADA.
      const params = new URLSearchParams({
        anunciado: 'false',
        temImagens: 'true',
        temImagemGerada: 'false',
      });
      // Default: filtra fila da skill (IA). 'TODOS' = sem filtro de método.
      const metodo = metodoImagem ?? 'IA';
      if (metodo !== 'TODOS') params.set('metodoImagem', metodo);
      for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined && v !== null) params.set(k, String(v));
      }
      return apiCall('GET', `/produtos?${params.toString()}`);
    },
  },

  {
    name: 'obter_produto',
    description:
      'Detalha 1 produto pelo id: dados + filamento + insumos + imagens + pricing por canal.',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: async (input: unknown) => {
      const { id } = input as { id: string };
      return apiCall('GET', `/produtos/${id}`);
    },
  },

  {
    name: 'estatisticas_produto',
    description:
      'Estatísticas de vendas+produção de 1 produto: qtd vendida, faturamento, ' +
      'última venda, produzidos (jobs concluídos) e em produção (jobs ativos).',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: async (input: unknown) => {
      const { id } = input as { id: string };
      return apiCall('GET', `/produtos/${id}/estatisticas`);
    },
  },

  {
    name: 'criar_produto',
    description:
      'Cria um produto novo. Todos os campos obrigatórios (filamento/peso/tempo/impressora/preço/canal). ' +
      'Use `obter_produto` depois pra ver o pricing calculado. Pra criar a partir de uma ' +
      'oportunidade Shopee, use `virar_produto` no lugar.',
    inputSchema: ProdutoCreateSchema,
    handler: async (input: unknown) => apiCall('POST', '/produtos', input),
  },

  {
    name: 'atualizar_produto',
    description:
      'Atualiza campos do produto (parcial). Use pra completar um rascunho (preencher ' +
      'peso/tempo/filamento) e setar `rascunho: false`, ou pra ajustar preço, dimensões etc.',
    inputSchema: ProdutoUpdateSchema.extend({ id: z.string().min(1) }),
    handler: async (input: unknown) => {
      const { id, ...rest } = input as { id: string } & Record<string, unknown>;
      return apiCall('PATCH', `/produtos/${id}`, rest);
    },
  },

  {
    name: 'desativar_produto',
    description:
      'Soft-delete: marca produto como `ativo=false`. Preserva histórico (vendas e jobs ' +
      'continuam referenciando). Pra reativar, use `atualizar_produto` com `ativo: true`.',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: async (input: unknown) => {
      const { id } = input as { id: string };
      return apiCall('DELETE', `/produtos/${id}`);
    },
  },

  {
    name: 'desativar_produtos_em_lote',
    description: 'Soft-delete em massa (até 500 ids).',
    inputSchema: z.object({
      ids: z.array(z.string().min(1)).min(1).max(500),
    }),
    handler: async (input: unknown) => apiCall('POST', '/produtos/bulk-delete', input),
  },

  {
    name: 'marcar_produtos_anunciados',
    description:
      'Marca/desmarca a flag `anunciado` em N produtos. Usado após publicar no marketplace ' +
      'pra tirar do fluxo de "produtos a anunciar" (que filtra `anunciado=false`).',
    inputSchema: z.object({
      ids: z.array(z.string().min(1)).min(1).max(500),
      anunciado: z.boolean(),
    }),
    handler: async (input: unknown) => apiCall('POST', '/produtos/bulk-anunciar', input),
  },

  {
    name: 'listar_filamentos',
    description:
      'Lista filamentos cadastrados (PLA/PETG/ABS etc.). Retorna id, nome, custo por kg, ' +
      'potências por impressora e flag `ativo`. Use o `id` em `criar_produto` ou ' +
      '`calcular_preco`.',
    inputSchema: z.object({}),
    handler: async () => apiCall('GET', '/filamentos'),
  },

  {
    name: 'listar_insumos',
    description:
      'Lista insumos reutilizáveis (caixa, fita, etiqueta, papel). Retorna id, nome, ' +
      'unidade, custo unitário em centavos. Por padrão filtra ativos; passe ' +
      '`incluirInativos: true` pra ver todos.',
    inputSchema: z.object({
      incluirInativos: z.boolean().optional(),
    }),
    handler: async (input: unknown) => {
      const { incluirInativos } = input as { incluirInativos?: boolean };
      const qs = incluirInativos ? '?incluirInativos=true' : '';
      return apiCall('GET', `/insumos${qs}`);
    },
  },

  {
    name: 'calcular_preco',
    description:
      'Calculadora avulsa: dado um produto hipotético (filamento + peso + tempo + impressora ' +
      '+ preço + insumos), retorna custos, margem e lucro por canal (Shopee/ML/Site/TikTok). ' +
      'Não persiste nada — útil pra responder "vale a pena imprimir X por R$Y?".',
    inputSchema: CalcularInputSchema,
    handler: async (input: unknown) => apiCall('POST', '/pricing/calcular', input),
  },
] as const;
