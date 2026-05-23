---
name: Mahou Prints — títulos USP-first
description: Filosofia central de títulos da Mahou Prints — diferencial/USP abre o título, keywords espremidas depois
type: feedback
originSessionId: 7ab024af-87a3-495a-aa14-5bbf9e5bcbcc
---
**Regra (FÓRMULA UNIVERSAL):** Todo título Mahou Prints segue a fórmula fixa, **SEM caractere separador**:

```
[Descrição curta-detalhada do produto + USP] [Keywords SEO empilhadas]
```

O primeiro bloco descreve o produto + USP em linguagem natural fluida (gancho visual no card). O segundo bloco vem logo após, empilhando keywords técnicas secas. A transição é natural — o leitor humano percebe pela mudança de tom (fluido → seco), e o algoritmo do marketplace lê tudo como um único título.

**Why:** Diretriz do dono da loja em 2026-05-18 após revisar finalistas do `suporte-controle-ps5`. Insight: "queremos maximizar buscas o máximo possível, MAS de cara no título temos que chamar mais atenção". O bloco descritivo abre o título com identidade clara; o bloco de keywords maximiza SEO no resto. Sem o bloco descritivo, vira anúncio anônimo no mar de "suporte controle ps5". Sem o bloco de keywords, mal indexa.

**Por que sem "/" ou outros separadores:** o dono pediu explicitamente em 2026-05-18 pra proibir caracteres especiais como separador no título. ML lista "/" como caractere especial proibido na regra antiga, e o dono confirmou que prefere manter a regra. A separação fica implícita pela mudança de tom (descrição fluida → keywords secas).

**How to apply:**
- **Bloco descrição+USP (primeiro):** breve mas detalhada, em linguagem natural. Tem que dar pra entender O QUE É e POR QUE ESSE é especial só lendo essa parte.
  - Ex: `Suporte de Controle e Headset 3 em 1` (descreve produto + USP "3 em 1")
  - Ex: `Abajur LED Translúcido Bubble Decorativo` (descreve + USP "bubble translúcido")
  - Ex: `Cortador de Biscoito Tema Monstrinho Geek` (descreve + USP "tema monstrinho")
- **Bloco keywords (segundo):** empilha keywords técnicas mais buscadas da categoria, ordenadas por volume de busca decrescente. Sem repetir palavras do bloco descritivo.
- **Sem separador:** SEM "/", "|", "—", vírgula, hífen, ou qualquer caractere — só espaço normal entre as palavras.
- **Por produto:** consultar `~/Marketplace/catalogo/produtos.json > produtos.{slug}.descricao_curta_titulo`. Se faltar, perguntar ao usuário.
- **Adaptação por marketplace:**
  - **ML** (60 chars): bloco descritivo curto (35-40 chars), espaço pequeno pra keywords
  - **Shopee** (100 chars): bloco descritivo médio (45-55 chars), mais espaço pra keywords
  - **TikTok** (200 chars): bloco descritivo pode ser mais expandido + bloco keywords amplifica com lifestyle/trend
- **No fan-out de geração:** todos os Sonnet agents recebem o bloco descritivo já fechado (lido do catálogo) — só variam o ENCADEAMENTO das keywords do segundo bloco.

**Exemplo final completo (ML, 53 chars):**
```
Suporte de Controle e Headset 3 em 1 Ps5 Xbox Gamer 3d
```
