# Skill: Gerador de Descrições e Títulos para Marketplaces (Mahou Prints)

Gera **descrições completas** e **títulos otimizados** de produtos Mahou Prints para **Shopee**, **Mercado Livre** e **TikTok Shop**. Tom **misto SEO-first**: combina otimização agressiva de busca + benefícios funcionais/emocionais.

## 🎯 Quando usar
- Acabou de cadastrar um produto novo e precisa da descrição
- Quer **refinar** uma descrição existente que não está vendendo
- Quer **traduzir** uma descrição entre marketplaces (já tem na Shopee, quer no ML)
- Quer um **lote** de descrições (vários produtos, vários marketplaces de uma vez)

## 📂 Estrutura de pastas

```
content/marketplace/
├── regras/                          # 📜 regras técnicas e SEO por marketplace
│   ├── shopee.md
│   ├── mercado-livre.md
│   └── tiktok-shop.md
├── catalogo/
│   └── produtos.json                # 🧠 catálogo Mahou Prints com keywords por produto
└── treino/                          # 🎓 base de aprendizado (preenchida pelo usuário)
    ├── COMO_TREINAR.md
    ├── template_listing.md
    ├── listings_que_funcionaram/    # 🟢 exemplos de sucesso por marketplace
    ├── concorrentes/                # 🔵 análise de concorrentes
    └── keywords/                    # 🟡 banco de palavras-chave por categoria

C:\Users\PC\Documents\Mahou Prints\products\{produto-slug}\
└── listings\                        # 📤 OUTPUT — descrições + títulos salvos aqui
    ├── shopee.md
    ├── mercado-livre.md
    └── tiktok-shop.md
```

> Nota: o nome da skill é `gerar-descricao` (sem cedilha para compatibilidade com filesystem), mas a saída cobre **descrição + título + tags + atributos** — pacote completo pra você só copiar e colar no marketplace.

## 🚀 Modos de operação

### Modo 1 — `gerar` (1 produto, marketplaces escolhidos)
Gera descrição + título para 1 produto em 1 ou mais marketplaces.

**Comando típico:** "gera descrição pra Shopee e ML do produto suporte-controle-ps5"

### Modo 2 — `gerar-batch` (vários produtos)
Processa N produtos em sequência. Útil quando cadastra muitos de uma vez.

**Comando típico:** "gera descrições de todos os produtos novos pra Shopee" → processa `products/` que ainda não têm `listings/shopee.md`.

### Modo 3 — `refinar` (atualizar descrição existente)
Lê uma descrição já gerada, reescreve com base em feedback ou novas keywords.

**Comando típico:** "refina a descrição do abajur-bubble na Shopee, foca mais em 'aesthetic' e 'cantinho cozy'"

### Modo 4 — `traduzir` (já tenho num marketplace, quero noutro)
Lê a descrição existente de um marketplace e adapta às regras do outro (não traduz literal — re-otimiza pro algoritmo do destino).

**Comando típico:** "transforma a descrição da Shopee do abajur-wave em descrição do ML"

### Modo 5 — `aprender` (extrai padrão de exemplos)
Lê os arquivos em `treino/listings_que_funcionaram/` e atualiza o catálogo/keywords com o estilo encontrado.

**Comando típico:** "aprende com as descrições que botei na pasta de treino"

---

## 🛠️ Fluxo de execução (Modo 1 — gerar)

### Passo 1 — Coleta de contexto

1. **Ler obrigatoriamente:**
   - `content/marketplace/catalogo/produtos.json` — buscar o produto pelo slug
   - `content/marketplace/regras/{marketplace}.md` — para CADA marketplace pedido
   - `content/marketplace/treino/keywords/{categoria}.md` — se existir para a categoria do produto
   - `content/marketplace/treino/listings_que_funcionaram/{marketplace}/` — listar arquivos pra ver se há exemplo similar

