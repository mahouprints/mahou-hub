# Skill: Gerador de Posts Instagram (Mahou Prints)

Gera **copy + hashtags + sugestão visual + horário** pra posts no @MahouPrints. Suporta 4 tipos prioritários: product showcase, milestone, behind the scenes, reels/trend. Compartilha catálogo de produtos com a `/gerar-descricao` mas tem regras próprias de tom e formato.

## 🎯 Quando usar
- Vai postar algo novo e precisa de copy
- Quer celebrar um marco (primeira venda, 100ª, aniversário, etc)
- Tem produto novo e precisa anunciar
- Quer mostrar bastidores do processo 3D
- Quer aproveitar uma trend rolando

## 📂 Estrutura de pastas

```
content/instagram/                              # base de conhecimento
├── tipos_de_post/                        # 📜 regras por tipo
│   ├── product_showcase.md
│   ├── milestone.md
│   ├── behind_scenes.md
│   └── reels_trend.md
├── calendario/
│   └── datas_importantes.md              # 📅 sazonalidade BR
├── tom_visual/
│   └── mahou_prints.md                   # 🎨 voz e estilo da marca
└── treino/                               # 🎓 base de aprendizado
    ├── COMO_TREINAR.md
    ├── posts_que_funcionaram/            # 🟢 sucessos seus
    ├── concorrentes/                     # 🔵 marcas-referência
    └── hashtags/                         # 🟡 banco por categoria

content/marketplace/catalogo/produtos.json      # 🧠 COMPARTILHADO com /gerar-descricao

content/instagram/posts/{AAAA-MM-DD}_{slug}/    # 📤 OUTPUT — salvo aqui
├── post.md                                # copy + hashtags + análise
└── visual_briefing.md                     # briefing pra foto/reels
```

## 🚀 Modos de operação

### Modo 1 — `gerar` (padrão)
Gera 1 post baseado em input do usuário: tipo + produto (opcional) + contexto.

**Comando típico:** "gera post de showcase do abajur-bubble"

### Modo 2 — `milestone`
Sub-modo dedicado pra marcos especiais (primeira venda, 100ª, aniversário). Tom mais emocional, storytelling longo.

**Comando típico:** "gera post de milestone — primeira venda do produto X pra cliente Y"

### Modo 3 — `calendario`
Verifica o calendário, sugere 3-5 posts pros próximos 14 dias baseado em datas próximas.

**Comando típico:** "que posts devo fazer nas próximas 2 semanas?"

### Modo 4 — `aprender`
Lê posts em `treino/posts_que_funcionaram/` e `treino/concorrentes/` e atualiza padrões aprendidos. Roda periodicamente.

**Comando típico:** "aprende com os posts e concorrentes que adicionei"

### Modo 5 — `produzir-imagens` (integração com /gerar-imagem)
Lê o `producao.md` dum post já gerado e processa cada descrição de imagem pendente:
1. Verifica se há imagem existente em `Documents/Mahou Prints/products/{slug}/` que serve → **reusa**
2. Pra cada descrição que precisa gerar, **invoca a skill `/gerar-imagem`** com o prompt
3. Salva as imagens geradas em `content/instagram/posts/{post-slug}/imagens/`
4. Atualiza o `producao.md` trocando `🔴 pendente` por `✅ caminho/da/imagem.jpeg`

**Comando típico:** "gera as imagens do post da primeira venda da Izadora"

**Alias automático:** quando o usuário pede "gera post X **com imagem**" ou "gera post + visual", a skill `/gerar-post` roda Modo 1 (gerar) seguido automaticamente do Modo 5 (produzir-imagens).

---

## 🛠️ Fluxo padrão (Modo 1 — gerar)

### Passo 1 — Coleta de contexto

**Ler obrigatoriamente:**
1. `content/instagram/tom_visual/mahou_prints.md` — voz da marca
2. `content/instagram/tipos_de_post/{tipo}.md` — regras do tipo de post solicitado
3. `content/instagram/calendario/datas_importantes.md` — verificar se data atual está perto de marco sazonal
4. Se há produto envolvido: `content/marketplace/catalogo/produtos.json > produtos.{slug}` — pegar USP, keywords, público, benefícios
5. Se há nicho relevante: `content/instagram/treino/hashtags/{categoria}.md` (se existir)
6. Se há concorrentes referência: listar arquivos em `content/instagram/treino/concorrentes/`

### Passo 2 — Decidir contexto sazonal

Antes de gerar copy, **verificar se há sazonalidade próxima**:

