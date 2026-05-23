# `content/` — assets de marca e conteúdo

Pasta com **dados de marca**, **regras**, **templates** e **base de aprendizado** consumidos pelas skills em `.claude/skills/`. Separada das skills (`.claude/skills/`) porque é dado, não código.

## Estrutura

```
content/
├── marketplace/        Regras de Shopee/ML/TikTok + catálogo de produtos + bancos de treino
│   ├── regras/         shopee.md, mercado-livre.md, tiktok-shop.md (limites, SEO, fórmulas)
│   ├── catalogo/       produtos.json — 17 produtos Mahou com keywords, USP, descrição-curta
│   └── treino/         listings que funcionaram + concorrentes + bancos de keywords por categoria
├── instagram/          Tom de voz, tipos de post, treino e calendário editorial
│   ├── tom-visual/     mahou_prints.md — vocabulário-marca, vocabulário-veneno, regras de imagem
│   ├── tipos-de-post/  milestone.md, product_showcase.md, behind_scenes.md, reels_trend.md
│   ├── treino/         exemplos do usuário + concorrentes + hashtags por categoria
│   └── calendario/     datas-importantes + planos editoriais
├── imagegen/           Templates de cenas pra geração de imagem (background + info por cena)
│   └── templates/
│       ├── template.json  config central — mapeamento produto→cena + regras FDM
│       └── cenas/         backgrounds prontos por mood (warm/dark/banheiro/etc)
└── memory/             Feedbacks (regras visuais) + references (configurações) da marca
```

## Quem consome o quê

| Skill | Lê de | Pra que |
|---|---|---|
| `gerar-imagem` | `content/imagegen/templates/` + `content/memory/feedback_mahou_*.md` | Cenário, regras FDM, restrições visuais (mãos, sombra, sem bebês) |
| `gerar-descricao` | `content/marketplace/` (regras + catálogo + treino) | Limites por marketplace, USP do produto, keywords, fórmula universal de título |
| `gerar-post` | `content/instagram/` + `content/marketplace/catalogo/` | Tipo de post, tom de voz, USP, keywords lifestyle, calendário |

## Convenções

- **Markdown** (`.md`) pra texto editorial/regras (legível por humano e LLM)
- **JSON** (`.json`) só pra estrutura tabular consultável (ex: catalogo de produtos)
- **Imagens** (`.jpeg`) só pra templates de cena (assets fixos, pequenos, raramente mudam)
- **Sem dados pessoais de clientes** — privacidade. Outputs personalizados (cartas, listings de venda real, posts com nome de cliente) ficam locais via `.gitignore`

## Como atualizar

- Aprendizado novo (lição depois de geração) → adiciona arquivo em `treino/` da skill correspondente
- Mudança de regra de marketplace → edita `marketplace/regras/<marketplace>.md`
- Produto novo no catálogo → atualiza `marketplace/catalogo/produtos.json`
- Cena nova de imagem → adiciona pasta em `imagegen/templates/cenas/<nome>/` + entrada em `template.json`
- Feedback visual novo → adiciona `memory/feedback_mahou_<tópico>.md`

Sempre via PR (não push direto na `main`).
