# Critérios "imprimível em 3D"

Heurísticas pra decidir se um candidato faz sentido pro catálogo da Mahou (impressão 3D em filamento PLA/PETG, impressoras Bambu A1 e H2C).

## ✅ Encaixa bem

**Decoração e colecionáveis:**
- Miniaturas (action figures, personagens, animais)
- Vasos decorativos, porta-velas, esculturas
- Quadros, plaquinhas, totens

**Geek / pop culture:**
- Itens temáticos (anime, games, séries, filmes) — atenção a IP, ver "Risco legal" abaixo
- Replicas de armas/itens de jogo (sem função real)

**Funcionais simples:**
- Organizadores (porta-canetas, porta-controle, porta-óculos)
- Suportes (de celular, headset, mic, parede)
- Ganchos, cabides, prendedores
- Peças de reposição plásticas (engates, manopla, botão)
- Bijuteria/acessórios (brincos, pingentes, ímãs)

**Utilitários de cozinha:**
- Porta-rolos, suportes pra esponja, organizadores de gaveta
- Moldes pra biscoito/massa (PETG food-safe-ish)

## ❌ Não encaixa

- **Eletrônicos** (com circuito, bateria, motor — não dá pra imprimir o miolo)
- **Têxteis** (roupa, tecido, almofada)
- **Alimentos, cosméticos, suplementos**
- **Peças metálicas** (rolamento, ferramenta de aço)
- **Mecanismos complexos** (engrenagens precisas, peças móveis com tolerância < 0.2mm)
- **Itens muito grandes** (>2000mm³ — tempo + filamento insustentáveis)
- **Itens muito baratos** (<R$15 — concorrência com produção em massa de injeção plástica)

## ⚠️ Risco legal

Sinalizar (não descartar automaticamente) quando o nome ou imagem indicar:

- **Personagens licenciados**: Disney, Pixar, Marvel, DC, Star Wars, Pokémon, Nintendo
- **Marcas/logos**: Nike, Adidas, Apple, Coca-Cola, etc.
- **Esportes**: escudos de times, números de jogadores

Mahou pode optar por produzir mesmo assim (área cinza, pequeno volume), mas você deve avisar nas `notas` da oportunidade. Use score -20 pontos como penalidade.

## Casos limítrofes (avaliar caso a caso)

- **Pet products**: comedouro, brinquedo simples → OK, mas validar segurança (PLA não é ideal pra mordedor)
- **Brinquedos infantis**: OK se for >3 anos (não há risco de engasgo com peças pequenas)
- **Itens com íma/parafuso embutido**: OK, monta-se depois da impressão
- **Itens transparentes**: NÃO (filamento PLA/PETG não fica transparente como acrílico injetado)

## Como aplicar

1. Olhe o `productName`
2. Olhe a `imageUrl` (você é multimodal — usa a imagem)
3. Veja `categoriaIds` (Shopee) — útil como pista, não decisivo
4. Decida: ✅ encaixa, ❌ descarta, ⚠️ marcar com risco

Quando em dúvida: deixe a heurística mais conservadora vencer. Volume e demanda já vão filtrar via `vendasMin`.

## Categorias Shopee úteis

Use a tool `categorias_shopee_3d` pra ver a lista curada (id + nome + notas). Atualmente
cobertas: Casa e Decoração, Organização, Acessórios celular/gamer, Pet, Cozinha, Bijuteria,
Brinquedos. Pra `tipo='categoria'` em `buscar_oportunidades`, passe o `id` retornado.

Se notar nas buscas por keyword que um `productCatId` recorrente é interessante mas não está
na lista, avise o usuário — alguém pode adicionar manualmente em `shopee-categorias-3d.ts`.
