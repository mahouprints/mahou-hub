# Skill: Anunciar Produto (Mahou Prints)

Leva um produto do Hub até o anúncio pronto: **confere a economia**, **sugere preço**,
**calcula o ROAS alvo do teste e da escala**, e **escreve título + descrição + tags** para
Shopee, Mercado Livre e TikTok Shop.

**Leia sempre o `contexto-mahou.md` antes de qualquer coisa** — ele fica ao lado deste
arquivo no repo, e vem concatenado no fim quando a skill é sincronizada pro uso global. Ele
tem as regras de negócio — degrau de taxa da Shopee, marcas proibidas, tom de voz, o que
vende e o que não vende. Sem ele você vai gerar copy bonita para um produto que não fecha conta.

## Quando usar

- Produto novo cadastrado e você quer anunciar
- Descrição que não está vendendo e precisa ser refeita
- Já tem anúncio na Shopee e quer levar pro ML
- Quer saber **quanto investir em anúncio** e **qual ROAS perseguir** antes de apertar o play
- Lote de produtos de uma vez

## A fonte de verdade é o Hub, não arquivo

O Hub (`hub.mahouprints.com`) tem os produtos reais com custo, peso, tempo, margem por canal
e estoque. **Puxe de lá via MCP tools** — nunca invente número nem confie em catálogo estático:

| Precisa de | Tool |
|---|---|
| Lista de produtos | `listar_produtos` (filtro `anunciado: false` pega os pendentes) |
| Um produto com custos e margem por canal | `obter_produto` |
| Testar preço hipotético | `calcular_preco` |
| **ROAS e plano de anúncio** | `calcular_plano_ads` |
| Marcar como anunciado depois | `marcar_produtos_anunciados` |

Se o produto ainda não existe no Hub, pergunte os dados e ofereça criar com `criar_produto`
antes de seguir — anunciar produto que não está no ERP quebra o controle de estoque depois.

---

## Fluxo

### Fase 1 — Economia (antes de escrever qualquer palavra)

**Não escreva copy de produto que não fecha conta.** Comece por aqui:

1. `obter_produto` para pegar preço atual, custo total e líquido por canal.
2. Confira contra o **degrau de R$ 80 da Shopee** (ver `contexto-mahou.md`). Se o preço
   estiver entre R$ 80 e R$ 100, quase sempre há um preço melhor abaixo de R$ 79,90 —
   simule com `calcular_preco` e mostre a comparação.
3. Calcule o **lucro por hora de impressão**: `líquido ÷ tempo de impressão`. É a métrica
   que decide se vale ocupar a fila. Abaixo de ~R$ 4/hora, diga isso ao Gabriel antes de
   continuar.
4. Margem negativa ou lucro/hora ruim → **pare e reporte**. Não gere anúncio para produto
   que dá prejuízo; proponha preço ou peça revisão do custo.

### Fase 2 — Plano de anúncio (ROAS)

Rode `calcular_plano_ads` com `precoCentavos` e o `liquidoCentavos` do canal (Shopee, salvo
indicação contrária). Apresente assim:

```
Plano de anúncio — {produto}

  TESTE (comprar dados)
    ROAS alvo:        {roasAlvoTeste}    ← empatar já é aprovar
    Orçamento total:  R$ {orcamentoTeste} em {janela} dias
    Por dia:          R$ {investimentoDiario}
    CPA máximo:       R$ {cpaAlvo}
    Cliques previstos: {cliques}

  ESCALA (se passar no teste)
    ROAS alvo:        {roasAlvoEscala}   ← aqui exige folga
    Escada de budget: R$ x → R$ y → R$ z ...  (+{passo}% a cada {cadência} dias)
```

**Explique a diferença entre os dois ROAS toda vez** — é o ponto que mais confunde:
no teste você compra informação, então break-even basta; na escala você quer lucro, por
isso o alvo é 1,4× maior.

**Se vier `inviavel: true`** — a margem não paga anúncio nenhum. Diga isso direto e sugira
rever preço ou custo. Não maquie.

**Se vier aviso de amostra magra** (menos de 60 cliques) — o teste não vai concluir nada
confiável. Ofereça: subir o lance, alongar a janela, ou aceitar rodar sabendo que o
resultado será inconclusivo.

### Fase 3 — Análise visual (obrigatória)

**Sem imagem, sem descrição.** Abra as fotos com `Read` antes de escrever. Anote:

- Quantas peças/formatos tem no kit? (conte na imagem, não confie no cadastro)
- Que formatos exatos? Liste um a um.
- Cor real.
- Dimensões aparentes (compare com mão, régua, objeto conhecido).
- Detalhes não-óbvios: gravação, encaixe, articulação, acabamento.
- **A peça precisa de algo que não vem junto?** Ímã, parafuso, fio, elástico, soquete,
  pilha. Isso muda custo e precisa aparecer na descrição — cliente que recebe menos do que
  esperava abre reclamação.