2. **Verificar pasta do produto:**
   - `C:\Users\PC\Documents\Mahou Prints\products\{produto-slug}\` existe?
   - Se sim, listar imagens disponíveis em `referencias/`
   - Se já existe `listings/{marketplace}.md`, **perguntar** se deve sobrescrever ou versionar (`shopee_v2.md`)

3. **🔍 ANÁLISE VISUAL OBRIGATÓRIA da imagem do produto:**
   - **Sem imagem = sem descrição.** Se `referencias/` está vazia, **PARAR e pedir foto/render ao usuário antes de prosseguir**. Não chutar com base no catálogo — o catálogo é frequentemente incompleto (caso real: catálogo dizia "4 formatos", produto tinha 6).
   - Se tem imagem(ns), usar a tool Read pra ler o arquivo visualmente (suporta JPG/PNG/WebP). Anotar antes de gerar título/descrição:
     - **Quantos itens/formatos/peças tem no kit?** (contar visualmente)
     - **Que formatos/silhuetas exatas?** (listar 1 por 1)
     - **Cor real** (não confiar no `cor_padrao` do catálogo)
     - **Dimensões aparentes** (régua, mão, comparativo)
     - **Detalhes não-óbvios:** gravação, acabamento, encaixe, alto-relevo
   - Múltiplas imagens? Combinar achados.
   - **Atualizar `produtos.json`** se a imagem revelar diferenças (quantidade real, nome dos formatos) — próxima geração fica mais precisa.

4. **Se produto NÃO está no catálogo:**
   - Perguntar ao usuário: nome do produto, categoria, dimensões aproximadas, cor padrão, público-alvo, diferenciais
   - **Salvar no `produtos.json`** após confirmação (o catálogo cresce com o uso)

### Passo 2 — Geração

Para cada marketplace solicitado, gerar **conforme regras do arquivo de regras correspondente**.

**Princípios universais (todos os marketplaces):**
- **FÓRMULA UNIVERSAL do título Mahou Prints (CRÍTICO):**

  ```
  [Descrição curta-detalhada do produto + USP] [Keywords SEO empilhadas]
  ```

  Sem caractere separador (sem "/", "|", "—", vírgula). A transição entre os 2 blocos é natural: descrição fluida → keywords secas. O leitor humano percebe pela mudança de tom; o algoritmo lê tudo junto.

  Consultar `catalogo/produtos.json > produtos.{slug}.descricao_curta_titulo` ANTES de gerar. Se o campo não existir, **perguntar ao usuário** a descrição curta antes de gerar.

  **Exemplos:**
  - ML (53 chars): `Suporte de Controle e Headset 3 em 1 Ps5 Xbox Gamer 3d`
  - Shopee (90 chars): `Suporte de Controle e Headset 3 em 1 Ps5 Xbox Dualsense Gamer Setup Decoração Quarto 3d`
  - TikTok (115 chars): `Suporte de Controle e Headset 3 em 1 Ps5 Xbox Dualsense Gamer Setup Aesthetic Decoração Quarto Gamer Geek 3d`

- **Adaptação do bloco de keywords por marketplace:** ML prioriza keywords técnicas secas (60 chars). Shopee permite expandir com sinônimos. TikTok amplifica com lifestyle/trend.
- **Tom misto SEO-first:** primeira parte do título = USP + keywords; descrição = SEO + benefício + emoção em mix
- **Sempre incluir:** "3D" ou "Impressão 3D" + "PLA" + 1 termo da marca quando couber
- **Densidade de keyword principal:** 3-5x ao longo da descrição (sem soar artificial)
- **Mahou Prints:** mencionar a marca pelo menos 1x na descrição (de preferência num bloco "Sobre nós")
- **Respeitar marcas registradas:** consultar `catalogo/produtos.json > regras_marcas_registradas` antes de usar termos como Pokemon, Patrulha Canina, Disney, etc.

**Estruturas específicas:**
- **Shopee:** título 60-80 chars, descrição com blocos emoji-separados, tags no final, sem links externos
- **ML:** título HARD ≤60 chars, descrição com separadores `▬▬▬`, ficha técnica obrigatória
- **TikTok Shop:** título 80-120 chars (pode ser mais longo), hashtags são CRÍTICAS, tom mais jovem

### Passo 3 — Gerar título via fan-out Sonnet + avaliação Opus (padrão)

**Arquitetura generator-evaluator** — usar como modo padrão pra produtos hero/importantes.

**3.1 Fan-out (paralelo, Sonnet 4.6):**

Disparar 8 agentes Sonnet em paralelo via tool `Agent` com `model: "sonnet"`, cada um com um brief especializado:

| # | Foco do agente | Brief curto |
|---|---|---|
| 1 | SEO máximo | Maximiza keywords técnicas exatas — palavras-chave de busca direta empilhadas |
| 2 | Híbrido balanceado | Mistura keyword + benefício (mesma proporção) |
| 3 | Lifestyle/aesthetic | Termos emocionais, vibe, descoberta no feed |
| 4 | Cross-compatibility | Maximiza cobertura cross-produto (ex: PS5+Xbox, Kindle+e-reader, etc) |
| 5 | Long-tail descritivo | Frases mais completas, captura buscas conversacionais |
| 6 | Sinônimos & plural | Usa variações ("suporte" + "apoio" + "stand") e plural quando aplicável |
| 7 | Presente / gift | Posiciona como item de presente (aniversário, Dia das Mães, Natal) |
| 8 | Nicho específico | Mira em sub-segmento (streamer, decorador, colecionador, etc) |

**Cada brief passa ao Sonnet:**
- Regras do marketplace (limite de chars, palavras restritas, marcas registradas a evitar)
- Dados do produto (do catálogo)
- **USP/diferencial do produto** (campo `usp_titulo` do catálogo) — TODOS os agentes devem abrir o título com o USP. O que varia entre agentes é o ângulo das keywords que vêm depois, não o USP.
- Keywords da categoria (do banco de treino)
- Pede 1-2 títulos no formato exato (sem decoração, só o título nu, com count de chars no final)

**3.2 Avaliação (Opus 4.7 — eu):**

Recebo ~10-16 títulos brutos. Filtro e pontuo cada um:

| Critério | Peso | Como medir |
|---|---|---|
| Chars dentro do limite | bloqueante | rejeita se > limite |
| Marca registrada evitada | bloqueante | rejeita se contém termo proibido |
| Palavra restrita evitada | bloqueante | rejeita se contém "promoção/melhor/oficial" |
| Densidade keyword principal | alto | termo primário aparece nos 25 chars iniciais |
| Cobertura de buscas | alto | quantos termos distintos de busca o título captura |
| Naturalidade (não-spam) | alto | não soa stuffed/repetitivo |
| Diversidade no grupo final | médio | 3 finalistas cobrem perfis diferentes |

**3.3 Seleção dos 3 finalistas:**

Agrupo por padrão semântico. Escolho 1 título de cada cluster forte (geralmente: 1 SEO-puro, 1 híbrido, 1 lifestyle). Se houver um cross-compatibility excepcional, ele substitui o híbrido.

**3.4 Apresentação ao usuário:**
- 3 finalistas, cada um com: texto do título, char count, foco principal, exemplos de buscas que vai pegar
- Mostro em tabela compacta + uma frase do "por que esse" pra cada
- Usuário escolhe — vou pro Passo 4

**Modo rápido (opcional):** se o usuário pedir "gera rápido" ou estiver em batch grande, pulo o fan-out e gero 3 títulos direto via Opus (comportamento anterior).

### Passo 4 — Salvar output

Salvar em `C:\Users\PC\Documents\Mahou Prints\products\{produto-slug}\listings\{marketplace}.md`.

**Formato do arquivo de output:**

```markdown
# Descrição: {Nome do produto} — {Marketplace}

