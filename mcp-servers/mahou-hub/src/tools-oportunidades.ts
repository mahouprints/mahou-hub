import { z } from 'zod';
import { apiCall } from './client.js';

// Schemas dos inputs. Replicam de packages/contracts/src/oportunidade.ts mas em forma local
// (MCP server é workspace separado pra ser publicável standalone — não importa @mahou-hub/contracts).

const MarketplaceSchema = z.enum(['SHOPEE', 'TIKTOK', 'ML', 'OUTRO']).default('SHOPEE');
const FonteSchema = z.enum(['CONCORRENTE', 'KEYWORD', 'CATEGORIA', 'TOP_VENDAS', 'IDEIA_GERADA']);
const StatusSchema = z.enum(['NOVO', 'EM_ANALISE', 'APROVADO', 'DESCARTADO', 'VIRARAM_PRODUTO']);

const FiltrosSchema = z
  .object({
    precoMinCentavos: z.number().int().nonnegative().optional(),
    precoMaxCentavos: z.number().int().nonnegative().optional(),
    vendasMin: z.number().int().nonnegative().optional(),
    ratingMin: z.number().min(0).max(5).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  })
  .optional();

const CandidatoSchema = z.object({
  marketplace: MarketplaceSchema,
  externalId: z.string().min(1),
  productName: z.string(),
  priceMinCentavos: z.number().int().nonnegative(),
  priceMaxCentavos: z.number().int().nonnegative(),
  imageUrl: z.string(),
  productLink: z.string(),
  vendasAfiliadoMes: z.number().int().nonnegative(),
  ratingStar: z.number().min(0).max(5).nullable().optional(),
  categoriaIds: z.array(z.number().int()).default([]),
  lojaExternalId: z.string().nullable().optional(),
  lojaNome: z.string().nullable().optional(),
  fonte: FonteSchema,
  fonteParam: z.string().nullable().optional(),
  concorrenteId: z.string().nullable().optional(),
  snapshotProdutoId: z.string().nullable().optional(),
  status: StatusSchema.optional(),
  score: z.number().min(0).max(100).nullable().optional(),
  notas: z.string().nullable().optional(),
});

// As shapes Zod abaixo são definidas como objetos crus (não z.object) pra alinhar com o
// formato que o SDK do MCP espera em `inputSchema` (zodObject .shape).

