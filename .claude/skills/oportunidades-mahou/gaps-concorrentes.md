# Análise de gaps vs concorrentes cadastrados (modo 4)

Use quando o usuário pedir "o que os concorrentes têm que a gente não tem?", "varre todos os concorrentes e mostra gaps", "que ideias dá pra tirar dos concorrentes?".

Premissa: Mahou monitora N concorrentes cadastrados (estado em prod: 24+ lojas, snapshot semanal pelo cron de domingo 03h). Este modo cruza **o que eles vendem × o que Mahou tem no catálogo** pra identificar produtos que estamos **deixando dinheiro na mesa**.

## Pipeline

1. **Inventário concorrentes** — puxa produtos de TODOS os concorrentes cadastrados:
   - `buscar_oportunidades({ tipo: 'concorrente', params: {}, filtros: {} })` — sem `concorrenteId`/`lojaExternalId`, agrega snapshots de todas as lojas monitoradas. Saída: produtos brutos de cada concorrente.
   - Se a resposta vier paginada/limitada, ajusta `filtros.limit` (até 500). Provavelmente todos cabem.

2. **Inventário Mahou** — puxa catálogo Mahou:
   - `listar_produtos({ pageSize: 200 })` — produtos ativos (com e sem `anunciado`).
   - Captura `nome`, `inspiracao`, `categoriaIds` (via `productCatIds` inferidos), notas.

3. **Match Mahou × concorrentes** — pra cada produto de concorrente, decide:
   - **MATCH** — Mahou já tem produto equivalente (mesmo conceito + categoria + faixa de preço próxima). Critérios:
     - Nome contém termos similares (`organizador gaveta` ↔ `colmeia organizadora`)
     - Categoria principal igual ou adjacente
     - Faixa de preço sobrepõe (±50%)
   - **GAP** — concorrente vende, Mahou não tem nada parecido. Reporta.
   - **VARIAÇÃO** — Mahou tem algo no espírito mas em formato/tamanho/tema diferente. Reporta como "ideia de variação".

4. **Agrupamento por loja** — pra cada concorrente, mostra:
   - Total produtos analisados
   - Gaps detectados (com volume de vendas/mês quando disponível)
   - Variações sugeridas
   - Match (Mahou já cobre — só pra contexto)

5. **Geração de ideias** — pros top gaps (ordenados por vendas/mês), gera ideias autorais conforme `geracao-ideias.md`. Inspirações vêm dos próprios produtos-gap.

6. **Apresentação** — relatório estruturado:
   ```
   ## Análise de gaps × concorrentes (data)

   ### Resumo executivo
   - X concorrentes analisados, Y produtos no snapshot agregado
   - Z produtos Mahou no catálogo ativo
   - W gaps detectados (Mahou não cobre)

   ### Top gaps por volume
   | # | Produto-gap | Loja concorrente | Vendas/mês | Preço | Ideia Mahou |
   | 1 | ... | ... | ... | ... | ... |

   ### Gaps por concorrente (detalhe)
   #### 3DTECH IMPRESSÕES 3D (5 produtos, 4 gaps)
   - "Cantinho do café com plantas" — 274 vendas/mês — GAP ← já tá no backlog
   - "..." — ...
   #### ALM3D (12 produtos, 8 gaps)
   - ...

   ### Ideias sugeridas (top 10)
   [usa estrutura de notas de geracao-ideias.md]
   ```

7. **Persistência** — usuário escolhe quais ideias salvar:
   - `salvar_oportunidades_em_lote` com `fonte: 'IDEIA_GERADA'`
   - Inspirações nas notas devem listar **especificamente** os produtos-gap que motivaram (nome, loja, link).

## Regras de match (importante)

A regra de "match Mahou × concorrente" não é binária — você (Claude) precisa julgar:

- **Match forte** (não reportar como gap): mesmo conceito mecânico + categoria + faixa de preço próxima. Ex.: Mahou tem "Suporte Headset Bancada", concorrente tem "Apoio Fone de Cabeceira" — mesma função.
- **Match fraco / variação** (reportar como ideia): conceito similar mas tema/forma diferente. Ex.: Mahou tem "Vaso Suculenta 6cm liso", concorrente tem "Vaso Robert Plant tocando viola 6cm" — mesmo nicho, diferenciação temática vale a oportunidade.
- **Gap**: conceito não coberto pelo catálogo Mahou. Ex.: Mahou não tem nenhum porta-cartões, concorrente vende "Porta Cartão de Crédito Modular".

Quando em dúvida, **prefira reportar como gap ou variação** — descarte vai pro usuário decidir.

## Custo

- `buscar_oportunidades(tipo=concorrente)` agrega snapshots locais — **sem chamada Affiliate**. Barato.
- `listar_produtos` — só DB Mahou.
- Total: 2 chamadas. Pode rodar diariamente sem se preocupar com quota.

## Limitações conhecidas

- Snapshot dos concorrentes é semanal (cron domingo 03h). Se algum concorrente foi cadastrado depois da última domingo, snapshot só virá no próximo domingo. Pra forçar sync agora: REST `POST /concorrentes/:id/sync`.
- **Sem tool MCP `listar_concorrentes`** ainda — você não vê a lista de quem está cadastrado, só dos produtos retornados. Pra ver o nome das lojas, agrupa o output por `lojaNome` / `lojaExternalId`.
- Match Mahou × concorrente é qualitativo. Não tem similaridade semântica embedded — depende do julgamento por nome+categoria+preço.

## Quando NÃO usar este modo

- Usuário quer descobrir **lojas novas** (não cadastradas) → modo direcionado com `buscar_oportunidades(tipo: keyword)` e procura lojas com "3D" no nome.
- Usuário quer **só ideias gerais** sem foco em concorrência → modo 3 (geração de ideias) com input = categorias 3D.
- Backlog vazio e quer popular rapidamente → modo brainstorm (`explorar_top_vendas`).