**Gerado em:** {AAAA-MM-DD}
**Versão:** 1
**Status:** rascunho (aguarda revisão)

---

## 🏷️ Títulos (escolha 1)

### Opção A — SEO máximo ({X chars})
{título A}

### Opção B — Híbrido (RECOMENDADO) ({X chars})
{título B}

### Opção C — Lifestyle ({X chars})
{título C}

---

## 📝 Descrição

{descrição completa formatada conforme regras do marketplace}

---

## 🏷️ Tags / Hashtags

{tags ou hashtags conforme marketplace}

---

## 📋 Atributos / Ficha técnica

- Categoria: {caminho}
- Marca: Mahou Prints
- Material: PLA premium
- Cor: {cor}
- Dimensões: {dimensões}
- {outros atributos específicos do marketplace}

---

## 🧠 Análise SEO

- **Keyword principal:** {keyword} — densidade {X}x na descrição
- **Keywords secundárias usadas:** {lista}
- **Caracteres do título escolhido:** {X}/100 (limite Shopee)
- **Marca registrada — atenção:** {se aplicável, nota sobre evitar termos}

---

## 💡 Observações para o usuário

{notas livres — ex: "sugiro precificar entre R$ X e Y baseado em concorrentes", "considera oferecer kit com 2 unidades"}

---

