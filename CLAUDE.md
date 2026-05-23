# Mahou Hub — instruções para agentes

Idioma: responda sempre em **pt-BR**. Commits, comentários e PRs em pt-BR.

## Stack
Monorepo pnpm + Turborepo. `apps/web` = Next.js 15 (Vercel, domínio `hub.mahouprints.com`). `apps/api` = NestJS + Prisma + PostgreSQL (VPS Hetzner, domínio `api.mahouprints.com`). `packages/pricing` e `packages/contracts` são compartilhados entre front e back. Imagens vivem em `/var/mahou-storage` na VPS e são servidas em `media.mahouprints.com`.

## Code style
- Funções de 4-20 linhas. Arquivos < 500 linhas. Uma responsabilidade por arquivo.
- Máx. 2 níveis de indentação. Use early returns no lugar de `if` aninhado.
- Nomes específicos: `calcularLiquidoShopee` em vez de `calcularPreco`. Se `grep` retorna >5 resultados pelo nome, está genérico demais.
- Proibido: `data`, `info`, `handler`, `Manager`, `Helper` como sufixos vagos.
- TypeScript strict em todo lugar. Nada de `any` sem comentário justificando.

## Comentários
- Explique **POR QUÊ**, não **O QUÊ**. O nome da função já diz o que ela faz.
- Mantenha comentários que registram decisões (provenance, bug que motivou, restrição de negócio).
- **Não remova comentários que outro agente escreveu** sem entender o motivo — eles guardam contexto que o código não tem.
- Docstring em função pública: intent + 1 exemplo de uso.

## Testes
- **Estado real (2026-05-23):** `packages/pricing` 32 testes (calculadora/custos/taxas/simulador/concorrentes-normalização, ~100% cov). `apps/api` 31 testes Vitest (oportunidades service+cron, shopee provider+signature, produtos service); helper `test/helpers/prisma-mock.ts` cobre os delegates mais usados. `apps/web` sem testes; Playwright nunca configurado.
- Alvo: 90% em `packages/pricing` (já atingido), 70% no resto (pendente).
- Novo backend module precisa de teste Vitest pro service; features de UI críticas, Playwright. Estabelecer o padrão na primeira feature testada.
- Banco de teste sobe via `docker compose -f infra/docker-compose.test.yml up -d` (arquivo já existe pro Postgres ephemeral).
- Bug corrigido precisa de teste de regressão.

## Dependências
- Injete dependências (NestJS DI no backend; props/context no front). Nada de singleton global mutável.
- Money: sempre centavos (`Int`). Nunca `number` de R$. Conversões só na borda (UI / serialização).
- Quantidades fracionárias (qtd de insumo): `Decimal(10,3)` no banco; converter via `Number()` ao calcular custos.
- Validação na borda com Zod em `packages/contracts`. Tipos derivam do schema (`z.infer`).
- Erros de mutação/query são tratados globalmente via `MutationCache`/`QueryCache` no `Providers` → `toast.error(err.message)`. Não duplicar `onError` local só pra mostrar toast.

## Estrutura
- Backend segue convenção NestJS: `src/modules/<dominio>/{controller,service,dto,module}.ts`.
- Frontend segue App Router: `app/(grupo)/<rota>/page.tsx`, `components/` ao lado.
- Caminhos previsíveis: se existe `Produto` no backend, existe `apps/web/app/(app)/produtos/` no front.
- Migrations Prisma versionadas em `apps/api/prisma/migrations/`. Nunca editar migration aplicada.
- API prefixo `api/v1` (setGlobalPrefix em `main.ts`). Frontend chama `/api/<path>` e o Next rewrite traduz pra `/api/v1/<path>` — UI fica alheia à versão. Consumer externo usa `/api/v1/...`. `/healthz` segue fora do prefixo.
- Swagger UI em `/api/v1/docs`, spec em `/api/v1/docs-json` — agrupado por `@ApiTags` por controller. Ao adicionar endpoint, manter o padrão (`@ApiOperation` em endpoints que consumer externo usa).
- Rate-limit global: 100 req/min por IP via `@nestjs/throttler` + `APP_GUARD`. Pra endpoint mais permissivo ou mais restrito, usar `@Throttle({ default: { limit, ttl } })`. `@SkipThrottle()` pra isentar.
- `content/` — assets de marca consumidos pelas skills do Claude Code (regras de marketplace, catálogo Mahou, tom de voz Instagram, templates de cena, memória visual). É dado editorial em `.md`/`.json`/`.jpeg`, **não código**. Separado de `apps/`/`packages/`. Outputs personalizados (posts com cliente real, listings publicados) ficam locais via `.gitignore` — privacidade.

