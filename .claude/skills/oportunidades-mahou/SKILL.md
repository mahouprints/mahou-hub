---
name: oportunidades-mahou
description: Descobre e avalia produtos da Shopee (e futuramente TikTok/ML) como candidatos a entrar no catálogo da Mahou Prints (impressão 3D). Use quando o usuário pedir ideias de produtos novos, "varre o que tá vendendo", "busca X na Shopee", "encontre miniaturas pra produzir" ou similar.
---

# Skill: Oportunidades de Produto — Mahou Hub

Esta skill te conecta ao módulo de **Inteligência de Oportunidades** do Mahou Hub via MCP server `mahou-oportunidades`. Ela existe pra você ajudar o usuário a descobrir o que produzir em impressão 3D, baseado em dados reais de vendas de concorrentes e do marketplace.

## Modos de uso

### 1. Direcionado — "busca X específico"

Sinais: usuário menciona keyword, categoria, ou loja específica. Exemplos:
- "Busca miniaturas do Naruto na Shopee"
- "O que a 3DTECH está vendendo de novo?"
- "Tem coisa boa na categoria de organizadores?"

Ferramenta: `buscar_oportunidades`
- `tipo: 'keyword'` + `params: { keyword: '...' }` pra termo livre
- `tipo: 'categoria'` + `params: { categoryId: '...' }` pra categoria Shopee
- `tipo: 'concorrente'` + `params: { concorrenteId: '...' }` pra varrer 1 loja monitorada

### 2. Brainstorm — "me dá ideias"

Sinais: usuário pede sem alvo claro. Exemplos:
- "O que tá bombando que dá pra imprimir?"
- "Me surpreenda, quero ideias"
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

## Workflow recomendado (brainstorm)

1. Chame `estatisticas_oportunidades` pra ter contexto do backlog atual.
2. Chame `explorar_top_vendas` com os filtros baseline.
3. Para cada candidato, avalie aplicando os [critérios "imprimível em 3D"](criterios-3d.md) e calcule [score](scoring.md).
4. Filtre os top N (recomendo 10) com melhor score.
5. Chame `salvar_oportunidades_em_lote` com `status='EM_ANALISE'`, `score` e `notas` estruturadas.
6. Reporte ao usuário: total avaliado, quantos salvos, top 3 com justificativa curta.

## Workflow recomendado (direcionado)

1. Chame `buscar_oportunidades` com o termo do usuário.
2. Liste os 10-20 primeiros candidatos.
3. Pergunte ao usuário se ele quer salvar todos, alguns específicos, ou refinar a busca.
4. Após confirmação, `salvar_oportunidades_em_lote` com os escolhidos.

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