- Se TIER 1 está a 7-30 dias → adaptar ângulo do post (ex: showcase do controle PS5 perto do Dia dos Pais vira "presente perfeito pro pai gamer")
- Se TIER 2/3 cai esta semana → considerar mencionar
- Se data sazonal já passou → ignorar

### Passo 3 — Geração via fan-out

**Arquitetura generator-evaluator (mesma da /gerar-descricao):**

#### 3.1 Fan-out (paralelo, Sonnet 4.6)

Disparar 6 agentes Sonnet em paralelo via tool `Agent` com `model: "sonnet"`, cada um com brief especializado:

| # | Foco do agente |
|---|---|
| 1 | Hook autoral — abertura com tom Mahou (artesanal, "tem coisa que...") |
| 2 | Hook curioso/pergunta — abertura provocando reflexão |
| 3 | Hook emocional/storytelling — para milestone ou produto com história |
| 4 | Hook prático/funcional — foco no benefício direto |
| 5 | Hook trend/lifestyle — adaptado a vibe atual (cantinho cozy, aesthetic) |
| 6 | Hook técnico-acessível — mostra processo/diferencial sem ser tutorial |

**Cada agente recebe:**
- Tipo de post (regras do arquivo correspondente)
- Tom de voz Mahou Prints (do `tom_visual/mahou_prints.md`)
- Dados do produto (se aplicável)
- Sazonalidade detectada (se aplicável)
- Pede: 1 copy completa (hook + corpo + CTA), no formato e tamanho do tipo de post

#### 3.2 Avaliação (Opus 4.7 — eu)

Recebo 6 copies. Filtro e pontuo cada uma:

| Critério | Peso |
|---|---|
| Tom Mahou Prints respeitado (vocabulário-marca presente, vocabulário-veneno ausente) | Alto |
| Tamanho dentro do range do tipo de post | Bloqueante |
| Hook é específico (não genérico tipo "você ama X?") | Alto |
| CTA é convite, não venda agressiva | Alto |
| Tem ao menos 1 frase que NÃO funcionaria pra outra marca | Alto |
| Naturalidade — passa no teste de "ler em voz alta sem cringe" | Alto |
| Inclui USP do produto (se aplicável) sem virar pitch | Médio |

#### 3.3 Seleção de 3 finalistas

Agrupo por ângulo. Escolho 3 que cobrem perfis complementares (geralmente: 1 autoral, 1 emocional/storytelling, 1 prático/lifestyle).

### Passo 4 — Gerar hashtags estratificadas

Após copy escolhida (ou junto com os 3 finalistas), monto bloco de hashtags:

- Consulta `content/instagram/treino/hashtags/{categoria}.md` se existir
- Mistura 3 níveis: alto volume (8-10) + médio volume (10-12) + nicho (8-10)
- Sempre inclui `#mahouprints`
- Adapta ao tipo de post: showcase usa ~30, BTS ~20, milestone ~15, reels ~12

### Passo 5 — Produzir ROTEIROS (vídeo) e/ou DESCRIÇÕES (imagem)

**Mudança importante:** em vez de um briefing visual genérico, a skill agora entrega artefatos PRONTOS PRA USAR:
- Pra **vídeos** (reels, stories animados, carrossel com vídeo) → **roteiro cena-por-cena detalhado**
- Pra **imagens** (fotos, carrossel estático, slides tipográficos) → **descrição completa pronta pra colar na `/gerar-imagem` ou direcionar fotógrafo**

A skill DECIDE quais artefatos gerar baseado no tipo de post:

| Tipo de post | Artefatos padrão |
|---|---|
| Product showcase | 1-3 descrições de imagem (foto única ou carrossel) |
| Milestone | 3-4 descrições de imagem (carrossel) + roteiro de reels se houver timelapse/material em vídeo |
| Behind the scenes | 1 roteiro de reels (geralmente formato chefe) + 1-2 descrições de imagens auxiliares |
| Reels/trend | 1 roteiro de reels detalhado + capa thumbnail (descrição de imagem) |

#### 5.1 Formato ROTEIRO (pra reels/vídeo)

Estrutura obrigatória do roteiro:

