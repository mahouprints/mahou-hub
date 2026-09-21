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

A aba **Produtos** reúne o catálogo independentemente de anúncio ou origem MakerWorld. **Novo produto** cadastra peças avulsas, com insumos e quantidades por unidade. Arquivar retira o item do catálogo ativo e das opções de estoque sem apagar vendas, insumos vinculados ou histórico; o filtro **Arquivados** permite restaurar. `/vitrine` é apenas um acesso de compatibilidade à mesma tela.

Os custos das vendas são calculados com os dados atuais do produto e dos insumos. Alterar o custo ou a composição de um produto também altera o cálculo dos relatórios históricos; não há snapshot de custo na venda.

O cadastro aceita vários filamentos, cada um com gramas por unidade (até duas casas decimais). O peso total é a soma da composição; o custo soma cada peso pelo preço/kg do respectivo filamento e arredonda só o total. A energia usa o primeiro filamento como referência de potência e o tempo total da peça, uma única vez. Catálogo, preview, simulador e financeiro usam essa composição; no financeiro, o custo por unidade é multiplicado pela quantidade vendida. Cadastros antigos continuam funcionando com o filamento único.

Na produção, cada filamento é baixado separadamente e o consumo efetivo fica registrado no job para estorno. Variações de produtos com múltiplos filamentos devem herdar a composição, sem substituir silenciosamente toda a receita por uma cor ou um peso diferente. Na API, `filamentos: [{filamentoId, pesoG}]` substitui a lista completa; omitir a lista preserva a composição existente. `filamentoId` e `pesoG` do produto continuam disponíveis para compatibilidade (primeiro material e peso total).

| Módulo | Rota web | Endpoints API | O que faz |
| --- | --- | --- | --- |
| **Calculadora** | `/calculadora` | `POST /pricing/calcular` | Cálculo stateless de viabilidade de produto hipotético |
| **Produtos** | `/produtos` | `/produtos`, `/produtos/:id/estatisticas`, `/produtos/:id/imagens` | Catálogo de produtos manuais e importados, custos por unidade, cadastro, edição, arquivamento e restauração; histórico e imagens no detalhe |
| **Insumos** | `/insumos` | `/insumos` | Cadastro mestre de componentes (caixa, fita, etiqueta). Cada produto referencia N insumos com qtd; custo entra no pricing |
| **Simulador** | `/simulador` | `POST /pricing/simular` | Projeta produção mensal (horas × utilização) → faturamento/lucro |
| **Produção** | `/producao` | `/producao` | Kanban de jobs de impressão (FILA → IMPRIMINDO → CONCLUIDO …) |
| **Financeiro** | `/financeiro` | `/financeiro/resumo?mes=YYYY-MM` | Dashboard com faturamento, custos gerais, custos com insumos, lucro líquido + margem |
| · Vendas | `/financeiro/vendas` | `/vendas` (+ `/bulk-delete`) | Lançamento de vendas (produto, qtd, preço real, canal, data) |
| · Custos | `/financeiro/custos` | `/custos` (+ `/bulk-delete`) | Custos gerais lançados manualmente. Marca `recorrente` gera N cópias futuras (configurável 1..60, default 12) |
| · Relatórios | `/financeiro/relatorios` | `/financeiro/relatorio?periodo=DIARIO&referencia=2026-09-10`, `/relatorios/*` | Consulta diária, semanal, mensal e anual; gráficos, planilhas Google e e-mails |
| **Concorrentes** | `/concorrentes` | `/concorrentes`, `/concorrentes/:id/precos` | Tracking de preços de concorrentes |
| **Configurações** | `/configuracoes` | `/parametros`, `/filamentos`, `/parametros/taxas/{shopee,ml}` | Parâmetros globais (incluindo as 4 taxas TikTok), filamentos, tabelas Shopee/ML, gerar token de API |

