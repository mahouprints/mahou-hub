---
name: oportunidades-mahou
description: Descobre e avalia produtos da Shopee (e futuramente TikTok/ML) como candidatos a entrar no catálogo da Mahou Prints (impressão 3D). Use quando o usuário pedir ideias de produtos novos, "varre o que tá vendendo", "busca X na Shopee", "encontre miniaturas pra produzir" ou similar.
---

# Skill: Oportunidades de Produto — Mahou Hub

Esta skill te conecta ao módulo de **Inteligência de Oportunidades** do Mahou Hub via MCP server `mahou-hub` (10 tools de oportunidades + outras 12 de catálogo no mesmo server). Ela existe pra você ajudar o usuário a descobrir o que produzir em impressão 3D, baseado em dados reais de vendas de concorrentes e do marketplace.

## Modos de uso

### 1. Direcionado — "busca X específico"

Sinais: usuário menciona keyword, categoria, ou loja específica. Exemplos:
- "Busca miniaturas do Naruto na Shopee"
- "O que a 3DTECH está vendendo de novo?"
- "Tem coisa boa na categoria de organizadores?"

Ferramenta: `buscar_oportunidades`
- `tipo: 'keyword'` + `params: { keyword: '...' }` pra termo livre
- `tipo: 'categoria'` + `params: { categoryId: '...' }` pra categoria Shopee
- `tipo: 'concorrente'` + `params: { concorrenteId: '...' }` pra varrer 1 loja **cadastrada** (lê snapshot local)
- `tipo: 'concorrente'` + `params: { lojaExternalId: '...' }` pra investigar uma loja **não cadastrada** via Affiliate API live (útil pra avaliar antes de cadastrar)

### 2. Brainstorm — "me dá ideias do que tá vendendo"

Sinais: usuário quer ver **o que o marketplace está vendendo** agora. Exemplos:
- "O que tá bombando que dá pra imprimir?"
- "Varre o top de vendas e analisa"

Ferramenta: `explorar_top_vendas` com filtros mínimos pra reduzir ruído. Default sugerido:
```json
{
  "filtros": {
    "vendasMin": 200,
    "precoMinCentavos": 2000,
    "precoMaxCentavos": 15000,
    "ratingMin": 4.0,
    "limit": 200
  }
}
```

### 3. Geração de ideias autorais — "me dá ideias **da Mahou**"

Sinais: usuário quer ideias autorais Mahou inspiradas no mercado (não importação direta). Exemplos:
- "O que a Mahou poderia produzir?"
- "Gera ideias pra impressão 3D no nicho gamer"
- "Cria propostas de produto com base no que tá vendendo"

Detalhe em [geracao-ideias.md](geracao-ideias.md). Workflow: varre nicho → analisa transversalmente → gera N ideias autorais distribuídas em **pelo menos 3 categorias diferentes** → salva com `fonte: 'IDEIA_GERADA'`.

### 4. Gap analysis vs concorrentes — "o que eles têm que a gente não tem?"

Sinais: usuário quer cruzar catálogo Mahou × concorrentes cadastrados pra detectar oportunidades. Exemplos:
- "Varre todos os concorrentes e mostra os gaps"
- "O que a gente tá deixando de produzir que os outros vendem?"
- "Compare nosso catálogo com o dos concorrentes"

Detalhe em [gaps-concorrentes.md](gaps-concorrentes.md). Workflow: agrega snapshots de **todos os concorrentes cadastrados** → cruza com `listar_produtos` Mahou → detecta GAPS / VARIAÇÕES / MATCHES → gera ideias autorais inspiradas nos top gaps.

## Workflow recomendado (brainstorm)

1. Chame `estatisticas_oportunidades` pra ter contexto do backlog atual.
2. Chame `explorar_top_vendas` com os filtros baseline.
3. Para cada candidato, avalie aplicando os [critérios "imprimível em 3D"](criterios-3d.md).
4. **Não use [score](scoring.md) como filtro de corte.** Score existe pra ranquear quando o usuário pedir comparação relativa — não pra descartar candidatos. Diversidade > otimização local.
5. Apresenta candidatos viáveis ao usuário (com volume, preço, observações), pergunta quais salvar.
6. Salva os escolhidos com `salvar_oportunidades_em_lote` + `notas` estruturadas.

