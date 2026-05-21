# Mahou Hub

Hub de gerenciamento da **Mahou Prints**. Substitui a planilha `Farm 3D` por uma aplicação web com cálculo de custo/margem, simulador, plano de produção, gestão de catálogo, controle de vendas, custos e insumos, e exposição de API pra fluxos externos de geração de imagem.

- **Frontend:** Next.js 15 em `hub.mahouprints.com` (Vercel)
- **Backend:** NestJS + Prisma + PostgreSQL em `api.mahouprints.com` (VPS Hetzner)
- **Storage de imagens:** `/var/mahou-storage` na VPS, servido em `media.mahouprints.com`

## Estrutura

```
apps/
  web/        Next.js 15 (App Router) — UI completa do Hub
  api/        NestJS + Prisma — REST API protegida por JWT
packages/
  pricing/    Cálculos de custo/margem (puros, testáveis)
  contracts/  Schemas Zod compartilhados entre front e back
infra/
  docker-compose.yml   Postgres local + perfil prod (api via GHCR + volume storage)
  .env.prod.example    Template das envs de produção
.github/workflows/
  ci.yml             Typecheck + testes em todo push/PR
  deploy-api.yml     Build da imagem no GitHub Actions → push GHCR → pull na VPS
```

## Módulos

| Módulo | Rota web | Endpoints API | O que faz |
| --- | --- | --- | --- |
| **Calculadora** | `/calculadora` | `POST /pricing/calcular` | Cálculo stateless de viabilidade de produto hipotético |
| **Produtos** | `/produtos` | `/produtos`, `/produtos/:id/estatisticas`, `/produtos/:id/imagens` | Catálogo CRUD + detalhe com pricing breakdown + histórico + imagens de referência + flag `anunciado` |
| **Insumos** | `/insumos` | `/insumos` | Cadastro mestre de componentes (caixa, fita, etiqueta). Cada produto referencia N insumos com qtd; custo entra no pricing |
| **Simulador** | `/simulador` | `POST /pricing/simular` | Projeta produção mensal (horas × utilização) → faturamento/lucro |
| **Produção** | `/producao` | `/producao` | Kanban de jobs de impressão (FILA → IMPRIMINDO → CONCLUIDO …) |
| **Financeiro** | `/financeiro` | `/financeiro/resumo?mes=YYYY-MM` | Dashboard com faturamento, custos gerais, custos com insumos, lucro líquido + margem |
| · Vendas | `/financeiro/vendas` | `/vendas` (+ `/bulk-delete`) | Lançamento de vendas (produto, qtd, preço real, canal, data) |
| · Custos | `/financeiro/custos` | `/custos` (+ `/bulk-delete`) | Custos gerais lançados manualmente. Marca `recorrente` gera N cópias futuras (configurável 1..60, default 12) |
| **Concorrentes** | `/concorrentes` | `/concorrentes`, `/concorrentes/:id/precos` | Tracking de preços de concorrentes |
| **Configurações** | `/configuracoes` | `/parametros`, `/filamentos`, `/parametros/taxas/{shopee,ml}` | Parâmetros globais (incluindo as 4 taxas TikTok), filamentos, tabelas Shopee/ML, gerar token de API |

**Canais de venda suportados:** SHOPEE, ML, SITE, TIKTOK. Taxas TikTok são 4 percentuais configuráveis em `Parametro` (comissão plataforma, SFP, afiliado, processamento de pagamento).

## API pública (integrações externas)

A API REST do Hub é pensada pra consumo por automações (n8n, Make, Zapier, scripts). Base: `https://api.mahouprints.com/api` (prod) ou `http://localhost:3000/api` (dev).

### Documentação interativa

- **Swagger UI**: `https://api.mahouprints.com/api/docs` — UI navegável, "Try it out" embutido. Clica em **Authorize** e cola o token Bearer.
- **OpenAPI spec (JSON)**: `https://api.mahouprints.com/api/docs-json` — alimentação direta de geradores de client (Postman, n8n, OpenAPI Generator).

### Autenticação