**Canais de venda suportados:** SHOPEE, ML, SITE, TIKTOK. Taxas TikTok são 4 percentuais configuráveis em `Parametro` (comissão plataforma, SFP, afiliado, processamento de pagamento).

## Prospecção MakerWorld: brinquedos flexi

Em `scripts/makerworld`, `npm run flexi` procura modelos flexi/articulados nas categorias do
bot, verifica a licença comercial e prepara fotos, links e estimativas para a aba MakerWorld.
O limite é **60 g por trabalho de impressão** e **2 horas por padrão**; o tempo pode ser
ajustado. O bot não divide gramas/horas por peças ou placas para fazer um perfil caber no teto.

```powershell
cd scripts/makerworld
npm install
npm run flexi -- --max-horas 2 --paginas 3 --limite 80
# Quando a listagem estiver bloqueada, use IDs de modelos encontrados em páginas públicas:
npm run flexi -- --ids 892737,1530421 --max-horas 2
# Reprocessa respostas JSON já salvas, sem rede; arquivos devem se chamar <id>.json:
npm run flexi -- --amostras dados/amostras --ids 892737,1530421
npm run flexi-subir
npm run flexi-subir -- --confirmar
npm run test:flexi
```

No Windows, o coletor nativo atualiza uma lista de IDs públicos antes da triagem. Exemplo
com os 11 modelos verificados nesta pesquisa, a partir de `scripts/makerworld`:

```powershell
.\coletar-flexi.ps1 -Ids 1419875,1272708,103585,892737,145302,1231393,2187790,706106,2383771,2727631,2727635 -MaxHoras 2
```

Esse comando usa `Invoke-RestMethod` com identificação `MahouPrintsProspector/1.0`, salva
as respostas completas e a proveniência em uma pasta exclusiva de `dados/amostras/` e
executa a triagem somente sobre essa coleta. Aceita até 200 IDs positivos e interrompe no
primeiro erro, sem reaproveitar arquivos antigos nem tentar novamente um bloqueio HTTP.
Ele não importa no Hub. A descoberta automática por categorias continua dependendo do
acesso permitido pelo servidor; o wrapper coleta apenas a lista de IDs fornecida.

`--max-gramas` aceita um limite menor, até 60; `--paginas` é por categoria (1..50) e
`--limite` limita modelos detalhados (1..200). A consulta usa identificação própria e pausa
entre requisições. HTTP 403/429 interrompe a coleta: não há tentativa de contornar o bloqueio.

Os arquivos locais `dados/flexi-relatorio.json` e `dados/flexi-payload.json` guardam a revisão e
o lote `{ modelos: [...] }` para importar no Hub. O relatório separa candidatos, pendentes e
rejeitados com motivos. **AMS sem consumo de purga informado fica pendente e fora do lote.**
No modo `--amostras`, o relatório guarda a origem do arquivo; a justificativa mostra somente
sua data, sem afirmar nova consulta ao site. Sem `--ids`, todos os JSONs `<id>.json`
desse diretório são reprocessados, respeitando `--limite`.
Perfis sem peso/tempo ou sem imagem própria são rejeitados. O bot privilegia múltiplas cores
declaradas entre os perfis elegíveis e mantém imagem, peso, tempo e link do mesmo perfil.

O filtro é uma heurística de metadados: apelo visual, cores, purga, impressora e configuração
devem ser conferidos no fatiador. Os candidatos chegam como `TALVEZ`, sem avaliação visual,
com score objetivo; `notaIa: 0` é somente a sentinela exigida pelo contrato legado, nunca uma
nota atribuída por IA. Custos/preços usam as estimativas existentes do bot e cada anúncio
tem `unidadesPorKit: 1`.