## Formatação
- `prettier` + `eslint --fix` rodam em pre-commit (lefthook).
- Imports ordenados, sem imports não usados.
- `tsconfig` com `strict: true`, `noUncheckedIndexedAccess: true`.

## Logging
- Pino com saída JSON estruturada. Campos obrigatórios: `level`, `time`, `msg`, `requestId`.
- Erro: incluir `err.message`, `err.stack`, valor esperado vs recebido. Nunca logar senha, JWT ou dado pessoal.
- Mensagens de exceção devem dizer o valor recebido e a forma esperada.

## Decisões de produto (não óbvias)
- Valores monetários em centavos no banco e na API. Conversão pra reais só na renderização.
- `Parametro` é singleton (id=1). Reescreva o registro existente em vez de criar novo. Carrega as taxas TikTok (4 percentuais) e os thresholds de margem do dashboard.
- Status de `JobProducao` muda só por endpoint específico (`PATCH /producao/:id/status`), nunca por `update` genérico.
- `Filamento` e `Insumo` nunca são deletados, só marcados `ativo=false` (referenciados por Produtos antigos e Vendas históricas).
- `Calculadora` (`/calculadora`) é stateless e não toca o banco. `Simulador` opera sobre produtos já cadastrados.
- Diferença Calculadora × Simulador: Calculadora valida viabilidade unitária de produto **hipotético**; Simulador projeta produção de produto **cadastrado**.
- `Produto.embalagemCentavos` coexiste com `Insumo` — embalagem é o atalho pra custos sem rastreio; insumos é pra itens cadastrados (caixa, fita). Os dois somam no `custoTotalProducao`.
- `Produto.anunciado` é flag boolean único (não por canal). Fluxo externo consome `?anunciado=false`; marca como `true` via `POST /produtos/bulk-anunciar` após publicar.
- `Custo` com `recorrente=true` na criação dispara geração de N cópias mensais subsequentes (`mesesRecorrencia` 1..60, default 12; `geradoAutomatico=true`, `recorrente=false` pra não cascatear). Cada cópia é editável/deletável individualmente.
- Dashboard financeiro separa **custos variáveis** (filamento+energia+embalagem) de **custos com insumos** (consumo via `ProdutoInsumo`) de **custos gerais** (Custo manual). Não juntar — são apresentados em cards distintos. Lucro líquido desconta todos + impostos + taxas marketplace.
- Canais de venda: SHOPEE, ML, SITE, TIKTOK. Shopee/ML têm tabelas de faixa por preço; TIKTOK tem 4 percentuais fixos em `Parametro` (sem faixa); SITE não tem taxa.
- Sync de coleção filha (`ProdutoInsumo`, `PrecoConcorrente`): `deleteMany` + `createMany` dentro de transação. Não tente diff incremental — o ganho não compensa a complexidade.
- `Concorrente` tem dois modos coexistindo: **manual** (só `loja/instagram/website`, sem `shopId`) e **linkado Shopee** (com `shopId BigInt UNIQUE` + sync via Affiliate API). Botão "Linkar Shopee" na UI promove um manual a linkado. Cada sync (manual ou cron domingo 03h America/Sao_Paulo) cria um `ConcorrenteSnapshot` + N `ConcorrenteSnapshotProduto` (histórico, não sobrescreve).
- Shopee Affiliate API expõe **só 18 campos** em `ProductOfferV2` (lista exata em `apps/api/src/modules/concorrentes/shopee/queries.ts`). `sales` é janela de campanha (~30 dias via afiliado), NÃO histórico total. Vendas totais estimadas usam a heurística `(sales/dias)*30 / 0.05` (assumindo 5% das vendas via afiliado — média observada na 3DTECH). Não tente puxar histórico real via mobile-web `/api/v4/pdp/get_pc` — bloqueado por anti-fraud `x-sap-sec`. **Não retorna**: descrição, material, dimensões, peso, imagens adicionais, variantes, nome categoria, reviews. Classificação de material 3D × cerâmica × MDF é qualitativa via `productName`.
- Comissão da Shopee (`commissionRate`, `commission`) é IRRELEVANTE pra Mahou (não recebemos como afiliado). UI esconde esses campos — métrica útil é vendas estimadas.
- **Oportunidade.fonte** tem 5 valores: `TOP_VENDAS` / `KEYWORD` / `CATEGORIA` / `CONCORRENTE` (descobertas no marketplace) + `IDEIA_GERADA` (autoria Mahou inspirada no mercado — `externalId` é cuid local prefixado `IG-`, não Shopee item). Use `IDEIA_GERADA` quando a oportunidade for proposta autoral (variação, combinação, ângulo único) e não cópia direta.
- **Cadastro de Concorrente Shopee via REST**: `POST /api/v1/concorrentes/from-link { url }` aceita 2 formatos — `shopee.com.br/shop/{shopId}` (determinístico, prefira esse) ou `shopee.com.br/{username}` (slug). **URL de produto retorna 500** — resolver só trata os 2 formatos acima. Não existe tool MCP de cadastro (decisão consciente — é ato deliberado humano).
- **Produtos dos concorrentes** (substituiu o Gap analysis removido em 2026-05-23): `GET /api/v1/concorrentes/produtos` devolve formato denso `{ headers, rows }` (~50% menos tokens que JSON tradicional) com snapshot mais recente de cada loja. Filtros: `concorrenteId`, `vendasMin`, `precoMinCentavos/Maxima`, `q` (busca), `sortBy`, `limit`. Tool MCP `listar_produtos_concorrentes` consome isso.
- **`buscar_oportunidades` com `tipo: 'concorrente'`** aceita `concorrenteId` (interno, lê snapshot local rápido) OU `lojaExternalId` (shopId Shopee, chama Affiliate API ao vivo sem precisar cadastrar). Use `lojaExternalId` pra investigar loja descoberta antes de decidir cadastrar.

