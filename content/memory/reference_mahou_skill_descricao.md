---
name: Mahou Prints — skill /gerar-descricao
description: Skill criada para gerar descrições e títulos otimizados para Shopee, Mercado Livre e TikTok Shop dos produtos Mahou Prints
type: reference
originSessionId: 7ab024af-87a3-495a-aa14-5bbf9e5bcbcc
---
A skill `/gerar-descricao` (em `~/.claude/commands/gerar-descricao.md`) gera descrição + título + tags + atributos otimizados para os 3 marketplaces que o usuário usa: Shopee, Mercado Livre, TikTok Shop.

**Arquitetura:**
- `~/Marketplace/regras/{shopee,mercado-livre,tiktok-shop}.md` — regras técnicas e SEO de cada marketplace (limites de chars, estrutura, palavras restritas)
- `~/Marketplace/catalogo/produtos.json` — catálogo completo de 16+ produtos Mahou Prints com keywords primárias/secundárias/lifestyle, público, benefícios, categoria por marketplace, e regras de marcas registradas
- `~/Marketplace/treino/` — base de aprendizado que o usuário preenche conforme usa (listings que funcionaram + concorrentes + bancos de keywords por categoria)
- Output salvo em `C:\Users\PC\Documents\Mahou Prints\products\{produto-slug}\listings\{marketplace}.md`

**Tom configurado:** misto SEO-first (keywords agressivas + benefícios funcionais/emocionais)

**5 modos:** gerar (1 produto), gerar-batch (vários), refinar (atualizar existente), traduzir (adapta entre marketplaces), aprender (extrai padrão dos exemplos de treino).

**Sempre gera 3 opções de título:** SEO máximo / Híbrido (recomendado) / Lifestyle — usuário escolhe.

**Marcas registradas críticas que NÃO entram no título:** Pokemon, Patrulha Canina, Disney/Marvel, PlayStation (PS5 OK como "compatível com"). Lista completa em `produtos.json > regras_marcas_registradas`.

**Histórico de nome:** originalmente criada como `gerar-listing`, renomeada para `gerar-descricao` em 2026-05-18 (sem cedilha para compatibilidade com filesystem).