`flexi-subir` simula por padrão. Com `--confirmar`, lê `MAHOU_API_TOKEN` e, opcionalmente,
`MAHOU_API_BASE` do ambiente ou `.env.local` já usado pelo bot/MCP e faz upsert no endpoint
`/makerworld/bulk-import`. Reexecutar não duplica modelos. Coleta incompleta esvazia o lote e
impede envio; nenhuma licença desconhecida é tratada como permitida. O fluxo geral de
prospecção e curadoria por IA continua disponível nos comandos anteriores.

## Relatórios e Google Sheets

Vendas e custos mostram suas observações abaixo do lançamento, com expansão quando passam de duas linhas. O relatório usa o mesmo cálculo do resumo mensal e inclui vendas arquivadas, filamentos, insumos por unidade, impostos, taxas e custos gerais por competência. Compras de estoque não são somadas novamente. Datas são dias civis, sem deslocamento por fuso.

Em **Financeiro → Relatórios → Configurar envios**, salve a conta proprietária Google e os destinatários. O Hub gera um código Apps Script específico da instalação. Crie um projeto nessa conta, cole o código, execute `autorizarIntegracao` e autorize as permissões. Implante como aplicativo web, executando como você, com acesso “Qualquer pessoa”; cole a URL `/exec` no Hub. A URL só aceita pedidos assinados pelo servidor e as planilhas permanecem privadas, compartilhadas para leitura apenas com os destinatários configurados. Confirme um envio manual antes de ativar a agenda.

A API agenda os fechamentos às **08:00 America/Bahia**: segunda-feira (semana anterior, segunda a domingo), dia 1 (mês anterior) e 1º de janeiro (ano anterior). **Diário é somente consulta e envio manual**. O cursor persistido retoma fechamentos perdidos após indisponibilidade, sem enviar períodos anteriores à ativação. Falhas têm até cinco tentativas com intervalo crescente; o histórico mostra o erro e permite solicitar novamente.

Cada fechamento enviado guarda seu retrato financeiro e link; pedidos repetidos retornam a mesma planilha, sem duplicar e-mails. Períodos abertos têm uma prévia por dia, separada do fechamento. A consulta no Hub continua usando o cadastro atual. O receptor mantém controle próprio de idempotência: se um envio de e-mail ficar ambíguo, exige conferência do histórico do Apps Script em vez de enviar novamente às cegas.

O segredo Google fica cifrado no banco com uma chave derivada de `JWT_SECRET`, nunca aparece na consulta de configuração e somente administradores podem gerar o código. Trocar conta/destinatários invalida a implantação anterior: prepare e implante o novo código. Rotacionar `JWT_SECRET` exige preparar novamente a integração Google (com a nova chave), além de invalidar as sessões.

## API pública (integrações externas)

A API REST do Hub é pensada pra consumo por automações (n8n, Make, Zapier, scripts). Base: `https://api.mahouprints.com/api/v1` (prod) ou `http://localhost:3000/api/v1` (dev). Versionada — quando precisar quebrar contrato, sobe um `/api/v2` em paralelo e mantém `v1` por um período.

### Documentação interativa

- **Swagger UI**: `https://api.mahouprints.com/api/v1/docs` — UI navegável, "Try it out" embutido. Clica em **Authorize** e cola o token Bearer.
- **OpenAPI spec (JSON)**: `https://api.mahouprints.com/api/v1/docs-json` — alimentação direta de geradores de client (Postman, n8n, OpenAPI Generator).

### Autenticação

1. Em `/configuracoes` → card **Acesso por API** → "Gerar token" (TTL 1..365d). Resposta é exibida **uma única vez** — copie e guarde.
2. Cada request passa o header `Authorization: Bearer <token>`. Não precisa de cookies pra fluxos automáticos.
3. Pra invalidar emergencialmente, rotacione `JWT_SECRET` no servidor — não há revogação por token.

### Endpoints mais úteis pra consumers

