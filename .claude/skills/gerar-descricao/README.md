# Skill: `gerar-descricao`

Gera **títulos otimizados** e **descrições completas** de produtos Mahou Prints para Shopee, Mercado Livre e TikTok Shop. Tom misto SEO-first, fórmula universal `[Descrição curta+USP] [Keywords empilhadas]` sem caractere separador.

## Arquivo principal
- [`SKILL.md`](./SKILL.md) — workflow completo (5 modos: gerar, gerar-batch, refinar, traduzir, aprender) + arquitetura generator-evaluator (fan-out Sonnet + curadoria Opus)

## Consome

- [`content/marketplace/regras/{shopee,mercado-livre,tiktok-shop}.md`](../../../content/marketplace/regras/) — limites e regras SEO de cada marketplace
- [`content/marketplace/catalogo/produtos.json`](../../../content/marketplace/catalogo/produtos.json) — 17 produtos com USP, keywords, descrição-curta-título
- [`content/marketplace/treino/`](../../../content/marketplace/treino/) — listings que funcionaram + concorrentes + bancos de keywords
- [`content/memory/feedback_mahou_titulos_usp_first.md`](../../../content/memory/feedback_mahou_titulos_usp_first.md) — fórmula universal de título Mahou

## Outputs locais (NÃO versionados)

- `Documents/Mahou Prints/products/<slug>/listings/<marketplace>.md` — listings prontos pra subir
- Privacidade: títulos/descrições contêm a copy comercial em si

## Sem integração ativa

Pode ser combinada manualmente com `/gerar-imagem` (referência ao mesmo produto) mas não há orquestração automática.
