# Mahou Hub

Hub de gerenciamento da **Mahou Prints**. Substitui a planilha `Farm 3D` por uma aplicação web com cálculo de custo/margem, simulador, plano de produção (kanban) e gestão de catálogo.

- **Frontend:** Next.js 15 em `hub.mahouprints.com` (Vercel)
- **Backend:** NestJS + Prisma + PostgreSQL em `api.mahouprints.com` (VPS)

## Estrutura

```
apps/
  web/         Next.js 15 (App Router)
  api/         NestJS + Prisma
packages/
  pricing/     Cálculos de custo/margem (puros, testáveis)
  contracts/   Schemas Zod compartilhados
infra/
  docker-compose.yml
  Caddyfile
```

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

## Roadmap

- [x] Fase 0 — Bootstrap do monorepo
- [ ] Fase 1 — Backend mínimo (CRUD + pricing)
- [ ] Fase 2 — Frontend MVP (login, calculadora, produtos, simulador)
- [ ] Fase 3 — Produção retrabalhada (kanban + consumo mensal)
- [ ] Fase 4 — Deploy (Vercel + VPS)

## Para agentes de IA

Instruções específicas de estilo, convenções e decisões de produto estão em `CLAUDE.md`. Leia antes de mexer no código.