## 🔗 Imagens disponíveis
{lista de paths se houver — útil pro upload}
```

### Passo 5 — Apresentar pro usuário

Apresentar resumo no chat:
- Quais marketplaces foram gerados
- Path de cada arquivo
- 3 opções de título (lado a lado)
- Perguntar qual título prefere por marketplace
- Após escolha, **atualizar o arquivo** marcando título escolhido (mover ele pro topo, marcar com ✅)

---

## 🛠️ Fluxo Modo 5 — `aprender`

1. Listar arquivos em `content/marketplace/treino/listings_que_funcionaram/{marketplace}/*.md`
2. Para cada arquivo, extrair:
   - Padrão do título (ordem de palavras, comprimento, uso de números, separadores)
   - Estrutura da descrição (quais blocos, em que ordem)
   - Vocabulário recorrente (verbos, adjetivos preferidos)
   - Emojis utilizados
3. Consolidar aprendizado em `content/marketplace/treino/_padrao_aprendido_{marketplace}.md`
4. Esse arquivo é lido pela skill ANTES de gerar — vira a "voz" do usuário

---

## 📚 Catálogo de produtos disponíveis

O catálogo completo está em `content/marketplace/catalogo/produtos.json`. Produtos atualmente mapeados (2026-05):

**Aprovados (em `Documents\Mahou Prints\products\`):**
- `suporte-controle-ps5` — Suporte 2 controles PS5 + headset
- `suporte-kindle-livro` — Suporte Kindle tema livro
- `suporte-kindle-nuvem` — Suporte Kindle tema nuvem
- `suporte-placa-video` — GPU Holder (anti-sag)
- `suporte-polaroid-coracao` — Porta polaroid coração
- `suporte-toalha` — Gancho de toalha banheiro
- `abajur-bubble`, `abajur-wave`, `abajur-triangular` — Luminárias decorativas
- `brinquedo-gato` — Brinquedo pet
- `contador-livros-lidos` — Contador para leitores
- `cortador-biscoito-copa`, `cortador-biscoito-patrulha-canina`, `cortador-biscoito-pokemon` — Cortadores temáticos

**Em revisão (em `products (em revisão)\`):**
- `cesta-decorativa`, `marca-pagina-quarta-asa`, `suporte-mobile-bebe`

Para produtos não listados, a skill pergunta os dados básicos antes de gerar.

---

## ⚠️ Regras críticas — marcas registradas

**NUNCA usar no título:**
- "Pokemon" → usar "monstrinho colecionável"
- "Patrulha Canina" → usar "cachorrinho" / "patinha"
- "Disney", "Marvel", "Pixar", personagens reconhecíveis → mencionar "inspirado em" só na descrição
- "PlayStation" / "PS5" → OK pra "compatível com PS5/DualSense", mas NUNCA "PlayStation original"
- "Kindle" → OK pra "compatível com Kindle" (Amazon não barra uso descritivo)

ML é o mais rigoroso — denúncia derruba anúncio em <24h. Shopee/TikTok são mais lentos mas também removem.

---

## 🎨 Tom de voz Mahou Prints

- **Premium mas acessível** — não "luxuoso", mas "cuidadoso", "artesanal", "design autoral"
- **Funcional + decorativo** — sempre destacar os 2 lados
- **Foco no 3D como diferencial** — "feito sob demanda", "impresso camada por camada"
- **Sustentável** — PLA é biodegradável, mencionar quando couber
- **Para presente** — vários produtos viram presente, sempre considerar essa abordagem

---

## 🔄 Workflow recomendado para o usuário

1. **Primeira vez:** pedir 1 descrição dum produto que você já tem na loja → comparar com o que estava antes → ajustar [keywords/](../../Marketplace/treino/keywords/) se a skill errar o tom
2. **A cada produto novo:** roda a skill, escolhe título, sobe pro marketplace
3. **Periodicamente:** rodar Modo 5 (`aprender`) se você adicionou novos exemplos em `treino/`
4. **Após 1-2 meses:** ver o que vendeu, atualizar `listings_que_funcionaram/` com os campeões → próxima geração fica ainda melhor

---

## ✅ Quando o trabalho está "pronto"

- [ ] Arquivo `listings/{marketplace}.md` salvo na pasta do produto
- [ ] 3 títulos gerados com tamanhos validados (Shopee ≤100, ML ≤60, TikTok 34-200)
- [ ] Descrição com keyword principal aparecendo 3-5x
- [ ] Marca Mahou Prints mencionada na descrição
- [ ] Atributos/categoria sugeridos preenchidos
- [ ] Marcas registradas evitadas no título
- [ ] Usuário escolheu título final → marcado com ✅ no arquivo
