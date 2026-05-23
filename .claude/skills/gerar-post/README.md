# Skill: `gerar-post`

Gera **posts completos pra Instagram** (@MahouPrints): copy + hashtags + horário + roteiros de vídeo + descrições de imagem prontas pra `/gerar-imagem`. Arquitetura generator-evaluator (fan-out Sonnet + curadoria Opus).

## Arquivo principal
- [`SKILL.md`](./SKILL.md) — workflow completo (5 modos: gerar, gerar-batch, refinar, aprender, produzir-imagens) + lógica de produção visual (roteiros vs descrições)

## Consome

- [`content/instagram/tipos-de-post/{milestone,product_showcase,behind_scenes,reels_trend}.md`](../../../content/instagram/tipos-de-post/) — regras por tipo + templates de roteiro
- [`content/instagram/tom-visual/mahou_prints.md`](../../../content/instagram/tom-visual/mahou_prints.md) — vocabulário-marca + vocabulário-veneno + regras de imagem
- [`content/instagram/treino/`](../../../content/instagram/treino/) — exemplos do usuário + concorrentes + hashtags
- [`content/instagram/calendario/datas_importantes.md`](../../../content/instagram/calendario/datas_importantes.md) — sazonalidade detectada automaticamente
- [`content/marketplace/catalogo/produtos.json`](../../../content/marketplace/catalogo/produtos.json) — USP, keywords lifestyle, público

## Outputs locais (NÃO versionados)

- `Instagram/posts/<AAAA-MM-DD>_<slug>/` — posts com dados específicos (cliente, contexto, imagens curadas)
- Privacidade: posts referem clientes reais, têm imagens geradas em variações

## Integrações ativas

- **Invoca `/gerar-imagem`** (Modo F single-prompt) automaticamente quando o post precisa de imagem nova que não tem reuso disponível em `Documents/Mahou Prints/products/<slug>/`
- **Lê catálogo de `gerar-descricao`** pra puxar USP e keywords lifestyle de cada produto envolvido