```
ROTEIRO REELS — {título descritivo}

⏱️ Duração total: {Xs} (sweet spot 15-22s)
🎬 Aspect ratio: 9:16 (1080x1920)
🎵 Audio: {trend específico OU descrição do mood — ex: "lo-fi calmo sem letra"}
🎯 Objetivo: {hook, ensinar, vender, emocionar}

──────────────────────────────────────────

CENA 1 (0-2s) — Hook
  📷 Visual: {descrição do que aparece}
  🎬 Câmera: {ângulo, movimento — ex: "close-up estático" / "zoom out lento"}
  ✏️  Texto na tela: "{texto exato}" (fonte, posição, duração)
  🔊 Audio: {o que toca aqui — momento da música, voz, som ambiente}
  🎯 Objetivo: parar o scroll

CENA 2 (2-5s) — Contexto
  📷 Visual: ...
  🎬 Câmera: ...
  ✏️  Texto na tela: ...
  🔊 Audio: ...

CENA 3 (5-15s) — Desenvolvimento
  ...

CENA 4 (15-20s) — Clímax/Reveal
  ...

CENA 5 (20-{X}s) — CTA visual
  📷 Visual: produto final / logo
  ✏️  Texto na tela: "@MahouPrints · feito sob demanda"
  🎯 Objetivo: fixar marca

──────────────────────────────────────────

📋 Checklist de produção
- [ ] Gravar/editar material da Cena 1
- [ ] ...
- [ ] Aplicar texto sobreposto
- [ ] Sincronizar com audio
- [ ] Exportar 9:16 1080x1920

🎵 Sugestão de audio Instagram (verificar antes de gravar)
- Trend atual recomendado: {especificar}
- Alternativas: {2-3 opções}
```

#### 5.2 Formato DESCRIÇÃO (pra imagem)

Estrutura obrigatória da descrição de imagem:

```
IMAGEM {N} — {função no carrossel, ex: "Hero shot", "Detalhe macro", "Tipografia"}

🎯 Função no post: {por que essa imagem existe — ex: "parar o scroll", "humanizar", "fixar data do marco"}

📐 Specs técnicas
  • Aspect ratio: {4:5 / 1:1 / 9:16}
  • Resolução: {1080x1350 / 1080x1080 / etc}
  • Formato: {JPEG / PNG}

📷 DESCRIÇÃO PRONTA PRA /gerar-imagem (copia e cola)

"""
{Prompt em inglês ou português, ESTILO Mahou Prints, pronto pra alimentar a
skill /gerar-imagem ou direcionar fotógrafo. Inclui: produto, cenário,
iluminação, câmera, mood, paleta, elementos de cena.}
"""

🎨 Elementos-chave (resumo executivo)
  • Cenário: {warm wood / dark moody / bathroom marble / etc — referenciar template.json}
  • Iluminação: {2700K warm / golden hour / etc}
  • Câmera/Lente: {Sony FE 90mm f/2.8 macro / iPhone modo retrato / etc}
  • Mood: {cozy / minimalista / dramático}
  • Paleta dominante: {warm wood + marfim + dourado fosco / etc}
  • Composição: {produto ocupa 60-70% do frame, sombra abaixo, ângulo 3/4 / etc}

⚠️  Regras Mahou (sempre verificar)
  • Sombra visível abaixo do produto (nada flutuando)
  • Camadas FDM sutis em hero, visíveis em macro
  • Sem bebês/crianças, sem mãos com esmalte
  • Logo Mahou Prints respeitado se aparecer

🖼️  Alternativa rápida — usar imagem existente
  • Se há foto em `Documents/Mahou Prints/products/{slug}/` que serve: {listar caminho}
  • Senão: gerar nova com /gerar-imagem usando a descrição acima
```

#### 5.3 Slides tipográficos (quando aplicável)

Pra slides de texto puro (ex: "nossa primeira venda · 20 de maio"), gerar:

```
SLIDE TIPOGRÁFICO {N}

📐 Aspect: 4:5 ou 1:1
🎨 Fundo: {cor exata, ex: #faf5ec marfim}
✏️  Tipografia:
  • Texto principal: "{texto}" — fonte {EB Garamond/Cormorant} {peso} {tamanho}
  • Texto secundário: "{texto}" — fonte {fonte} {peso} {tamanho} cor {#hex}
  • Ornamento: {linha fina dourada / três pontos · · · / nenhum}
📍 Onde criar: Canva ou Figma (template pode ser salvo pra reuso)
```

#### 5.4 Integração com `/gerar-imagem` — workflow automatizado

A skill `/gerar-post` é **integrada** com `/gerar-imagem`. Quando o usuário pede um post com imagem (explícito ou implícito), o fluxo é:

