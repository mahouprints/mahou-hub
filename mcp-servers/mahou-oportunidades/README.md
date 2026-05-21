# mahou-oportunidades — MCP server

Expõe o módulo de Inteligência de Oportunidades da Mahou Hub como tools MCP pro Claude (Desktop, Code, web).

## Setup

1. **Build local**:
   ```bash
   pnpm --filter @mahou-hub/mcp-oportunidades install
   pnpm --filter @mahou-hub/mcp-oportunidades build
   ```

2. **Gerar token JWT longo** (logado como admin no Hub):
   ```bash
   curl -X POST https://api.mahouprints.com/api/v1/auth/api-token \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <jwt-curto-do-login>" \
     -d '{"diasTtl": 365}'
   ```
   Copie o `token` da resposta.

3. **Configurar no Claude Code**:
   O monorepo já tem `.mcp.json` na raiz. Crie um `.env.local` (gitignored) com:
   ```
   MAHOU_API_TOKEN=<token-do-passo-2>
   ```
   Ou exporte no shell antes de abrir o Claude Code.

4. **Configurar no Claude Desktop** (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "mahou-oportunidades": {
         "command": "node",
         "args": ["C:/Users/alexa/Documents/mahou-hub/mcp-servers/mahou-oportunidades/dist/index.js"],
         "env": {
           "MAHOU_API_URL": "https://api.mahouprints.com",
           "MAHOU_API_TOKEN": "<token>"
         }
       }
     }
   }
   ```

## Tools expostas

- `buscar_oportunidades` — busca direcionada (keyword / categoria / concorrente).
- `explorar_top_vendas` — modo brainstorm: top vendas sem filtro de nicho.
- `listar_oportunidades` — backlog persistido com filtros.
- `salvar_oportunidade` / `salvar_oportunidades_em_lote` — salva no backlog.
- `atualizar_oportunidade` — muda status/score/notas.
- `descartar_oportunidade` — remove do backlog.
- `virar_produto` — promove a Produto rascunho na Mahou.
- `estatisticas_oportunidades` — counts pro Claude ter contexto.

## Dev

```bash
pnpm --filter @mahou-hub/mcp-oportunidades dev     # tsc --watch
```

Pra testar manualmente (sem Claude), instale `@modelcontextprotocol/inspector` e rode:
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```