1. Em `/configuracoes` → card **Acesso por API** → "Gerar token" (TTL 1..365d). Resposta é exibida **uma única vez** — copie e guarde.
2. Cada request passa o header `Authorization: Bearer <token>`. Não precisa de cookies pra fluxos automáticos.
3. Pra invalidar emergencialmente, rotacione `JWT_SECRET` no servidor — não há revogação por token.

### Endpoints mais úteis pra consumers

| Caso de uso | Endpoint | Notas |
|---|---|---|
| Listar produtos do catálogo | `GET /produtos` | Filtro opcional `?anunciado=true\|false` |
| Produto específico + imagens + insumos | `GET /produtos/:id` | URLs absolutas via `media.mahouprints.com` |
| Marcar produtos como publicados | `POST /produtos/bulk-anunciar` | Body: `{ ids: string[], anunciado: boolean }` |
| Listar lojas concorrentes (com vendas estimadas/mês) | `GET /concorrentes` | Inclui `vendasEstimadasMesTotal` agregado |
| Produtos de uma loja concorrente (snapshot mais recente) | `GET /concorrentes/:id/produtos` | Atalho que evita 3 round-trips |
| Histórico de snapshots de uma loja | `GET /concorrentes/:id/snapshots` | Pra séries temporais |
| Resumo financeiro mensal | `GET /financeiro/resumo?mes=2026-05` | Lucro líquido + breakdown de custos |
| Health check | `GET /healthz` | Sem `/api` no caminho, sem auth |

### Convenções de serialização

- `BigInt` (ex: `Concorrente.shopId`, `ConcorrenteSnapshotProduto.itemId`) → **string** no JSON.
- `Decimal` (ex: `ratingStar`, `commissionRate`) → **string** no JSON pra preservar precisão.
- Valores monetários → **inteiros em centavos** (`Int`). Divida por 100 ao renderizar.
- Datas → ISO 8601 UTC.

### Exemplo curl

```bash
TOKEN=eyJhbGc...

# 1) Listar produtos não-anunciados
curl -H "Authorization: Bearer $TOKEN" \
  https://api.mahouprints.com/api/produtos?anunciado=false

# 2) Produtos do snapshot mais recente da loja concorrente abc123
curl -H "Authorization: Bearer $TOKEN" \
  https://api.mahouprints.com/api/concorrentes/abc123/produtos

# 3) Marcar produtos como anunciados após publicar
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"ids":["p1","p2"],"anunciado":true}' \
  https://api.mahouprints.com/api/produtos/bulk-anunciar
```

### Exemplo: fluxo de geração de imagem (n8n)

Caso real em produção pra publicar produtos no Shopee/ML com imagens geradas via Gemini 2.5 Flash:

1. Pré-upload das imagens de referência em `/produtos/<id>` (card Imagens) — origem `INSPIRACAO` ou `MODELO_3D`. Sharp normaliza pra JPG 90% max 2000px no upload.
2. Consumer chama `GET /api/produtos?anunciado=false`. Resposta traz imagens com URLs absolutas, filamento, insumos, dimensões — tudo num único request.
3. Após processar e publicar, `POST /api/produtos/bulk-anunciar { ids: [...], anunciado: true }` tira do pool.

## Pré-requisitos

- Node.js >= 22
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker + Docker Compose (para Postgres local)

## Setup local (primeira vez)

```bash
# 1. Clonar e instalar dependências
git clone https://github.com/mahouprints/mahou-hub.git
cd mahou-hub
pnpm install

# 2. Copiar os templates de variáveis de ambiente
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 3. Subir o Postgres local (porta 5432)
docker compose -f infra/docker-compose.yml up -d postgres

# 4. Rodar as migrations do Prisma
pnpm --filter api exec prisma migrate dev

# 5. Popular o banco com os dados originais da planilha Farm 3D
pnpm --filter api exec prisma db seed

# 6. Rodar web + api em modo dev
pnpm dev
```

Web: http://localhost:3001 · API: http://localhost:3000