```
1. Gera o post (copy + producao.md com descrições)
        ↓
2. Pra cada IMAGEM N em producao.md:
        ↓
   2.1 REUSO — busca em Documents/Mahou Prints/products/{slug}/
       Existe imagem que casa com descrição (mesmo cenário, mesmo ângulo, mesmo mood)?
       → SIM: marca como ✅ REUSADA, copia/linka pra content/instagram/posts/{slug}/imagens/
       → NÃO: vai pro passo 2.2
        ↓
   2.2 GERAÇÃO — invoca a skill /gerar-imagem com o prompt da descrição
       Resultado: 4 variações geradas na pasta do post
       → marca como 🟡 GERADA (aguarda escolha de variação)
        ↓
3. Atualiza producao.md com status de cada imagem
4. Apresenta ao usuário: imagens reusadas + imagens geradas pra escolher variação
```

**Status possíveis no producao.md:**
- 🔴 **PENDENTE** — descrição existe mas imagem ainda não foi reusada nem gerada
- ✅ **REUSADA** — imagem existente da pasta do produto foi linkada (caminho registrado)
- 🟡 **GERADA — variações pra escolher** — /gerar-imagem rodou, 4 variações disponíveis
- 🟢 **APROVADA** — usuário escolheu variação final (caminho final registrado)

**Pasta de imagens por post:**
```
content/instagram/posts/{AAAA-MM-DD}_{slug}/
├── post.md
├── producao.md
└── imagens/                              # NOVA
    ├── slide1_hero.jpeg                  # final escolhida (após curadoria)
    ├── slide2_macro.jpeg
    ├── slide3_embalagem.jpeg
    ├── slide4_tipografia.png             # pode ser feito no Canva e jogado aqui
    ├── reels_capa.jpeg
    └── variacoes/                        # rascunhos das 4 variações por imagem
        ├── slide1_hero_var{1-4}.jpeg
        └── ...
```

**Quando reusar vs gerar — critérios de match:**
- ✅ Reuso vale se:
  - Mesmo produto
  - Mesmo cenário (warm wood / bathroom / dark moody / etc) — campo "Cenário" da descrição
  - Mesmo ângulo geral (hero / macro / instalado / top-down)
  - Mood compatível
- ❌ Não reusar se:
  - Cliente/contexto específico (ex: imagem precisa mostrar carta com nome da Izadora — gerar nova)
  - Slide tipográfico (criar no Canva, não via /gerar-imagem)
  - Reels (vídeo, /gerar-imagem só faz imagem estática)

**Pra mim (Opus) executar a integração:**
1. Após gerar o post e producao.md, listo as imagens em `Documents/Mahou Prints/products/{slug}/` (ferramenta Bash/Glob)
2. Pra cada IMAGEM N, comparo a descrição com as existentes
3. Se reuso: marco no producao.md + opcionalmente copio pra imagens/ ou só linkando
4. Se gerar: invoco a Skill tool com `gerar-imagem` passando o produto + prompt da descrição
5. Aguardo a /gerar-imagem terminar
6. Lista as variações + pede curadoria do usuário

### Passo 6 — Sugerir horário

Baseado em:
- Tipo de post (ver tabela em cada `tipos_de_post/*.md`)
- Dia da semana atual
- Audiência de Mahou Prints (decor + gamer + leitura = noite > manhã)

### Passo 7 — Salvar output

Salvar em `content/instagram/posts/{AAAA-MM-DD}_{slug}/post.md` e `visual_briefing.md`.

**Estrutura de output:**

Por padrão, cada post gera 2 arquivos:

- `post.md` — copy + hashtags + horário + análise (a parte verbal/estratégica)
- `producao.md` — roteiros e/ou descrições de imagem (a parte de produção visual)

> Nota: antes esse segundo arquivo se chamava `visual_briefing.md`. Renomeado pra `producao.md` pra refletir que agora contém roteiros executáveis e descrições prontas, não só "ideias" de visual.

**Formato do `post.md`:**

