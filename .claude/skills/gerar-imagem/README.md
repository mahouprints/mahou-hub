# Skill: `gerar-imagem`

Gera imagens profissionais de produtos Mahou Prints via **Google Flow + Nano Banana Pro**, com automação Playwright. Suporta batch, curadoria assíncrona, edição cirúrgica e integração com `/gerar-post`.

## Arquivo principal
- [`SKILL.md`](./SKILL.md) — workflow completo (6 modos: gerar, curar, iterar, editar, batch-autônomo, single-prompt)

## Consome

- [`content/imagegen/templates/template.json`](../../../content/imagegen/templates/template.json) — mapeamento produto→cenário + regras FDM + filamentos
- [`content/imagegen/templates/cenas/`](../../../content/imagegen/templates/cenas/) — backgrounds por mood
- [`content/memory/feedback_mahou_*.md`](../../../content/memory/) — restrições visuais (mãos, sombra, sem bebês, layers)

## Outputs locais (NÃO versionados)

- `Documents/Mahou Prints/products (em revisão)/<slug>/` — variações geradas
- `Documents/Mahou Prints/products/<slug>/` — finais aprovados
- Stays out of repo via convention (privacidade + assets pesados)

## Integração

Modo F (`single-prompt`) é invocado pela skill [`gerar-post`](../gerar-post/) quando ela precisa gerar uma imagem específica pra um post.