Em dev, as imagens são servidas pelo próprio Nest em `http://localhost:3000/media/*` (via `ServeStaticModule`). Em prod, Nginx serve direto de `media.mahouprints.com`. O backend nunca devolve path relativo — `MediaUrlService` sempre absolutiza.

O seed é idempotente (usa `upsert`), pode rodar várias vezes sem duplicar registros.

## Deploy

Push na `main` dispara dois workflows do GitHub Actions:

1. **`ci.yml`** — builda `@mahou-hub/contracts` e `@mahou-hub/pricing`, depois roda typecheck no `api` e `web` (Postgres ephemeral via service container) + os testes unitários do pricing.
2. **`deploy-api.yml`** (só se mudou `apps/api/**`, `packages/**`, `infra/**` ou o próprio workflow):
   - Builda a imagem Docker no runner do GitHub (1.5GB de pico, fora da VPS).
   - Publica em `ghcr.io/mahouprints/mahou-hub-api:latest`.
   - SSH na VPS: `docker pull` + `docker compose up -d` + `prisma migrate deploy`.

Vercel rebuilda o frontend automaticamente em todo push. O Ignored Build Step (configurado no painel Vercel) pula o build quando só `apps/api/**` ou `infra/**` mudaram.

**Recursos persistentes na VPS** (não são tocados pelo deploy):
- `/opt/mahou-hub/infra/.env.prod` — secrets (POSTGRES_PASSWORD, JWT_SECRET, ADMIN_*, STORAGE_HOST_DIR, MEDIA_BASE_URL)
- `/var/mahou-storage` — diretório de imagens (owner uid `100:101` = user `app` no container Debian)
- Nginx site `api.mahouprints.com` → proxy `localhost:3100`
- Nginx site `media.mahouprints.com` → serve `/var/mahou-storage` direto (sem proxy)
- Certbot renova SSL automaticamente em ambos

## Comandos úteis

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | sobe web + api em modo dev (Turbo) |
| `pnpm test` | roda testes do `packages/pricing` (Vitest) — único módulo testado |
| `pnpm lint` | ESLint + Prettier check |
| `pnpm typecheck` | type-check em todos os pacotes |
| `pnpm --filter api exec prisma migrate dev` | cria/aplica nova migration |
| `pnpm --filter api exec prisma studio` | UI do banco |
| `pnpm --filter api exec prisma db seed` | repopula dados base |
| `pnpm --filter api run seed:admin` | recria só o usuário admin |
| `pnpm --filter @mahou-hub/contracts build` | obrigatório depois de mexer em contracts antes do typecheck cross-package pegar |

## Status

- [x] Bootstrap do monorepo + setup de dev
- [x] Backend core (auth, produtos, filamentos, parâmetros, taxas)
- [x] Pricing package com testes unitários (22 testes, ~100% coverage)
- [x] Frontend MVP (login, calculadora, produtos, simulador, configurações)
- [x] Módulo Financeiro (vendas, custos manuais com recorrência configurável, dashboard com KPIs)
- [x] Módulo Insumos (cadastro + integração ao pricing dos produtos)
- [x] Canal TikTok Shop com 4 taxas configuráveis
- [x] Sistema de imagens (upload, sharp, storage na VPS, CDN próprio)
- [x] Flag `anunciado` + API token de longa duração pra fluxos externos
- [x] Ordenação e seleção múltipla nas tabelas (produtos, vendas, custos, insumos)
- [x] Deploy automatizado (CI/CD GHCR → VPS Hetzner + Vercel)
- [ ] Testes em `apps/api` e `apps/web` (atualmente só pricing tem)
- [ ] E2E com Playwright (estrutura prevista no CLAUDE.md, ainda não implementado)
- [ ] Módulo Produção retrabalhado (kanban + consumo mensal)
- [ ] Relatórios anuais no financeiro
- [ ] Captura automática de imagem a partir de URL (Shopee/MakerWorld scraping)

## Para agentes de IA

Instruções específicas de estilo, convenções e decisões de produto estão em `CLAUDE.md`. Leia antes de mexer no código.
