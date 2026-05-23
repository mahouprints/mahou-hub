---
name: Mahou Prints — skill /gerar-post
description: Skill criada para gerar copy + hashtags + visual briefing pra posts no Instagram @MahouPrints
type: reference
originSessionId: 7ab024af-87a3-495a-aa14-5bbf9e5bcbcc
---
A skill `/gerar-post` (em `~/.claude/commands/gerar-post.md`) gera copy, hashtags e briefing visual pra posts no Instagram @MahouPrints. Suporta 4 tipos prioritários: **product showcase**, **milestone**, **behind the scenes**, **reels/trend**.

**Arquitetura:**
- `~/Instagram/tipos_de_post/{showcase,milestone,behind_scenes,reels_trend}.md` — regras detalhadas por tipo
- `~/Instagram/tom_visual/mahou_prints.md` — voz e estilo Instagram da marca (paleta, vocabulário-marca/veneno, hooks que funcionam)
- `~/Instagram/calendario/datas_importantes.md` — sazonalidade BR TIER 1/2/3 + janelas de teasing
- `~/Instagram/treino/` — base de aprendizado (concorrentes-referência, posts que funcionaram, hashtags por nicho)
- Output salvo em `~/Instagram/posts/{AAAA-MM-DD}_{slug}/post.md` + `producao.md`

**Lógica de produção visual (atualizada 2026-05-20):**
- Pra **vídeos** (reels, stories animados): a skill gera ROTEIRO cena-por-cena com tempo, visual, câmera, texto na tela, audio e objetivo de cada cena
- Pra **imagens** (fotos, carrossel, slides): gera DESCRIÇÃO completa pronta pra colar direto na skill `/gerar-imagem` OU direcionar fotógrafo, com specs técnicas, paleta, mood, regras Mahou
- Pra **slides tipográficos**: especifica fonte, tamanho, cor exata, ornamento, fundo
- Sempre prioriza imagens existentes em `Documents/Mahou Prints/products/{slug}/` antes de pedir geração nova
- Skill conecta com `/gerar-imagem` por descrições compatíveis

**Integração com /gerar-imagem (Modo 5 — produzir-imagens, criada 2026-05-20):**
- Quando o usuário pede "gera post com imagem" ou "gera as imagens do post X", o fluxo é orquestrado:
  1. Gera o post normalmente (copy + producao.md com descrições)
  2. Pra cada imagem em producao.md: verifica REUSO em `Documents/Mahou Prints/products/{slug}/` ANTES de gerar nova
  3. Pra imagens que precisam gerar: invoca `/gerar-imagem` Modo F (single-prompt) com o prompt da descrição
  4. Salva resultados em `~/Instagram/posts/{slug}/imagens/variacoes/`
  5. Atualiza producao.md trocando 🔴 PENDENTE por ✅ REUSADA ou 🟡 GERADA (aguarda escolha)
- **Modo F na /gerar-imagem:** modo cirúrgico criado especificamente pra ser chamado pela /gerar-post. Diferente do Modo A (batch geral) — recebe 1 prompt pronto, cenário definido, gera 4 variações na pasta do POST (não na do produto).
- **Critério de reuso:** mesmo produto + mesmo cenário + mesmo ângulo geral + mood compatível. Nunca reusar pra imagens com contexto específico (ex: carta com nome do cliente).
- **Status no producao.md:** 🔴 pendente / ✅ reusada / 🟡 gerada (aguarda curadoria) / 🟢 aprovada

**Compartilha com /gerar-descricao:**
- Catálogo `~/Marketplace/catalogo/produtos.json` (fonte única dos produtos)
- Memória feedback USP-first
- Regras de marca registrada
- Pattern generator-evaluator (fan-out Sonnet → curadoria Opus)

**Modos:** gerar (1 post), milestone (sub-modo emocional), calendario (sugere 5-7 posts pros próximos 14d), aprender (extrai padrão de concorrentes).

**Generator-evaluator:** dispara 6 Sonnets em paralelo com hooks diferentes (autoral, curioso, emocional, prático, lifestyle, técnico-acessível). Opus avalia e seleciona 3 finalistas representativos.

**Treino escolhido pelo usuário em 2026-05-20:** baseado em concorrentes/marcas-referência (não em posts próprios — conta nova).

**Decisão arquitetural:** skill SEPARADA da /gerar-descricao (não modo). Posts ≠ listings: objetivos diferentes (descoberta vs venda direta), métricas diferentes (alcance/save vs CTR/conversão), estruturas diferentes (8+ tipos de post vs 3 marketplaces). Mas compartilham catálogo e memória de marca.