## Imagens e storage
- `ProdutoImagem.arquivo` é path relativo a `STORAGE_DIR`: `produtos/<produtoId>/<uuid>.jpg`. Cascade na deleção do produto via Prisma `onDelete: Cascade`.
- Sharp normaliza tudo pra JPG progressive 88% quality, max 2000px no maior lado. Original é descartado.
- `MediaUrlService.publicUrl(arquivo)` resolve URL absoluta: lê `MEDIA_BASE_URL` da env e prefixa. Backend nunca devolve path relativo — sempre absoluta. Pra migrar pra Cloudflare R2 ou S3 no futuro, basta trocar essa classe.
- Sem GC de órfãos hoje. Se `unlink` falhar no DELETE, o DB row é removido mesmo assim — orfão pode ser limpo manualmente depois (raro).
- Container roda como user `app` (uid 100, gid 101 no Debian-slim). `/var/mahou-storage` na VPS precisa estar `chown 100:101` pra upload funcionar.

## Auth e API tokens
- JWT vai por cookie (`mahou_token`, HttpOnly, SameSite=Lax) ou header `Authorization: Bearer`. JwtStrategy aceita os dois.
- `POST /api/v1/auth/api-token` (autenticado) gera JWT de longa duração (TTL 1..365 dias) pra fluxos automáticos. Mesmo payload do login normal — funciona em todos os endpoints protegidos. Sem rastreio/revogação por token: pra invalidar emergencialmente, rotacionar `JWT_SECRET` no servidor (invalida TUDO, incluindo sessões ativas).
- Token é exibido uma única vez na UI; consumer copia e cola no `.env`.

## O que NÃO fazer
- Não adicionar bibliotecas sem checar `package.json` — provavelmente já existe equivalente.
- Não criar abstrações para "futuro" — três linhas duplicadas é melhor que abstração prematura.
- Não usar `--no-verify` em commits. Se o hook falhou, conserte a causa.
- Não criar documentação `.md` nova sem ser pedido explicitamente.
- Não rodar `prisma migrate reset` em ambiente compartilhado sem confirmação.
- Não rastrear API tokens por enquanto. Se precisar, modelar `ApiKey` separado (não enriquecer `Usuario`).

## Padrões reutilizáveis (não duplicar)
- **Bulk delete**: endpoint `POST /<resource>/bulk-delete { ids }` com `BulkDeleteSchema` de `@mahou-hub/contracts/common.ts`. Soft-delete em Produto (`ativo=false`), hard em Venda/Custo.
- **Bulk mark anunciado**: `POST /produtos/bulk-anunciar { ids, anunciado }`.
- **Hooks de tabela**: `useTableSelection` (modo seleção opcional + Set<id>) e `useTableSort` (asc/desc/idle) em `apps/web/lib/`. Aplicar nas tabelas longas (produtos, vendas, custos, insumos).
- **Componentes de UI**: `SortableHead`, `SelectionToolbar`, `Checkbox` (shadcn), `DatePicker`, `MonthPicker`, `UploadDropzone`, `ImagensSection`. Reusar; não criar variantes paralelas.

## Setup Windows (dev)
- **Antivirus EPERM no Prisma generate**: Windows Defender (e similares) bloqueiam o rename do `query_engine-windows.dll.node` durante `prisma generate`. Adicione exclusão no PowerShell **como admin** (uma vez por máquina):
  ```powershell
  Add-MpPreference -ExclusionPath "$(Resolve-Path .\node_modules)"
  ```
  Em Linux/Docker (prod) não acontece.