export const tools = [
  {
    name: 'buscar_oportunidades',
    description:
      'Busca direcionada de produtos no marketplace (keyword, categoria ou concorrente). ' +
      'Não persiste — devolve candidatos enriquecidos com vendasAfiliadoMes. Use ' +
      '`salvar_oportunidades_em_lote` depois pra adicionar ao backlog os que valem a pena. ' +
      'Pro tipo `concorrente`: passe `concorrenteId` (interno) pra ler snapshot local rápido, ' +
      'OU `lojaExternalId` (shopId Shopee) pra investigar loja não cadastrada via Affiliate API on-demand.',
    inputSchema: z.object({
      marketplace: MarketplaceSchema,
      tipo: z.enum(['keyword', 'categoria', 'concorrente']),
      params: z
        .object({
          keyword: z.string().optional(),
          categoryId: z.string().optional(),
          concorrenteId: z.string().optional(),
          lojaExternalId: z.string().optional(),
        })
        .describe('keyword|categoryId|concorrenteId|lojaExternalId conforme o tipo'),
      filtros: FiltrosSchema,
    }),
    handler: async (input: unknown) => {
      const data = input as Record<string, unknown>;
      const tipo = data.tipo as string;
      // Backend espera discriminated union { tipo, params } — repassa direto.
      return apiCall('POST', '/oportunidades/buscar', {
        marketplace: data.marketplace ?? 'SHOPEE',
        tipo,
        params: data.params ?? {},
        filtros: data.filtros,
      });
    },
  },

  {
    name: 'explorar_top_vendas',
    description:
      'Modo brainstorm: varre o top de vendas do marketplace SEM filtro de nicho. ' +
      'Use quando o usuário pedir "me dê ideias", "o que tá bombando", "varre e me surpreenda". ' +
      'Aplique filtros mínimos (vendasMin>=200, faixa de preço R$20-R$200) pra reduzir ruído.',
    inputSchema: z.object({
      marketplace: MarketplaceSchema,
      filtros: FiltrosSchema,
    }),
    handler: async (input: unknown) => {
      const data = input as Record<string, unknown>;
      return apiCall('POST', '/oportunidades/explorar', {
        marketplace: data.marketplace ?? 'SHOPEE',
        filtros: data.filtros,
      });
    },
  },

  {
    name: 'listar_oportunidades',
    description:
      'Lista oportunidades persistidas no backlog. Filtros: status, scoreMin, fonte, marketplace, q (busca textual em productName).',
    inputSchema: z.object({
      status: StatusSchema.optional(),
      scoreMin: z.number().min(0).max(100).optional(),
      fonte: FonteSchema.optional(),
      marketplace: MarketplaceSchema.optional(),
      q: z.string().optional(),
      take: z.number().int().min(1).max(500).optional(),
      skip: z.number().int().nonnegative().optional(),
    }),
    handler: async (input: unknown) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
        if (v !== undefined && v !== null) params.set(k, String(v));
      }
      const qs = params.toString();
      return apiCall('GET', `/oportunidades${qs ? `?${qs}` : ''}`);
    },
  },

  {
    name: 'salvar_oportunidade',
    description:
      'Salva 1 candidato no backlog (upsert por marketplace+externalId). Use quando avaliar 1 item específico.',
    inputSchema: CandidatoSchema,
    handler: async (input: unknown) => apiCall('POST', '/oportunidades', input),
  },

  {
    name: 'salvar_oportunidades_em_lote',
    description:
      'Salva vários candidatos de uma vez (até 200). Use quando classificar batches no modo brainstorm.',
    inputSchema: z.object({
      itens: z.array(CandidatoSchema).min(1).max(200),
    }),
    handler: async (input: unknown) => apiCall('POST', '/oportunidades/bulk', input),
  },

  {
    name: 'atualizar_oportunidade',
    description:
      'Atualiza status, score (0-100) ou notas de uma oportunidade. Envie ao menos um campo.',
    inputSchema: z.object({
      id: z.string().min(1),
      status: StatusSchema.optional(),
      score: z.number().min(0).max(100).nullable().optional(),
      notas: z.string().nullable().optional(),
    }),
    handler: async (input: unknown) => {
      const { id, ...rest } = input as { id: string } & Record<string, unknown>;
      return apiCall('PATCH', `/oportunidades/${id}`, rest);
    },
  },

  {
    name: 'descartar_oportunidade',
    description: 'Remove oportunidade do backlog (hard delete).',
    inputSchema: z.object({ id: z.string().min(1) }),
    handler: async (input: unknown) => {
      const { id } = input as { id: string };
      return apiCall('DELETE', `/oportunidades/${id}`);
    },
  },

  {
    name: 'virar_produto',
    description:
      'Promove oportunidade a Produto rascunho. Pré-preenche nome, inspiracao, precoCentavos e canal. ' +
      'Você precisa fornecer filamentoId, pesoG, tempoH e impressora (Produto não tolera null nesses).',
    inputSchema: z.object({
      id: z.string().min(1),
      nome: z.string().min(1).optional(),
      precoCentavos: z.number().int().positive().optional(),
      filamentoId: z.string().min(1),
      pesoG: z.number().positive(),
      tempoH: z.number().positive(),
      impressora: z.enum(['A1', 'H2C']),
      embalagemCentavos: z.number().int().nonnegative().optional(),
    }),
    handler: async (input: unknown) => {
      const { id, ...rest } = input as { id: string } & Record<string, unknown>;
      return apiCall('POST', `/oportunidades/${id}/virar-produto`, rest);
    },
  },

  {
    name: 'estatisticas_oportunidades',
    description: 'Counts por status, fonte e marketplace. Use pra ter contexto do backlog antes de agir.',
    inputSchema: z.object({}),
    handler: async () => apiCall('GET', '/oportunidades/estatisticas'),
  },

  {
    name: 'categorias_shopee_3d',
    description:
      'Lista de categorias Shopee curadas como relevantes pra impressão 3D (id + nome + notas). ' +
      'Use pra escolher um `categoryId` ao chamar `buscar_oportunidades` com `tipo="categoria"`.',
    inputSchema: z.object({}),
    handler: async () => apiCall('GET', '/oportunidades/categorias-3d'),
  },
] as const;

export type ToolDef = (typeof tools)[number];
