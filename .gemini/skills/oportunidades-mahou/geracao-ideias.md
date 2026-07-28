# Geração de ideias autorais (modo 3)

Use quando o usuário pedir "me dá ideias", "o que a Mahou poderia produzir", "gera ideias com base em X". Diferente do modo brainstorm (que lista produtos do marketplace), aqui você **gera ideias autorais Mahou inspiradas** no que descobre.

Premissa importante: o backlog não é pra clonar o que tá vendendo no Shopee — é pra capturar **propostas de produto da Mahou**. Os produtos do marketplace são matéria-prima de inspiração, não destino.

## Pipeline

1. **Coleta** — identifica nicho-alvo a partir do input (keywords / categorias / concorrentes específicos).
2. **Varredura** — chama `buscar_oportunidades` (keyword/categoria/concorrente) ou `explorar_top_vendas` pra cobrir o nicho. Múltiplas categorias se possível.
3. **Análise transversal** — agrupa retornos por padrão, identifica:
   - Faixas de preço dominantes
   - Variações que existem (P/M/G, com/sem mecanismo, etc.)
   - Lacunas no catálogo Mahou (combinações, ângulos, customizações que ninguém oferece)
   - Concorrentes 3D ativos no nicho
4. **Geração** — pra **cada categoria coberta**, gera 1+ ideias autorais (ver Regras abaixo).
5. **Apresentação** — mostra a tabela de ideias + raciocínio ao usuário antes de salvar.
6. **Persistência** — usuário escolhe quais salvar. Save via `salvar_oportunidades_em_lote` com `fonte: 'IDEIA_GERADA'`.

## Regras

- **Diversidade obrigatória.** Cada rodada gera ideias de **pelo menos 3 categorias diferentes**. Se você varreu só 1 categoria, varra mais antes de gerar.
- **Não copia.** Nome da ideia precisa ser diferente do produto-inspiração. Pode ser variação ("Porta-Controle Modular" se viu "Porta-Controle 5 Slots Fixo"), combinação ("Porta-Caneta + Suporte Headset Integrado") ou cross-categoria.
- **Inspirações são opcionais mas recomendadas.** Marca claramente o que é inspiração vs original.
- **Sem score binário cortando.** Cada ideia tem análise narrativa. Score (de `scoring.md`) é opcional — usa só pra ranquear quando o usuário pedir comparação relativa.
- **Sinaliza concorrentes 3D detectados** durante a varredura — se viu `Melhor 3D`, `3DTECH`, `ALM3D`, `Armazém 3Dx` ou qualquer loja com nome contendo "3D" / "Print" / "Impressão", reporta nas notas da ideia: pode ser inspiração + benchmark.

## Como persistir

`salvar_oportunidades_em_lote` aceita `fonte: 'IDEIA_GERADA'`. Estrutura:

```json
{
  "marketplace": "SHOPEE",
  "externalId": "IG-2026-05-21-001",
  "productName": "Nome autoral da ideia",
  "priceMinCentavos": 3000,
  "priceMaxCentavos": 7000,
  "imageUrl": "[opcional — usa imagem da inspiração principal]",
  "productLink": "[opcional — link da inspiração principal]",
  "vendasEstimadasMes": 0,
  "lojaNome": "Mahou Prints",
  "lojaExternalId": null,
  "categoriaIds": [<cats Shopee onde se encaixa>],
  "fonte": "IDEIA_GERADA",
  "status": "EM_ANALISE",
  "notas": "<estrutura abaixo>"
}
```

`externalId` é cuid local porque o backend faz upsert por `(marketplace, externalId)`. Pra não colidir com produtos Shopee reais, prefixe com `IG-` (Ideia Gerada) + data + contador da rodada.

## Estrutura das notas

```
**Conceito:** [descrição da ideia em 1-2 frases]

**Inspirações:**
- [productName1] · [loja1] · R$ X · ~Y vendas/mês · [productLink1]
- [productName2] · [loja2] · R$ X · ~Y vendas/mês · [productLink2]
- ...

**Diferencial:** [o que essa ideia tem que as inspirações não têm]

**Por que faz sentido:** [lacuna detectada / volume implícito / ângulo único / margem]

**Estimativa de produção:** [peso ~X g, tempo ~Y h, impressora A1/H2C, filamento sugerido]

**Concorrentes 3D no nicho:** [lojas 3D encontradas, se houver]

**Risco/contraste:** [o que pode dar errado / quando NÃO faz sentido]
```

## Exemplo de diversidade

❌ Ruim (só 1 categoria, 5 variações similares):
- Organizador 3 gavetas (cat 100721)
- Organizador 4 gavetas (cat 100721)
- Organizador 5 gavetas (cat 100721)
- Organizador modular 6 slots (cat 100721)
- Organizador transparente (cat 100721)

✅ Bom (5 categorias diferentes):
- "Organizador Modular Empilhável" (cat 100721 — organizadores)
- "Hub de Cabo Magnético" (cat 100284 — organizadores cabo)
- "Suporte Headset com Porta-USB Integrado" (cat 100644 — suporte headset)
- "Cachepô Geek 8-bit" (cat 100711 — geek/colecionáveis)
- "Chaveiro Modular Customizável" (cat 100016 — chaveiros)

## Quando NÃO usar este modo

- Usuário quer ver **o que está vendendo** no marketplace agora → modo brainstorm (`explorar_top_vendas`).
- Usuário quer **investigar uma loja específica** → modo direcionado tipo `concorrente`.
- Usuário quer **clonar** um produto-específico (raro mas acontece) → usa diretamente `salvar_oportunidades_em_lote` com `fonte: 'TOP_VENDAS'` ou `'KEYWORD'` correspondente.