## MCP server (Claude Code/Desktop)
- `mcp-servers/mahou-hub/` expõe **22 tools** pro Claude (10 oportunidades + 12 catálogo).
- Onboarding completo + lista de tools agrupadas + fluxos típicos em `mcp-servers/mahou-hub/README.md` (passo-a-passo 5min).
- Pra adicionar novas áreas de tools: criar `tools-<area>.ts`, importar em `src/index.ts`. Schemas Zod replicados localmente (sem dep em contracts) pra manter o MCP server publicável standalone.
- **`.mcp.json` usa `node --env-file=./mcp-servers/mahou-hub/.env.local`** (Node 20.6+ nativo). `${VAR}` no `.mcp.json` **NÃO é interpolado** pelo Claude Code — usar shell env causa 401 silencioso (passou string literal pro filho).
- **`zodToJsonSchema(s)` sem `target: 'openApi3'`** — OpenAPI 3.0 gera `nullable: true` que viola JSON Schema draft 2020-12 (exigido pela Anthropic API). Erro 400 derruba TODAS as 22 tools de uma vez.

## Skills de conteúdo (Claude Code slash commands)
- `.claude/skills/<nome>/SKILL.md` — skills slash command que automatizam tarefas editoriais. **Diferente do MCP server**: skills são instruções em texto pro agente seguir (sem código); MCP tools são funções TypeScript que retornam dados. Skills usam MCP tools quando precisam ler do banco.
- **Skills atuais:**
  - `oportunidades-mahou/` — descobre produtos do mercado pra entrar no catálogo (multi-arquivo: SKILL.md + criterios-3d.md + exemplos/ + scoring.md + geracao-ideias.md)
  - `gerar-imagem/` — gera fotos de produto via Google Flow + Nano Banana Pro (automação Playwright)
  - `gerar-descricao/` — títulos e descrições pra Shopee/ML/TikTok com fórmula universal USP-first
  - `gerar-post/` — posts pra @MahouPrints (copy + hashtags + roteiros de vídeo + descrições de imagem pra `/gerar-imagem`)
- **Skills consomem `content/`** (regras, catálogo, templates, tom). Paths nos `SKILL.md` versionados usam `content/...` (relativo ao repo).
- **Sync pra uso global** (`~/.claude/commands/`): `bash scripts/sync-skills.sh`. O script espelha skills single-file ajustando paths de `content/...` pra `~/Marketplace/`, `~/Instagram/`, `~/ImageGen/`, `~/.claude/projects/.../memory/`. Skills multi-arquivo (`oportunidades-mahou`) são puladas — pra essas, abre Claude Code dentro do repo (project-level skills são lidas automaticamente).
- **Fluxo:** repo é fonte da verdade. Edita SKILL.md no repo, commita, roda `sync-skills.sh` localmente. Nunca edite `~/.claude/commands/` direto — drift impossível de rastrear.
- **Outputs das skills NÃO vão pro repo** (`.gitignore` bloqueia `content/instagram/posts/`, `content/marketplace/listings/`). Outputs personalizados contêm dados de clientes reais.

## Comandos úteis
- `pnpm dev` — sobe web + api em modo dev.
- `pnpm test` — roda testes do pricing + api (Vitest).
- `pnpm lint` — ESLint v9 flat config (raiz) + Prettier check.
- `pnpm typecheck` — typecheck em todos os pacotes (rode antes de commitar mudanças que cruzam contracts/pricing/api/web).
- `pnpm --filter api exec prisma migrate dev` — nova migration.
- `pnpm --filter api exec prisma studio` — UI do banco.
- `pnpm --filter @mahou-hub/contracts build` — obrigatório após mexer em `packages/contracts/src/` pra typecheck do api/web pegar os tipos novos.

## Deploy
- Push na `main` dispara CI + deploy automático. `apps/api/**` ou `packages/**` trigam build da imagem Docker no GitHub Actions → push pra `ghcr.io/mahouprints/mahou-hub-api:latest` → pull na VPS via SSH + `prisma migrate deploy`. Vercel rebuilda o front em paralelo.
- Secrets de produção vivem em `/opt/mahou-hub/infra/.env.prod` na VPS (não comitado, excluído do rsync). Nunca jogar valores aí no repositório.
- Imagem Docker é Debian-slim (não Alpine) por causa do binário do Prisma + libssl. Não mudar pra Alpine.
- `/var/mahou-storage` na VPS é mapeado via volume Docker no `docker-compose.yml` (`STORAGE_HOST_DIR:/app/storage`). Diretório precisa existir + ter owner `100:101` antes do primeiro upload.
- `media.mahouprints.com` é um site Nginx separado que serve `/var/mahou-storage` direto com Cache-Control 30d. SSL via Certbot. CORS libera `https://hub.mahouprints.com`.
