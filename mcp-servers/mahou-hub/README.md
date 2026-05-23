# mahou-hub — MCP server

Expõe o backend do Mahou Hub como tools MCP pro Claude (Desktop, Code, web).

22 tools que cobrem dois domínios:
- **Inteligência de Oportunidades** — descoberta no Shopee Affiliate, gestão de backlog, geração de ideias autorais.
- **Catálogo Mahou** — produtos, filamentos, insumos e calculadora de pricing.

---

## 🚀 Onboarding (5 min)

**Pré-requisitos**: login ativo no Hub (`https://hub.mahouprints.com`), Node 22+, pnpm 9+, [Claude Code](https://claude.com/claude-code).

```bash
# 1) Clone + deps + build
git clone git@github.com:mahouprints/mahou-hub.git
cd mahou-hub
pnpm install
pnpm --filter @mahou-hub/mcp-hub build

# 2) Token JWT longo (válido 365 dias)
TOKEN_CURTO=$(curl -s -i -X POST https://api.mahouprints.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"SEU.EMAIL@mahouprints.com","senha":"SUA-SENHA"}' \
  | grep -i 'set-cookie: mahou_token=' \
  | sed -E 's/.*mahou_token=([^;]+).*/\1/' | tr -d '\r')

curl -X POST https://api.mahouprints.com/api/v1/auth/api-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_CURTO" \
  -d '{"ttlDias": 365}'
# → copie o `token` da resposta

# 3) Crie mcp-servers/mahou-hub/.env.local (gitignored)
cat > mcp-servers/mahou-hub/.env.local <<EOF
MAHOU_API_URL=https://api.mahouprints.com
MAHOU_API_TOKEN=cole-aqui-o-token-do-passo-2
EOF

# 4) Pronto. Abra Claude Code dentro do repo:
claude
```

O `.mcp.json` na raiz aponta pro MCP local via `node --env-file=./mcp-servers/mahou-hub/.env.local`. As 22 tools `mcp__mahou-hub__*` ficam disponíveis na primeira mensagem. Teste com:

> Quantas oportunidades temos no backlog?

(Claude vai chamar `estatisticas_oportunidades`.)

### Renovar token

Mesma sequência do passo 2. Token novo substitui no `.env.local` + restart MCP (`/mcp` → reconnect). Sem revogação por token; pra invalidar tudo (incidente de segurança), rotacionar `JWT_SECRET` na VPS.

### Claude Desktop (alternativa)

`%APPDATA%\Claude\claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "mahou-hub": {
      "command": "node",
      "args": [
        "--env-file=C:/caminho/para/mahou-hub/mcp-servers/mahou-hub/.env.local",
        "C:/caminho/para/mahou-hub/mcp-servers/mahou-hub/dist/index.js"
      ]
    }
  }
}
```
Reinicia o Desktop.

### Troubleshooting

| Sintoma | Causa | Fix |
|---|---|---|
| `Mahou API ... → 401` | Token ausente/expirado/inválido | Gera novo, atualiza `.env.local`, restart MCP |
| `Cannot find module dist/index.js` | Sem build | `pnpm --filter @mahou-hub/mcp-hub build` |
| Tools `mcp__mahou-hub__*` não aparecem | Claude aberto fora do repo | Abre dentro de `mahou-hub/` (lê `.mcp.json`) |
| `Authorization: Bearer ${MAHOU_API_TOKEN}` literal | `${VAR}` no `.mcp.json` não interpola | Use `--env-file` (já configurado) — não vire pra `env` do shell |
| `400 JSON schema invalid` | zodToJsonSchema com `target: 'openApi3'` (gera `nullable: true` inválido) | Já corrigido — não regredir |

---

## 🧭 Conceitos do domínio

Pra usar bem as tools, ajuda entender 4 conceitos:

### 1. Concorrente
Loja Shopee que a Mahou monitora. Cadastra-se via UI ou REST (`POST /concorrentes/from-link`). Cron domingo 03h sincroniza snapshot de todos. **40+ lojas cadastradas em prod**, predominantemente impressão 3D.

### 2. Snapshot
Fotografia semanal dos produtos de um concorrente (via Shopee Affiliate API). 1 snapshot por sync, histórico preservado. A tool `listar_produtos_concorrentes` lê o snapshot mais recente em formato denso.

### 3. Oportunidade
Candidato a virar produto no catálogo Mahou. Vive em `ProdutoOportunidade` com `status` (NOVO → EM_ANALISE → APROVADO/DESCARTADO → VIRARAM_PRODUTO) e `fonte`:
- `TOP_VENDAS` — descoberto via `explorar_top_vendas` (brainstorm marketplace).
- `KEYWORD` — descoberto via `buscar_oportunidades` tipo keyword.
- `CATEGORIA` — descoberto via `buscar_oportunidades` tipo categoria.
- `CONCORRENTE` — descoberto via `buscar_oportunidades` tipo concorrente.
- `IDEIA_GERADA` — **autoria Mahou**, inspirada no mercado. `externalId` é cuid local prefixado `IG-` (não Shopee item). Usa pra propostas autorais que diferenciam Mahou dos copiadores.

### 4. Produto rascunho
`Produto.rascunho=true` é o limbo entre Oportunidade aprovada e Produto vendável. Peso/tempo podem estar zerados. Vem de `virar_produto` aplicado a Oportunidade (preenche o que dá; resto fica rascunho).

Usuário completa via UI Produtos.

---

## 🛠️ Tools (22)

### Oportunidades — descoberta (4)

| Tool | Quando usar |
|---|---|
| `buscar_oportunidades` | Busca direcionada. 4 modos via `tipo`: `keyword` / `categoria` (catId Shopee) / `concorrente` (passa `concorrenteId` interno OU `lojaExternalId` shopId Shopee — este último chama Affiliate API ao vivo, sem precisar cadastrar). |
| `explorar_top_vendas` | Modo brainstorm: top vendas Shopee sem filtro de nicho. **Rate-limit 10/min**. Use 1× por sessão. |
| `categorias_shopee_3d` | Lista as 22 categorias Shopee curadas como 3D-friendly (id + nome + notas). Use pra escolher `categoryId` em `buscar_oportunidades`. |
| `estatisticas_oportunidades` | Counts por status/fonte/marketplace. Use no início pra contexto do backlog. |

### Oportunidades — gestão de backlog (6)

| Tool | Quando usar |
|---|---|
| `listar_oportunidades` | Backlog persistido. Filtros: status, scoreMin, fonte, marketplace, q. |
| `salvar_oportunidade` / `salvar_oportunidades_em_lote` | Persiste candidato(s). Upsert por `(marketplace, externalId)` — rodar 2× preserva workflow (status/score/notas). |
| `atualizar_oportunidade` | Muda status / score / notas. Registra audit log automaticamente. |
| `descartar_oportunidade` | Atalho pra `status=DESCARTADO`. |
| `virar_produto` | Promove oportunidade aprovada a `Produto` (completa ou rascunho conforme campos preenchidos). |

### Catálogo — leitura (6)

| Tool | Quando usar |
|---|---|
| `listar_produtos` | Catálogo paginado com pricing por canal já calculado. Filtros: canal, anunciado, temImagens (foto final), temReferencia (inspiração/modelo3dUrl), q. |
| `listar_produtos_pendentes_imagem` | Atalho do fluxo da skill `gerar-imagem-produto`: `anunciado=false` + `temReferencia=true` + `temImagens=false`. |
| `obter_produto` | Detalhe de 1 produto + filamento + insumos + imagens + pricing. |
| `estatisticas_produto` | Vendas, faturamento, produzidos, em produção. |
| `listar_filamentos` | Pra escolher `filamentoId` ao criar produto / calcular preço. |
| `listar_insumos` | Pra escolher `insumoId` em arrays. |

### Catálogo — escrita (5)

| Tool | Quando usar |
|---|---|
| `criar_produto` | Cria produto novo (todos campos obrigatórios). Pra rascunho use `virar_produto`. |
| `atualizar_produto` | Partial update (use pra completar peso/tempo de rascunhos). |
| `desativar_produto` / `desativar_produtos_em_lote` | Soft-delete (`ativo=false`). Preserva referências em vendas/jobs históricos. |
| `marcar_produtos_anunciados` | Bulk `anunciado=true|false` após publicar no marketplace. |

### Pricing (1)

| Tool | Quando usar |
|---|---|
| `calcular_preco` | Calculadora stateless: "vale a pena imprimir X em Y filamento com Z preço?". Não persiste. Use pra simular antes de criar produto. |

---

## 🎯 Fluxos típicos

### A. Brainstorm marketplace → backlog
1. `estatisticas_oportunidades` (contexto)
2. `explorar_top_vendas` com filtros (vendasMin >= 200, faixa preço, ratingMin >= 4)
3. Avaliar candidatos aplicando [`oportunidades-mahou/criterios-3d.md`](../../.claude/skills/oportunidades-mahou/criterios-3d.md)
4. Apresentar ao usuário (não use score como filtro de corte — só pra ranquear se pedirem)
5. `salvar_oportunidades_em_lote` com `status='EM_ANALISE'` + notas estruturadas

### B. Geração de ideias autorais (fonte=IDEIA_GERADA)
1. Varre nichos diversos via `buscar_oportunidades` (≥3 categorias diferentes — diversidade obrigatória).
2. Analisa transversalmente: padrões, faixas de preço, concorrentes 3D ativos.
3. Gera N ideias **autorais** (não copia o que viu — propõe variação/combinação/ângulo único).
4. Salva via `salvar_oportunidades_em_lote` com `fonte='IDEIA_GERADA'`, `externalId='IG-AAAA-MM-DD-slug'`, `lojaNome='Mahou Prints'`.
5. Notas estruturadas: **Conceito** / **Inspirações** (refs Shopee) / **Diferencial** / **Por que faz sentido** / **Estimativa produção** / **Risco**.

Detalhe completo em [`oportunidades-mahou/geracao-ideias.md`](../../.claude/skills/oportunidades-mahou/geracao-ideias.md).

### C. Investigar loja descoberta (sem cadastrar)
`buscar_oportunidades({ tipo: 'concorrente', params: { lojaExternalId: 'SHOPID' } })` — chama Affiliate API ao vivo pra qualquer shopId Shopee. Útil pra avaliar uma loja antes de decidir cadastrar como concorrente.

### D. Cadastro de concorrente (via REST, sem tool MCP)
Não tem tool MCP de criação. Use:
```bash
curl -X POST https://api.mahouprints.com/api/v1/concorrentes/from-link \
  -H "Authorization: Bearer $MAHOU_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://shopee.com.br/shop/SHOPID"}'
```
URL aceita `shop/{shopId}` (determinístico) ou `{username}` (slug). **NÃO** funciona com URL de produto.

### E. Produtos dos concorrentes (formato denso)
- Tool: `listar_produtos_concorrentes` — retorna `{ headers, rows }` (CSV-like) com snapshot mais recente de cada loja.
- REST: `GET /api/v1/concorrentes/produtos?concorrenteId=...&vendasMin=...&precoMinCentavos=...&q=...&limit=...`
- Use pra análise rápida de mercado, busca textual, comparações por preço e ranqueamento por vendas afiliado.

---

## ⏱️ Rate-limits

NestJS Throttler no backend Mahou (NÃO confundir com Shopee Affiliate):

| Endpoint | Tool | Limite |
|---|---|---|
| `POST /oportunidades/buscar` | `buscar_oportunidades` | **20/min** |
| `POST /oportunidades/explorar` | `explorar_top_vendas` | **10/min** (varre top global; mais caro) |
| `POST /oportunidades/bulk` | `salvar_oportunidades_em_lote` | **30/min** |
| Demais endpoints | — | 100/min (default global) |

Pra varredura em lote (múltiplas keywords/categorias): sequencial com ~3s entre chamadas. **Não paralelizar `buscar_oportunidades`** — Claude pode disparar 4-5/seg e estourar 429.

---

## ⚠️ Limitações conhecidas

### Shopee Affiliate API expõe só 18 campos por produto
`itemId, productName, commissionRate, commission, sales, priceMin, priceMax, priceDiscountRate, imageUrl, productLink, offerLink, periodStartTime, periodEndTime, shopId, shopName, shopType, productCatIds, ratingStar`.

**NÃO retorna**: descrição textual, material declarado, dimensões/peso, imagens adicionais, variantes, nome da categoria (só catId), reviews textuais. Confirma `memory/shopee_affiliate_limits.md`.

Implicação: classificação de "material 3D vs cerâmica vs MDF" é qualitativa via `productName`.

### Estimativa de vendas via Affiliate é aproximada
`sales` é janela de campanha (~30 dias do afiliado, não histórico total). Heurística `(sales/dias × 30) / 0.05` aplicada no backend assume ~5% das vendas via afiliado (média observada na 3DTECH). Pode ser ±50% em valor absoluto, mas ordem de grandeza é confiável.

### Não há tool MCP de criação de concorrente
Cadastro precisa REST direto (`POST /concorrentes/from-link`). Foi decisão consciente — cadastro é ato deliberado humano, não fluxo de descoberta automática.


---

## 🧪 Dev

```bash
pnpm --filter @mahou-hub/mcp-hub dev     # tsc --watch
```

Testar manualmente (sem Claude):
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Arquitetura

```
mcp-servers/mahou-hub/
├── src/
│   ├── index.ts                 # entry stdio + combina tools + zodToJsonSchema (target default)
│   ├── client.ts                # fetch wrapper + lê MAHOU_API_TOKEN do env
│   ├── tools-oportunidades.ts   # 10 tools: descoberta + backlog
│   └── tools-catalogo.ts        # 12 tools: produtos + filamentos + pricing
├── .env.local                   # gitignored — MAHOU_API_URL + MAHOU_API_TOKEN
└── README.md
```

Pra adicionar nova área (ex: vendas, produção, financeiro):
1. Crie `tools-<area>.ts` exportando `tools` array.
2. Importe em `index.ts` e concatene no array geral.
3. Schemas Zod replicados localmente — **sem dep em `@mahou-hub/contracts`** pra MCP ficar publicável standalone no futuro.

### Detalhes técnicos importantes

- **JSON Schema target**: `zodToJsonSchema(s)` sem `target: 'openApi3'`. OpenAPI 3.0 gera `nullable: true` que viola JSON Schema draft 2020-12 (exigido pela API da Anthropic) — disparado erro 400 e o servidor "desconecta" todas as tools de uma vez.
- **Env loading**: `.mcp.json` usa `node --env-file=...env.local` (Node 20.6+ nativo, sem dotenv). `${VAR}` no `.mcp.json` **não é interpolado** pelo Claude Code — passa string literal pro filho, causa 401 silencioso.
- **Idempotência**: bulk de oportunidades faz upsert; reaplicar com mesmo `(marketplace, externalId)` atualiza dados de mercado mas **preserva workflow** (status/score/notas) — exceto se você enviar campos novos pra eles.
