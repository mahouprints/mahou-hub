# mahou-hub — MCP server

Expõe o backend do Mahou Hub como tools MCP pro Claude (Desktop, Code, web). Cobre:

- **Inteligência de oportunidades** — descoberta e backlog de candidatos a virar produto (Shopee Affiliate).
- **Catálogo** — leitura/escrita de produtos, filamentos, insumos + calculadora de pricing.

---

## 🚀 Onboarding pra novo integrante Mahou

Pré-requisitos:
- Login ativo no Hub (`https://hub.mahouprints.com`) — peça pro admin criar.
- Node 22+, pnpm 9+.
- Claude Code instalado (`https://claude.com/claude-code`).

### Passo a passo (5 min)

```bash
# 1) Clone o repo (se ainda não tem)
git clone git@github.com:mahouprints/mahou-hub.git
cd mahou-hub

# 2) Instale deps + build do MCP
pnpm install
pnpm --filter @mahou-hub/mcp-hub build

# 3) Gere seu token JWT longo (válido 365 dias)
#    Faça login primeiro pra pegar o token curto:
TOKEN_CURTO=$(curl -s -i -X POST https://api.mahouprints.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"SEU.EMAIL@mahouprints.com","senha":"SUA-SENHA"}' \
  | grep -i 'set-cookie: mahou_token=' \
  | sed -E 's/.*mahou_token=([^;]+).*/\1/' | tr -d '\r')

#    Use o token curto pra pedir um longo (365d):
curl -X POST https://api.mahouprints.com/api/v1/auth/api-token \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN_CURTO" \
  -d '{"ttlDias": 365}'
# → copie o `token` da resposta

# 4) Crie .env.local na raiz do repo (gitignored)
cat > .env.local <<EOF
MAHOU_API_URL=https://api.mahouprints.com
MAHOU_API_TOKEN=cole-aqui-o-token-do-passo-3
EOF

# 5) Pronto. Abra o Claude Code dentro do repo:
claude
```

O `.mcp.json` na raiz do repo aponta pro MCP local. Na primeira mensagem, as 21 tools `mcp__mahou-hub__*` ficam disponíveis. Teste com:

> Quantas oportunidades temos no backlog?

(Claude vai chamar `estatisticas_oportunidades`.)

### Renovar token expirado (365 dias)

Mesma sequência do passo 3 — gera token novo, substitui no `.env.local`. Não há revogação por token; pra invalidar todos os tokens (incidente de segurança), rotacionar `JWT_SECRET` na VPS.

### Claude Desktop (alternativa)

Edite `claude_desktop_config.json` (Windows: `%APPDATA%\Claude\`):
```json
{
  "mcpServers": {
    "mahou-hub": {
      "command": "node",
      "args": ["C:/caminho/para/mahou-hub/mcp-servers/mahou-hub/dist/index.js"],
      "env": {
        "MAHOU_API_URL": "https://api.mahouprints.com",
        "MAHOU_API_TOKEN": "cole-aqui"
      }
    }
  }
}
```

Reinicia o Desktop. Tools aparecem no menu de ferramentas.

### Troubleshooting

| Sintoma | Causa | Fix |
|---|---|---|
| `Mahou API GET ... → 401` | Token ausente/expirado | Gera novo, atualiza `.env.local`, reinicia Claude |
| `Cannot find module dist/index.js` | Sem build | `pnpm --filter @mahou-hub/mcp-hub build` |
| Tools `mcp__mahou-hub__*` não aparecem | Claude Code aberto fora do repo | Abre dentro de `mahou-hub/` (lê `.mcp.json`) |
| `MAHOU_API_TOKEN não setado` | `.env.local` não existe ou key errada | Confere arquivo |

---

## Tools expostas (21 total)

### Oportunidades — descoberta + backlog (10)
- `buscar_oportunidades` — busca direcionada (keyword / categoria Shopee / concorrente monitorado).
- `explorar_top_vendas` — modo brainstorm: top vendas sem filtro de nicho.
- `listar_oportunidades` — backlog persistido com filtros (status, score, fonte).
- `salvar_oportunidade` / `salvar_oportunidades_em_lote` — salva candidatos no backlog.
- `atualizar_oportunidade` — muda status / score / notas (registra audit log).
- `descartar_oportunidade` — remove do backlog.
- `virar_produto` — promove a Produto (completo ou rascunho).
- `estatisticas_oportunidades` — counts por status / fonte / marketplace.
- `categorias_shopee_3d` — 17 categorias curadas pra buscar via `tipo='categoria'`.

### Catálogo — produtos + insumos + pricing (11)
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

---

## Dev

```bash
pnpm --filter @mahou-hub/mcp-hub dev     # tsc --watch
```

Pra testar manualmente (sem Claude), instale `@modelcontextprotocol/inspector` e rode:
```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Arquitetura

```
mcp-servers/mahou-hub/
├── src/
│   ├── index.ts                 # entry stdio + combina tools
│   ├── client.ts                # fetch wrapper + JWT do env
│   ├── tools-oportunidades.ts   # 10 tools de descoberta/backlog
│   └── tools-catalogo.ts        # 11 tools de produtos/filamentos/pricing
└── README.md                    # este arquivo
```

Pra adicionar nova área (ex: vendas, produção): crie `tools-<area>.ts`, exporta `tools`, importe em `index.ts`. Schemas Zod replicados localmente (sem dep em `@mahou-hub/contracts` pra MCP ficar publicável standalone).
