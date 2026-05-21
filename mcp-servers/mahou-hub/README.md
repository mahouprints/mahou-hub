# mahou-hub — MCP server

Expõe o backend do Mahou Hub como tools MCP pro Claude (Desktop, Code, web). Cobre:

- **Inteligência de oportunidades** — descoberta e backlog de candidatos a virar produto (Shopee Affiliate).
- **Catálogo** — leitura/escrita de produtos, filamentos, insumos + calculadora de pricing.

## Setup

1. **Build local**:
   ```bash
   pnpm --filter @mahou-hub/mcp-hub install
   pnpm --filter @mahou-hub/mcp-hub build
   ```

2. **Gerar token JWT longo** (logado como admin no Hub):
   ```bash
   # Loga e captura o cookie:
   curl -s -i -X POST https://api.mahouprints.com/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"<seu-email>","senha":"<sua-senha>"}' \
     | grep -i 'set-cookie: mahou_token=' \
     | sed -E 's/.*mahou_token=([^;]+).*/\1/'

   # Usa o token retornado pra pedir um token de longa duração:
   curl -X POST https://api.mahouprints.com/api/v1/auth/api-token \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <token-do-login>" \
     -d '{"ttlDias": 365}'
   ```

3. **Configurar no Claude Code**:
   O monorepo já tem `.mcp.json` na raiz apontando pra `mcp-servers/mahou-hub/dist/index.js`.
   Crie um `.env.local` na raiz do repo (gitignored) com:
   ```
   MAHOU_API_URL=https://api.mahouprints.com
   MAHOU_API_TOKEN=<token-do-passo-2>
   ```
   Reinicie o Claude Code dentro do repo — as tools `mcp__mahou-hub__*` aparecem automaticamente.

4. **Configurar no Claude Desktop** (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "mahou-hub": {
         "command": "node",
         "args": ["C:/Users/alexa/Documents/mahou-hub/mcp-servers/mahou-hub/dist/index.js"],
         "env": {
           "MAHOU_API_URL": "https://api.mahouprints.com",
           "MAHOU_API_TOKEN": "<token>"
         }
       }
     }
   }
   ```

## Tools expostas

### Oportunidades (descoberta + backlog)
- `buscar_oportunidades` — busca direcionada (keyword / categoria Shopee / concorrente monitorado).
- `explorar_top_vendas` — modo brainstorm: top vendas sem filtro de nicho.
- `listar_oportunidades` — backlog persistido com filtros (status, score, fonte).
- `salvar_oportunidade` / `salvar_oportunidades_em_lote` — salva candidatos no backlog.
- `atualizar_oportunidade` — muda status / score / notas (registra audit log).
- `descartar_oportunidade` — remove do backlog.
- `virar_produto` — promove a Produto (completo ou rascunho).
- `estatisticas_oportunidades` — counts por status / fonte / marketplace.
- `categorias_shopee_3d` — 17 categorias curadas pra buscar via `tipo='categoria'`.

### Catálogo (produtos + insumos + pricing)
- `listar_produtos` — lista com filtros (canal, anunciado, busca textual), paginada, com pricing por canal.
- `obter_produto` — detalhe de 1 produto + filamento + insumos + pricing.
- `estatisticas_produto` — vendas, faturamento, produzidos, em produção.
- `criar_produto` — cria produto novo (todos os campos obrigatórios).
- `atualizar_produto` — partial update (use pra completar rascunhos).
- `desativar_produto` / `desativar_produtos_em_lote` — soft-delete (preserva histórico).
- `marcar_produtos_anunciados` — bulk anunciado=true/false após publicar.
- `listar_filamentos` — pra escolher `filamentoId` em `criar_produto`/`calcular_preco`.
- `listar_insumos` — pra escolher `insumoId` em arrays de `criar_produto`/`calcular_preco`.
- `calcular_preco` — calculadora avulsa, sem persistir: "vale a pena imprimir X por R$Y?".

## Dev

```bash
pnpm --filter @mahou-hub/mcp-hub dev     # tsc --watch
```

Pra testar manualmente (sem Claude), instale `@modelcontextprotocol/inspector` e rode:
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```
