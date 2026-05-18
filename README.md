# Mahou Hub

Hub de gerenciamento da **Mahou Prints**. Substitui a planilha `Farm 3D` por uma aplicação web com cálculo de custo/margem, simulador, plano de produção, gestão de catálogo, controle de vendas, custos e insumos.

- **Frontend:** Next.js 15 em `hub.mahouprints.com` (Vercel)
- **Backend:** NestJS + Prisma + PostgreSQL em `api.mahouprints.com` (VPS Hetzner)

## Estrutura

```
apps/
  web/         Next.js 15 (App Router) — UI completa do Hub
  api/         NestJS + Prisma — REST API protegida por JWT
packages/
  pricing/    Cálculos de custo/margem (puros, testáveis)
  contracts/  Schemas Zod compartilhados entre front e back
infra/
  docker-compose.yml   Postgres local + perfil prod (api via GHCR)
  .env.prod.example    Template das envs de produção
.github/workflows/
  ci.yml             Typecheck + testes em todo push/PR
  deploy-api.yml     Build da imagem no GitHub Actions → push GHCR → pull na VPS
```

## Módulos

| Módulo | Rota web | Endpoints API | O que faz |
| --- | --- | --- | --- |
| **Calculadora** | `/calculadora` | `POST /pricing/calcular` | Cálculo stateless de viabilidade de produto hipotético |
| **Produtos** | `/produtos` | `/produtos`, `/produtos/:id/estatisticas` | Catálogo CRUD + detalhe com pricing breakdown + histórico de vendas/produção |
| **Insumos** | `/insumos` | `/insumos` | Cadastro mestre de componentes (caixa, fita, etiqueta). Cada produto referencia N insumos com qtd |
| **Simulador** | `/simulador` | `POST /pricing/simular` | Projeta produção mensal (horas × utilização) → faturamento/lucro |
| **Produção** | `/producao` | `/producao` | Kanban de jobs de impressão (FILA → IMPRIMINDO → CONCLUIDO …) |
| **Financeiro** | `/financeiro` | `/financeiro/resumo?mes=YYYY-MM` | Dashboard com faturamento, custos gerais, custos com insumos, lucro líquido + margem |
| · Vendas | `/financeiro/vendas` | `/vendas` | Lançamento de vendas (produto, qtd, preço real, canal, data) |
| · Custos | `/financeiro/custos` | `/custos` | Custos gerais lançados manualmente. Marca `recorrente` gera 12 cópias futuras |
| **Concorrentes** | `/concorrentes` | `/concorrentes`, `/concorrentes/:id/precos` | Tracking de preços de concorrentes |
| **Configurações** | `/configuracoes` | `/parametros`, `/filamentos`, `/parametros/taxas/{shopee,ml}` | Parâmetros globais, filamentos, tabelas de taxa Shopee/ML |

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
#    (filamentos, parâmetros, taxas Shopee/ML, concorrentes, produtos
#    + usuário admin lendo ADMIN_EMAIL / ADMIN_INITIAL_PASSWORD do .env)
pnpm --filter api exec prisma db seed

# 6. Rodar web + api em modo dev
pnpm dev
```

Web: http://localhost:3001 · API: http://localhost:3000

O seed é idempotente (usa `upsert`), pode rodar várias vezes sem duplicar registros. Os dados ficam congelados em `apps/api/prisma/seed/*.ts` — não dependem do XLSX original.

## Deploy

Push na `main` dispara dois workflows do GitHub Actions:

1. **`ci.yml`** — builda `@mahou-hub/contracts` e `@mahou-hub/pricing`, depois roda typecheck no `api` e `web` (Postgres ephemeral via service container).
2. **`deploy-api.yml`** (só se mudou `apps/api/**`, `packages/**`, `infra/**` ou o próprio workflow):
   - Builda a imagem Docker no runner do GitHub (1.5GB de pico, fora da VPS).
   - Publica em `ghcr.io/mahouprints/mahou-hub-api:latest`.
   - SSH na VPS: `docker pull` + `docker compose up -d` + `prisma migrate deploy`.

Vercel rebuilda o frontend automaticamente em todo push. O Ignored Build Step (configurado no painel Vercel) pula o build quando só `apps/api/**` ou `infra/**` mudaram.

VPS já tem `Insumo` e `Custo` em produção desde 2026-05-17. Segredos vivem em `.env.prod` no diretório `/opt/mahou-hub/infra` da VPS — **não comitado** e excluído do rsync.

## Comandos úteis

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | sobe web + api em modo dev (Turbo) |
| `pnpm test` | roda todos os testes (Vitest + Playwright) |
| `pnpm lint` | ESLint + Prettier check |
| `pnpm typecheck` | type-check em todos os pacotes |
| `pnpm --filter api exec prisma migrate dev` | cria/aplica nova migration |
| `pnpm --filter api exec prisma studio` | UI do banco |
| `pnpm --filter api exec prisma db seed` | repopula dados base |
| `pnpm --filter api run seed:admin` | recria só o usuário admin |

## Status

- [x] Bootstrap do monorepo + setup de dev
- [x] Backend core (auth, produtos, filamentos, parâmetros, taxas, pricing)
- [x] Frontend MVP (login, calculadora, produtos, simulador, configurações)
- [x] Módulo Financeiro (vendas, custos manuais, dashboard)
- [x] Módulo Insumos (cadastro + integração ao pricing dos produtos)
- [x] Deploy automatizado (CI/CD GHCR → VPS Hetzner + Vercel)
- [ ] Módulo Produção retrabalhado (kanban + consumo mensal)
- [ ] Testes E2E completos (Playwright)
- [ ] Filtros avançados e relatórios anuais no financeiro

## Para agentes de IA

Instruções específicas de estilo, convenções e decisões de produto estão em `CLAUDE.md`. Leia antes de mexer no código.