```markdown
# Post: {tipo} — {produto ou tema} — {data}

**Gerado em:** {AAAA-MM-DD}
**Tipo:** {showcase/milestone/bts/reels}
**Status:** rascunho — aguarda escolha de finalista

---

## 📝 Copies (escolha 1)

### Opção A — {ângulo}
```
{copy completa A}
```
**Por que:** {1 frase de fundamentação}

### Opção B — {ângulo} ⭐ RECOMENDADO
```
{copy completa B}
```
**Por que:** {1 frase}

### Opção C — {ângulo}
```
{copy completa C}
```
**Por que:** {1 frase}

---

## 🏷️ Hashtags ({N} total — estratificadas)

**Alto volume:**
{lista}

**Médio volume:**
{lista}

**Nicho:**
{lista}

---

## 🕐 Horário sugerido

{Dia + horário} — {motivo}

---

## 🎬 Produção (roteiros + descrições de imagem)

Ver arquivo [producao.md](producao.md) — contém:
- Roteiros cena-por-cena pra qualquer vídeo/reels
- Descrições prontas pra colar na `/gerar-imagem` pra cada foto necessária
- Specs técnicas, fonts, paleta, ornamentos pra slides tipográficos
- Lista de imagens já existentes que podem ser reusadas

---

## 🧠 Análise

- **Sazonalidade detectada:** {se aplicável}
- **USP destacado:** {USP do produto, se aplicável}
- **Concorrente referenciado:** {se baseou em algum padrão da pasta concorrentes}
- **Densidade tom-marca:** {N expressões-marca usadas / 1-2 frases únicas}

---

## ✅ Checklist pré-publicação

- [ ] Copy final escolhida
- [ ] Visual pronto (foto/reels gravado e editado)
- [ ] Hashtags revisadas (nenhuma banida)
- [ ] Horário programado
- [ ] Story complementar pensado (opcional)
```

### Passo 8 — Apresentar ao usuário

Mostrar resumo no chat:
- 3 opções de copy lado a lado
- Indicar a recomendada com ⭐
- Mostrar bloco de hashtags
- Mostrar briefing visual em 1 parágrafo
- Mostrar horário
- Perguntar qual escolher

Após escolha, marcar com ✅ no arquivo.

---

## 🛠️ Modo `calendario`

1. Verificar data atual
2. Listar próximas datas TIER 1 e TIER 2 (próximos 30 dias)
3. Pra cada data próxima, sugerir 1-2 posts (tipo + produto + ângulo)
4. Apresentar plano de 5-7 posts pros próximos 14 dias
5. Salvar em `content/instagram/calendario/plano_{AAAA-MM-DD}_a_{AAAA-MM-DD}.md`

## 🛠️ Modo `aprender`

1. Listar arquivos em `content/instagram/treino/posts_que_funcionaram/` e `content/instagram/treino/concorrentes/`
2. Pra cada, extrair:
   - Padrão de hook
   - Estrutura de copy
   - Vocabulário recorrente
   - Tipo de hashtag usada
3. Consolidar em `content/instagram/treino/_padrao_aprendido.md`
4. Skill consulta esse arquivo ANTES de gerar — vira "voz" treinada

---

## 🎨 Princípios universais

- **Tom Mahou Prints**: elegante mas acessível, técnica quando precisa, emocional sem ser piegas. Consulta `tom_visual/mahou_prints.md` SEMPRE
- **USP-first** (quando há produto): o diferencial aparece logo nas primeiras frases, igual aos títulos da `/gerar-descricao`. Consulta `produtos.json > {slug}.usp`
- **Marca registrada**: mesmas regras da `/gerar-descricao` — sem "oficial Sony", sem "Pokemon" direto, etc
- **Hashtags estratificadas**: nunca rajada plana — sempre 3 níveis
- **CTA convite, não venda**: "comenta", "marca alguém", "salva pra inspirar" — nunca "compra agora"
- **Sazonalidade**: sempre verificar calendário antes de gerar

---

## 🤝 Relação com /gerar-descricao

| Compartilhado | Específico de cada skill |
|---|---|
| `content/marketplace/catalogo/produtos.json` | Regras de marketplace vs regras de post |
| Memória feedback de tom (USP-first) | Memória feedback de tom de Instagram (autoral, sem cringe) |
| Regras de marca registrada | Formato do output (listing vs post) |
| Princípio fan-out Sonnet → curadoria Opus | Tipos de fan-out diferentes |

Atualizações no catálogo de produtos (`produtos.json`) BENEFICIAM AMBAS as skills automaticamente — é a fonte única de verdade dos produtos.

---

## ✅ Quando o trabalho está "pronto"

- [ ] Arquivo `posts/{data}_{slug}/post.md` salvo
- [ ] Arquivo `posts/{data}_{slug}/producao.md` salvo com roteiros e/ou descrições
- [ ] 3 opções de copy geradas via fan-out Sonnet + curadoria Opus
- [ ] Hashtags estratificadas em 3 níveis
- [ ] Para vídeos: roteiro cena-por-cena com tempo, visual, câmera, texto na tela e audio
- [ ] Para imagens: descrição pronta pra colar na `/gerar-imagem` + alternativa de imagem existente
- [ ] Horário sugerido
- [ ] Sazonalidade verificada
- [ ] Tom Mahou Prints respeitado (palavras-marca presentes, vocabulário-veneno ausente)
- [ ] Usuário escolheu finalista
