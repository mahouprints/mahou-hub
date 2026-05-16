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
- pnpm 9
- Docker + Docker Compose (para Postgres local)

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

## Roadmap

Plano detalhado em `CLAUDE.md` (instruções para agentes) e no plano original do projeto.

- [x] Fase 0 — Bootstrap do monorepo
- [ ] Fase 1 — Backend mínimo (CRUD + pricing)
- [ ] Fase 2 — Frontend MVP (login, calculadora, produtos, simulador)
- [ ] Fase 3 — Produção retrabalhada (kanban + consumo mensal)
- [ ] Fase 4 — Deploy (Vercel + VPS)