## Workflow recomendado (direcionado)

1. Chame `buscar_oportunidades` com o termo do usuário.
2. Liste os 10-20 primeiros candidatos.
3. Pergunte ao usuário se ele quer salvar todos, alguns específicos, ou refinar a busca.
4. Após confirmação, `salvar_oportunidades_em_lote` com os escolhidos.

## Operações em lote (múltiplas keywords ou categorias)

Caso de uso típico: usuário entrega uma lista (`['miniatura naruto', 'porta-controle ps5', 'organizador cabo']`) ou pede pra varrer N categorias 3D-friendly de uma vez. Padrão:

1. **Sequencial, não paralelo.** Rate-limit do backend é 20 req/min em `buscar_oportunidades` — paralelizar não dá ganho real e dispara 429. Use `for...of`, não `Promise.all`.
2. **Dedup vem de graça.** `salvar_oportunidades_em_lote` faz upsert por `(marketplace, externalId)` — não precisa checar duplicatas antes. Mesmo produto que aparece em 2 keywords só ocupa 1 linha no backlog.
3. **Score relativo pode mudar entre keywords.** Calcule score por candidato individualmente; não normalize "top 10 da keyword X" antes de juntar tudo. Salve todos os que ultrapassam o threshold absoluto (ex.: score >= 50) e deixe o usuário ordenar no Hub.
4. **Reporte agregado.** Ao final, devolva ao usuário: por keyword/categoria → quantos candidatos, quantos passaram do threshold, top 3 com link. Resumo no fim, não 1 mensagem por iteração.
5. **Pra varrer todas as categorias curadas:** chame `categorias_shopee_3d` primeiro, depois itere por `id` chamando `buscar_oportunidades` com `tipo: 'categoria'`. Filtros baseline iguais aos do brainstorm.

## Rate-limits do backend (importante)

O backend Mahou Hub blinda a Shopee Affiliate API com throttling no NestJS. Os limites por IP:

| Endpoint | Tool MCP | Limite |
|---|---|---|
| `POST /oportunidades/buscar` | `buscar_oportunidades` | **20 req/min** |
| `POST /oportunidades/explorar` | `explorar_top_vendas` | **10 req/min** (mais caro — sem nicho, varre top global) |
| `POST /oportunidades/bulk` | `salvar_oportunidades_em_lote` | **30 req/min** |

Se estourar, vem 429. Não tente bypassar com retry agressivo — espace ~3s entre chamadas em lote de `buscar` (cobre o teto de 20/min com folga). `explorar_top_vendas` use uma vez por sessão, no máximo.

## Persistência e workflow do candidato

- `status='NOVO'` — recém-descoberto, sem avaliação ainda. Cron baseline cria assim.
- `status='EM_ANALISE'` — você (Claude) avaliou e está em consideração.
- `status='APROVADO'` — usuário disse "vamos produzir" mas ainda não criou o Produto.
- `status='DESCARTADO'` — não vale a pena (concorrência saturada, margem ruim, risco legal, etc.).
- `status='VIRARAM_PRODUTO'` — `produtoId` preenchido, ciclo fechado.

Use `atualizar_oportunidade` pra mover entre status quando o usuário decidir.

## Promovendo a Produto

Quando o usuário aprovar e quiser produzir, chame `virar_produto` com os campos que faltam:
- `filamentoId` (obrigatório — sem default, pergunte qual usar)
- `pesoG` (estimativa do peso final em gramas)
- `tempoH` (estimativa de tempo de impressão)
- `impressora` ('A1' ou 'H2C')
- `embalagemCentavos` (opcional, default 0)

Os outros campos (nome, preço, canal, link de inspiração) são pré-preenchidos da oportunidade.

## Importante

- **Heurística de vendas**: `vendasEstimadasMes` na resposta já está calculado (vendas via afiliado ÷ 5%). Não recalcular.
- **Preço em centavos**: API só fala centavos. R$ 39,90 = 3990. Não tente passar 39.90.
- **BigInt como string**: `externalId` e `lojaExternalId` vêm como string mesmo sendo numéricos no Shopee.
- **Idempotência**: salvar 2x o mesmo `marketplace+externalId` faz upsert — dados de mercado se atualizam, workflow (status/score/notas) preserva.