Se a foto contradiz o cadastro, **a foto vence** e vale avisar o Gabriel.

Fotos ficam em `~/Documents/Mahou Prints/products/{slug}/referencias/`. Se não houver
nenhuma, pare e peça — chutar pelo nome do produto gera anúncio errado.

### Fase 4 — Título

**Fórmula universal Mahou Prints:**

```
[Descrição curta do produto + USP] [Keywords SEO empilhadas]
```

Sem separador (`/`, `|`, `—`, vírgula). A transição é natural: descrição fluida → keywords
secas. O humano percebe pela mudança de tom; o algoritmo lê tudo junto.

Exemplos reais:
- ML (53): `Suporte de Controle e Headset 3 em 1 Ps5 Xbox Gamer 3d`
- Shopee (87): `Suporte de Controle e Headset 3 em 1 Ps5 Xbox Dualsense Gamer Setup Decoração Quarto 3d`
- TikTok (108): `Suporte de Controle e Headset 3 em 1 Ps5 Xbox Dualsense Gamer Setup Aesthetic Decoração Quarto Gamer Geek 3d`

**Limites duros:** ML ≤60 · Shopee ≤100 · TikTok 34–200.

#### Produto parecido com outro que já está no catálogo

Ao gerar em lote, tipos se repetem: dois polvos, três dragões, dois topos de bolo. **A
diferenciação vai no título, não na categoria** — dois topos de bolo caem na mesma
categoria do ML e isso está certo; o que não pode é os dois disputarem a mesma busca.

Antes de escrever, confira o que já existe no catálogo e nomeie pela diferença real:
`Polvo Articulado Flexivel` × `Polvo Fofo Articulado Redondinho`, `Topo de Bolo` vazado
reto × `Topo de Bolo Cursivo`. Se você não consegue nomear a diferença, o cliente também
não vai ver — e aí são dois anúncios competindo entre si em vez de dois produtos.

#### Geração por fan-out (padrão para produto importante)

Dispare 8 subagentes **Sonnet** em paralelo via `Agent`, cada um com um ângulo:

| # | Ângulo |
|---|---|
| 1 | SEO máximo — keywords técnicas empilhadas |
| 2 | Híbrido — keyword + benefício meio a meio |
| 3 | Lifestyle — vibe, descoberta no feed |
| 4 | Cross-compatibility — cobre múltiplos casos (PS5+Xbox, Kindle+e-reader) |
| 5 | Long-tail — captura busca conversacional |
| 6 | Sinônimos e plural — "suporte" + "apoio" + "stand" |
| 7 | Presente — aniversário, Dia das Mães, Natal |
| 8 | Nicho — streamer, colecionador, decorador |

Passe a cada agente: regras do marketplace, dados do produto, o **USP** (todos abrem com
ele; o que varia é o ângulo das keywords depois) e as keywords da categoria.

Depois **avalie você mesmo** os ~12 títulos:

| Critério | Peso |
|---|---|
| Dentro do limite de chars | bloqueante |
| Sem marca registrada proibida | bloqueante |
| Sem palavra restrita ("promoção", "melhor", "oficial") | bloqueante |
| Keyword principal nos primeiros 25 chars | alto |
| Cobertura de buscas distintas | alto |
| Naturalidade (não parece spam) | alto |
| Diversidade entre os 3 finalistas | médio |

Apresente **3 finalistas** de clusters diferentes, com char count e que buscas cada um pega.

**Modo rápido:** em lote grande ou se o Gabriel pedir, pule o fan-out e gere 3 títulos direto.

### Fase 5 — Descrição, tags e ficha

Siga as regras de `content/marketplace/regras/{marketplace}.md`. Princípios que valem sempre:

- Keyword principal 3–5× ao longo do texto, sem soar forçado
- Mencionar **Mahou Prints** pelo menos uma vez
- Sempre citar "3D" / "Impressão 3D" e "PLA"
- Declarar o que **não** vem junto, se for o caso
- Consultar as marcas proibidas em `contexto-mahou.md` antes de escrever

**Os alertas da triagem viram aviso ao cliente.** `FRAGIL`, `MULTICOR`, `MONTAGEM` e
qualquer dependência de item que não vai na caixa (ímã, LED, vela, parafuso, elástico)
não podem ficar só no Hub — o cliente que recebe menos do que esperava abre reclamação,
e no ML isso derruba reputação. Traço fino vira "manuseie pela base"; LED integrado vira
"NÃO acompanha fita de LED"; peça que esquenta vira aviso de que PLA amolece.