| Caso de uso | Endpoint | Notas |
|---|---|---|
| Listar produtos do catálogo | `GET /produtos` | Filtros: `anunciado`, `canal`, `q`, `page`, `pageSize`, `sortBy`, `sortDir`. Headers: `X-Total-Count` etc. |
| Produto específico + imagens + insumos | `GET /produtos/:id` | URLs absolutas via `media.mahouprints.com` |
| Marcar produtos como publicados | `POST /produtos/bulk-anunciar` | Body: `{ ids: string[], anunciado: boolean }` |
| Listar lojas concorrentes (com vendas estimadas/mês) | `GET /concorrentes` | Inclui `vendasEstimadasMesTotal` agregado |
| Produtos de uma loja concorrente (snapshot mais recente) | `GET /concorrentes/:id/produtos` | Atalho que evita 3 round-trips |
| Histórico de snapshots de uma loja | `GET /concorrentes/:id/snapshots` | Pra séries temporais |
| Resumo financeiro mensal | `GET /financeiro/resumo?mes=2026-05` | Lucro líquido + breakdown de custos |
| Health check | `GET /healthz` | Sem `/api` no caminho, sem auth |

### Paginação e busca em `/produtos`

Sem query params, comportamento histórico: devolve **array completo** dos produtos ativos. Com paginação, devolve só a fatia pedida.

Query params:
- `q` — busca textual case-insensitive em `nome` + `inspiracao`
- `canal` — `SHOPEE | ML | SITE | TIKTOK`
- `ativo` — `true | false` (default `true`; `false` consulta os arquivados)
- `anunciado` — `true | false`
- `page` (≥1), `pageSize` (≤200, default 50 se só `page` for passado)
- `sortBy` — `criadoEm | atualizadoEm | nome | precoCentavos` (default `criadoEm`)
- `sortDir` — `asc | desc` (default `desc`)

Headers de resposta (sempre presentes):
- `X-Total-Count` — total absoluto que casa com o filtro (independente da página).
- `X-Page`, `X-Page-Size` — só quando paginou.

### Rate limit

Padrão global: **100 requests/min por IP**. Resposta 429 quando excede. `/healthz` está isento (uptime checkers podem espumar).

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
  "https://api.mahouprints.com/api/v1/produtos?anunciado=false"

# 1b) Buscar produtos com "vaso" no nome, paginado
curl -i -H "Authorization: Bearer $TOKEN" \
  "https://api.mahouprints.com/api/v1/produtos?q=vaso&page=1&pageSize=20&sortBy=nome&sortDir=asc"
# resposta inclui X-Total-Count: 47 no header

# 2) Produtos do snapshot mais recente da loja concorrente abc123
curl -H "Authorization: Bearer $TOKEN" \
  https://api.mahouprints.com/api/v1/concorrentes/abc123/produtos

# 3) Marcar produtos como anunciados após publicar
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"ids":["p1","p2"],"anunciado":true}' \
  https://api.mahouprints.com/api/v1/produtos/bulk-anunciar
```

### Exemplo: fluxo de geração de imagem (n8n)

Caso real em produção pra publicar produtos no Shopee/ML com imagens geradas via Gemini 2.5 Flash:

1. Pré-upload das imagens de referência em `/produtos/<id>` (card Imagens) — origem `INSPIRACAO` ou `MODELO_3D`. Sharp normaliza pra JPG 90% max 2000px no upload.
2. Consumer chama `GET /api/v1/produtos?anunciado=false`. Resposta traz imagens com URLs absolutas, filamento, insumos, dimensões — tudo num único request.
3. Após processar e publicar, `POST /api/v1/produtos/bulk-anunciar { ids: [...], anunciado: true }` tira do pool.

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
- [x] Relatórios diários, semanais, mensais e anuais com Google Sheets e e-mail
- [ ] Captura automática de imagem a partir de URL (Shopee/MakerWorld scraping)

## Para agentes de IA

Instruções específicas de estilo, convenções e decisões de produto estão em `CLAUDE.md`. Leia antes de mexer no código.
