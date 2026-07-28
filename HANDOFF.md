# Handoff — Mahou Hub (16/jun/2026)

> Continuação de uma sessão longa. **Tudo abaixo está commitado, pushado e deployado em produção.**
> Working tree limpa · `main` == `origin/main` (commit `fc0e2b6`) · prod no ar (`/healthz` = `db:true`).

## Como retomar num chat novo
Abra o Claude Code **nesta pasta** (`/Users/gabrielberger/Documents/mahou-hub`) e diga *"continuar o Mahou Hub"*.
A memória (`mahou-hub-project.md`) carrega o estado automaticamente. Leia o `CLAUDE.md` do repo antes de mexer no código.

## O que está NO AR (hub.mahouprints.com / api.mahouprints.com)
- **Estoque** (filamento/insumo): movimentações transacionais, bloqueio de saldo negativo, alerta de reposição, abas **Saldos (g+kg) / Histórico / Custos**.
- **Produção**: kanban Fila→Imprimindo→**Impresso**→Embalado→Enviado. Marcar Impresso → **baixa automática de filamento** (peso×qtd), permite negativo, `consumoRegistrado` evita baixa dupla.
- **Recibos**: compras com anexo de imagem ou PDF (as 3 NFs VOOLT já estão lá).
- **Variações/SKU**: só backend (`/variacoes`, modelo `ProdutoVariacao`) — falta a tela.
- **Safeguard**: produto com filamento desativado → flag `filamentoInativo` (aviso na tela de Produtos), **não quebra**.
- ~47 testes Vitest, typecheck/lint verdes.

## Comandos essenciais
- **Rodar local:** `pnpm dev` (api :3000, web :3001). Postgres via Docker (`mahou-hub-postgres`). Login local: `mahouprints@gmail.com` / senha em `apps/api/.env` (`ADMIN_INITIAL_PASSWORD`).
- **Deploy:** push na `main` → CI/CD (build Docker → VPS + `prisma migrate deploy`; Vercel rebuilda o front). Trabalhe em branch; **só pushe na main com OK explícito do Gabriel**.
- **Migration:** `pnpm --filter api exec prisma migrate dev --name <nome> --skip-seed`.
- **Ler/escrever na prod via API:** token em `mcp-servers/mahou-hub/.env.local` (`MAHOU_API_TOKEN`); base `https://api.mahouprints.com/api/v1`; header `Authorization: Bearer $MAHOU_API_TOKEN`. **Escrita em prod exige OK explícito do Gabriel** (o classifier bloqueia senão).

## Próximas ações (em ordem)
1. **Religar 3 produtos** do filamento desativado **"PLA Cinza Claro Voolt"** → **"PLA Cinza Claro Velvet Voolt"**: *Tubarão Flexível*, *Tubarão (2) Flexível*, *Lobo Flexível*. (Aparecem no aviso da tela de Produtos. Gabriel pode corrigir na mão ou pedir pra eu fazer via API.)
2. **Preços reais** de 6 filamentos placeholder + **quantificar** 3, quando o Gabriel mandar notas/pesagens: PLA Azul/Branco Velvet/Vermelho Silk (R$115); PETG HF Azul/Grafite/Vermelho (R$70); 0g: Rosa Ametista, Amarelo, Preto Velvet.
3. **Tela de variações no produto** (SKU): backend pronto; falta a seção no detalhe do produto (criar SKU por cor + estoque por variação).
4. **Importação automática de pedidos Shopee** (adiada até o CNPJ sair, ~fim jun/2026): registrar app "ERP System" na Shopee Open Platform → partner_id/key + autorizar loja; usar `get_order_list` + `get_order_detail`. Backend de pedidos do vendedor é construção nova (o provider Shopee atual é só de afiliados, pra espiar concorrente).
5. Depois: **app iOS** companion (Xcode no MacBook) consumindo a API do Hub.

## Gotchas (pra não repetir erro)
- **Produtos usam os 4 genéricos** (ABS/ASA/PETG/PLA Branco) no pricing — **não apagar os genéricos** (exceto os 3 produtos do item 1).
- **Filamento usa sufixo "Voolt" = marca.** Gabriel quer preço por fornecedor (outra marca = filamento separado).
- **Só existe SOFT-delete de filamento** (ativo=false); o nome continua ocupado (unique). Não dá pra recriar com o mesmo nome — renomeie/atualize o existente.
- **Confira o estado da prod ANTES de carregar dados** (já havia catálogo lá; quase dupliquei tudo).
- **Servidor de dev pode ficar stale** (rodava versão antiga, devolvia Decimal como string). Se "compila mas o app mostra errado": matar portas 3000/3001 + `pkill -f "turbo run dev"`, depois `pnpm dev`.
- Data de recibo: mandar ISO completo (não data seca) pra não dar −1 dia por fuso.

## Onde está o quê
- Backend novo: `apps/api/src/modules/{estoque,recibos,variacoes,producao}/`
- Frontend novo: `apps/web/app/(app)/{estoque,recibos,producao}/page.tsx` + `components/{movimento,custo-filamento,recibo,job}-dialog.tsx`
- Script de carga de filamentos: `scripts/montar-estoque-filamentos.sh`
- Migrations desta leva: `apps/api/prisma/migrations/2026061*`
