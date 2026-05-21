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
- **Estado real (2026-05):** só `packages/pricing` tem testes Vitest (22 testes em calculadora/custos/taxas/simulador, ~100% coverage). `apps/api` e `apps/web` ainda sem testes; Playwright nunca foi configurado.
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
- Shopee Affiliate API expõe **só 19 campos** em `ProductOfferV2`. `sales` é janela de campanha (~30 dias via afiliado), NÃO histórico total. Vendas totais estimadas usam a heurística `(sales/dias)*30 / 0.05` (assumindo 5% das vendas via afiliado — média observada na 3DTECH). Não tente puxar histórico real via mobile-web `/api/v4/pdp/get_pc` — bloqueado por anti-fraud `x-sap-sec`.
- Comissão da Shopee (`commissionRate`, `commission`) é IRRELEVANTE pra Mahou (não recebemos como afiliado). UI esconde esses campos — métrica útil é vendas estimadas.

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
- `mcp-servers/mahou-hub/` expõe 21 tools pro Claude (oportunidades + catálogo).
- Onboarding completo em `mcp-servers/mahou-hub/README.md` (passo-a-passo 5min: gerar token → .env.local → build → abre Claude no repo).
- Pra adicionar novas áreas de tools: criar `tools-<area>.ts`, importar em `src/index.ts`. Schemas Zod replicados localmente (sem dep em contracts) pra manter o MCP server publicável standalone.

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