Estruturas: **Shopee** blocos separados por emoji, tags no fim, sem link externo ·
**ML** separadores `▬▬▬` e ficha técnica obrigatória · **TikTok** hashtags são críticas,
tom mais jovem.

#### Categoria do ML — conferir na API, sempre

**Nenhum anúncio de Mercado Livre sai com categoria escrita de cabeça.** Categoria
errada não dá erro: o anúncio publica, fica no ar e não aparece na busca. É a falha
que mata produto campeão sem deixar rastro.

O procedimento completo está em `content/marketplace/regras/mercado-livre.md`. Em resumo:
prever com `domain_discovery/search`, confirmar `path_from_root` e `listing_allowed` em
`/categories/{id}`, escolher a folha mais específica que ainda descreve o produto, puxar
os atributos `required` da categoria e cobrir todos na ficha técnica, e **gravar o
`category_id`** — não só o nome.

Vale pro ML porque é onde a punição é mais dura. Na Shopee e no TikTok, escolher a
categoria mais específica que descreva o produto continua valendo, mas sem a mesma
penalização de ranking.

### Fase 6 — Salvar e apresentar

Salve em `~/Documents/Mahou Prints/products/{slug}/listings/{marketplace}.md`:

```markdown
# {Produto} — {Marketplace}

**Gerado em:** {AAAA-MM-DD} · **Versão:** {n} · **Status:** rascunho

## Economia
| | |
|---|---|
| Preço sugerido | R$ {preço} |
| Custo total | R$ {custo} |
| Líquido {canal} | R$ {líquido} |
| Margem | {margem}% |
| Lucro por hora | R$ {lucroHora} |

## Plano de anúncio
| | Teste | Escala |
|---|---|---|
| ROAS alvo | {teste} | {escala} |
| Budget diário | R$ {diário} | R$ {inicial} → R$ {final} |
| CPA máximo | R$ {cpa} | — |
| Duração | {janela} dias | {passo}% a cada {cadência} dias |

## Títulos
### A — SEO máximo ({n} chars)
### B — Híbrido ({n} chars)
### C — Lifestyle ({n} chars)

## Descrição
## Tags
## Ficha técnica
## Observações
## Imagens disponíveis
```

Depois: apresente no chat os 3 títulos lado a lado, o resumo da economia e o plano de ROAS.
Quando o Gabriel escolher o título, **marque com ✅ no arquivo e mova pro topo**.

### Fase 7 — Depois de publicar

Quando o Gabriel confirmar que subiu o anúncio, rode `marcar_produtos_anunciados` para o
Hub parar de listar o produto como pendente.

---

## Outros modos

**`refinar`** — lê o listing existente e reescreve com base em feedback ou keywords novas.
Preserve o que funcionava; mude só o que foi apontado.

**`traduzir`** — pega o listing de um marketplace e re-otimiza para outro. Não é tradução
literal: cada algoritmo quer coisa diferente.

**`lote`** — vários produtos em sequência. Use `listar_produtos` com `anunciado: false`.
Em lote, use o modo rápido de título e só aprofunde nos que o Gabriel marcar.

---

## Regras que não se quebram

- **Nunca publique anúncio.** A skill gera; o Gabriel publica.
- **Nunca grave em produção sem pedir.** Vale para `criar_produto`, `atualizar_produto` e
  qualquer escrita no Hub.
- **Nunca invente número.** Custo, margem e ROAS vêm do Hub. Se faltar dado, pergunte.
- **Nunca escreva copy antes de conferir a economia.** Produto que dá prejuízo não precisa
  de descrição bonita, precisa de preço novo.
- **Marca registrada nunca no título.** Ver a tabela em `contexto-mahou.md`. Quando a
  marca está no nome do modelo original ("Xbox Invisible Stand", "Indominus Rexi"), não
  basta apagar a palavra: renomeie o produto inteiro em pt-BR pelo que ele é
  ("Suporte Invisivel para Controle de Videogame", "Dinossauro Articulado Flexivel") e
  deixe a compatibilidade só na descrição, como "compatível com".
- **Categoria de ML nunca inventada.** Vem da API do Mercado Livre, com o `category_id`
  gravado junto. Caminho plausível não é caminho existente — e o erro é silencioso.

## Pronto quando

- [ ] Economia conferida — margem e lucro/hora aceitáveis, degrau de R$ 80 respeitado
- [ ] Plano de ROAS calculado e explicado (teste ≠ escala)
- [ ] Imagens abertas e conferidas contra o cadastro
- [ ] 3 títulos dentro do limite, sem marca proibida
- [ ] Categoria do ML confirmada na API, com `category_id` e atributos `required` cobertos
- [ ] Descrição com keyword 3–5×, marca mencionada, itens que não vêm junto declarados
- [ ] Arquivo salvo em `listings/{marketplace}.md`
- [ ] Gabriel escolheu o título → marcado com ✅
