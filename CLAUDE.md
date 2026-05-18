# Mahou Hub — instruções para agentes

Idioma: responda sempre em **pt-BR**. Commits, comentários e PRs em pt-BR.

## Stack
Monorepo pnpm + Turborepo. `apps/web` = Next.js 15 (Vercel, domínio `hub.mahouprints.com`). `apps/api` = NestJS + Prisma + PostgreSQL (VPS, domínio `api.mahouprints.com`). `packages/pricing` e `packages/contracts` são compartilhados entre front e back.

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
- Vitest para `packages/*` e `apps/api`. Playwright para fluxos críticos em `apps/web`.
- Cobertura mínima: 90% em `packages/pricing` (núcleo financeiro), 70% no resto.
- Todo teste roda com `pnpm test` sem setup manual. Banco de teste sobe via `docker compose -f infra/docker-compose.test.yml up -d`.
- Toda função pública nova precisa de teste. Bug corrigido precisa de teste de regressão.

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
- `Parametro` é singleton (id=1). Reescreva o registro existente em vez de criar novo.
- Status de `JobProducao` muda só por endpoint específico (`PATCH /producao/:id/status`), nunca por `update` genérico.
- `Filamento` e `Insumo` nunca são deletados, só marcados `ativo=false` (referenciados por Produtos antigos e Vendas históricas).
- `Calculadora` (`/calculadora`) é stateless e não toca o banco. `Simulador` opera sobre produtos já cadastrados.
- Diferença Calculadora × Simulador: Calculadora valida viabilidade unitária de produto **hipotético**; Simulador projeta produção de produto **cadastrado**.
- `Produto.embalagemCentavos` coexiste com `Insumo` — embalagem é o atalho pra custos sem rastreio; insumos é pra itens cadastrados (caixa, fita). Os dois somam no `custoTotalProducao`.
- `Custo` com `recorrente=true` na criação dispara geração de 12 cópias mensais subsequentes (`geradoAutomatico=true`, `recorrente=false` pra não cascatear). Cada cópia é editável/deletável individualmente.
- Dashboard financeiro separa **custos variáveis** (filamento+energia+embalagem) de **custos com insumos** (consumo via `ProdutoInsumo`). Não juntar — são apresentados em cards distintos. Lucro líquido desconta os dois + impostos + taxas + custos gerais.
- Sync de coleção filha (`ProdutoInsumo`, `PrecoConcorrente`): `deleteMany` + `createMany` dentro de transação. Não tente diff incremental — o ganho não compensa a complexidade.

## O que NÃO fazer
- Não adicionar bibliotecas sem checar `package.json` — provavelmente já existe equivalente.
- Não criar abstrações para "futuro" — três linhas duplicadas é melhor que abstração prematura.
- Não usar `--no-verify` em commits. Se o hook falhou, conserte a causa.
- Não criar documentação `.md` nova sem ser pedido explicitamente.
- Não rodar `prisma migrate reset` em ambiente compartilhado sem confirmação.

## Comandos úteis
- `pnpm dev` — sobe web + api em modo dev.
- `pnpm test` — roda todos os testes (Vitest + Playwright).
- `pnpm lint` — ESLint + Prettier check.
- `pnpm typecheck` — typecheck em todos os pacotes (rode antes de commitar mudanças que cruzam contracts/pricing/api/web).
- `pnpm --filter api exec prisma migrate dev` — nova migration.
- `pnpm --filter api exec prisma studio` — UI do banco.
- `pnpm --filter @mahou-hub/contracts build` — necessário depois de mexer em `packages/contracts/src/` antes do typecheck do api/web pegar as mudanças.

## Deploy
- Push na `main` dispara CI + deploy automático. `apps/api/**` ou `packages/**` trigam build da imagem Docker no GitHub Actions → push pra `ghcr.io/mahouprints/mahou-hub-api:latest` → pull na VPS via SSH + `prisma migrate deploy`. Vercel rebuilda o front em paralelo.
- Secrets de produção vivem em `/opt/mahou-hub/infra/.env.prod` na VPS (não comitado, excluído do rsync). Nunca jogar valores aí no repositório.
- Imagem Docker é Debian-slim (não Alpine) por causa do binário do Prisma + libssl. Não mudar pra Alpine.
