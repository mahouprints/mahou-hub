# Regras Mercado Livre — Títulos e Descrições

## Limites técnicos
- **Título:** ATÉ 60 CARACTERES (regra dura — cortar é morte certa)
- **Descrição:** até 50.000 caracteres (mas faça 1500-3000)
- **Imagens:** até 12 (1ª é a capa, fundo branco obrigatório)
- **Atributos (ficha técnica):** preencher TODOS os campos disponíveis — SEO crítico

## Anatomia do título (FÓRMULA UNIVERSAL Mahou Prints)

**Fórmula fixa (CRÍTICO — sem caractere separador):**
```
[Descrição curta-detalhada + USP] [Keywords SEO empilhadas]
```

**Os 60 chars são SAGRADOS.** ML usa o título como peso principal de SEO. A descrição curta abre o título (~35-40 chars) com identidade clara e USP do produto; as keywords empilhadas (~20-25 chars) maximizam buscas no resto. Transição é natural — descrição em linguagem fluida → keywords secas.

**Bloco descrição+USP (campo `descricao_curta_titulo` do catálogo):**
- Deve permitir entender O QUE É o produto e POR QUE esse é diferente, só lendo essa parte
- Exemplos: `Suporte de Controle e Headset 3 em 1`, `Abajur LED Translúcido Bubble`, `Cortador de Biscoito Tema Monstrinho Geek`

**Bloco keywords:**
- Empilha keywords técnicas mais buscadas por ordem de volume
- Sem repetir palavras do bloco descritivo
- Ex: `Ps5 Xbox Dualsense Gamer 3d`

**Exemplo final (suporte-controle-ps5, 53 chars):**
```
Suporte de Controle e Headset 3 em 1 Ps5 Xbox Gamer 3d
```

**Antes/depois:**
- ❌ Genérico (sem USP): `Suporte Controle Ps5 Dualsense Headset Gamer 3d` — anônimo
- ✅ Mahou Prints: `Suporte de Controle e Headset 3 em 1 Ps5 Xbox Gamer 3d` — identidade + USP claros + SEO mantido

### Fórmula validada por categoria
- **Suporte gamer:** `Suporte Controle Ps5 Dualsense Headset Gamer 3d` (47 chars)
- **Cortador:** `Cortador Biscoito Pokemon 8cm Confeitaria 3d Pla` (49 chars)
- **Abajur:** `Abajur Luminária Mesa Cabeceira Led 3d Quarto Decor` (52 chars)
- **Polaroid:** `Suporte Polaroid Coração Decoração Mesa 3d Pla Mahou` (52 chars)

### Regras do título
- **Primeira palavra = palavra-chave de busca principal** (o termo mais buscado)
- Sem caracteres especiais (!, *, #, |, /)
- Sem CAIXA ALTA (CamelCase é OK, ALL CAPS não)
- Sem repetição de palavras (ML deduplica e ainda penaliza)
- Sem palavras subjetivas ("lindo", "ótimo", "melhor")
- **Plural > singular** se houver dúvida ("suportes" pega mais buscas que "suporte")
- Use números/dimensões quando relevante ("8cm", "3 peças")

## Atributos (ficha técnica) — IMPORTANTE

ML preenche atributos automaticamente do título, mas **preencher manualmente é SEO premium**. Para Mahou Prints:

| Atributo | Valor |
|---|---|
| Marca | Mahou Prints |
| Modelo | [nome do produto-slug] |
| Material | PLA (Ácido Polilático) |
| Cor | [cor exata] |
| Tipo de impressão | 3D FDM |
| Acabamento | Matte/Fosco |
| Itens por kit | 1 |
| Garantia do vendedor | 30 dias |
| Condição | Novo |

## Anatomia da descrição (formato que converte no ML)

```
[Headline forte - 1 frase de impacto, em maiúsculas]

[Parágrafo 1: o problema/desejo - 2 frases]

[Parágrafo 2: a solução - como o produto resolve - 2-3 frases]

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

✅ POR QUE COMPRAR

→ [Benefício 1 - foco no resultado pro cliente]
→ [Benefício 2]
→ [Benefício 3]
→ [Benefício 4]
→ [Benefício 5]

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

📐 FICHA TÉCNICA

• Material: PLA premium (eco-friendly, sem odor)
• Dimensões: [X x Y x Z cm]
• Peso: [X g]
• Cor: [cor]
• Acabamento: matte com camadas finas 0.2mm
• Impressão: 3D FDM em alta densidade
• Tempo de impressão: cada peça é feita sob demanda

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

📦 O QUE VEM NA CAIXA

• 1x [produto descrição]
• Embalagem protegida com plástico bolha

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

💡 IDEAL PARA

[lista de 3-5 cenários de uso/público]

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

🚀 SOBRE A MAHOU PRINTS

Somos especialistas em impressão 3D personalizada. Cada peça é produzida com filamento PLA de alta qualidade, cuidadosamente impressa camada por camada e revisada antes do envio.

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

📬 ENVIO

• Despachamos em até 1 dia útil após confirmação do pagamento
• Frete via Mercado Envios (rastreável)
• Embalagem reforçada

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

❓ DÚVIDAS

Use o botão "Perguntar ao vendedor" — respondemos em horário comercial!

#[hashtags em formato ML: produto, categoria, marca, uso]
```

## SEO específico do ML
- **Repetir palavra-chave 4-6x na descrição** (ML pesa densidade)
- Hashtags no final são opcionais mas dão sinal de relevância
- Não inserir links externos (penaliza)
- Não citar concorrentes ("igual ao da loja X")
- Não usar a palavra "FRETE GRÁTIS" no título — usar campo de envio

## Categoria — CONFERIR NA API, NUNCA ESCREVER DE CABEÇA

**Regra dura: nenhum anúncio de ML sai com categoria que não veio da API do Mercado
Livre.** Categoria errada não dá erro nem aviso — o anúncio sobe, fica publicado e
simplesmente não aparece na busca de quem procurava por ele. É a falha mais cara
possível: silenciosa, e capaz de matar um produto campeão sem ninguém entender por quê.

Caminho escrito de cabeça é plausível, não existente. Exemplo real: "Brinquedos e
Hobbies > Antiestresse e Fidget Toys" parece certo e **não existe**. A árvore real é
`MLB433037` → `Brinquedos e Hobbies > Anti-stress e Engenho > Fidget Cubes`.

### Procedimento obrigatório, por produto

1. **Prever pelo título** — o ML tem preditor público, sem autenticação:
   ```
   GET https://api.mercadolibre.com/sites/MLB/domain_discovery/search?limit=5&q=<título>
   ```
   Devolve `category_id` + `category_name` ordenados por probabilidade.

2. **Confirmar o caminho e a permissão** de cada candidato:
   ```
   GET https://api.mercadolibre.com/categories/<category_id>
   ```
   Usar `path_from_root` como caminho, e conferir `settings.listing_allowed = true`.
   Categoria que não aceita anúncio é descarte imediato.

3. **Escolher a mais específica que ainda descreve o produto.** ML rebaixa categoria
   genérica. Entre uma folha e o pai dela, a folha ganha — desde que não force o
   produto pra dentro de algo que ele não é.

4. **Puxar os atributos exigidos** da categoria escolhida:
   ```
   GET https://api.mercadolibre.com/categories/<category_id>/attributes
   ```
   Todo atributo com `tags.required` precisa estar na ficha técnica antes de publicar.
   O conjunto muda por categoria — não existe ficha padrão que sirva pra todas.

5. **Gravar o `category_id`**, não só o nome. É o ID que o ML usa; nome bate mal.

### O título É a escolha da categoria

O preditor lê o **título**, então trocar uma palavra troca o ramo da árvore. Observado na
prática, no mesmo nicho de flexi articulado: "polvo" e "cobra" caem em `MLB433037`
Fidget Cubes, "macaquinho" e "peixe-boi" caem em `MLB433528` Squishies, e "boneco" cai em
`MLB1839` Figuras de Ação. Nenhuma está errada — mas a escolha do substantivo decidiu a
categoria sem ninguém perceber.

Consequência prática: escreva o título primeiro, rode o preditor, e **olhe a categoria que
saiu**. Se ela não descreve o produto, o problema costuma ser o título, não a árvore.

### Quando o preditor devolve mais de um

Comparar os candidatos pelo `path_from_root`, não pelo nome isolado — dois nomes
parecidos podem estar em ramos completamente diferentes da árvore. Na dúvida entre
dois igualmente específicos, escolher o que casa com a intenção de busca do comprador,
e registrar a dúvida pro Gabriel decidir.

### Nunca

- Copiar categoria de um produto pra outro "porque é parecido"
- Reaproveitar a categoria da Shopee ou do TikTok — são árvores diferentes
- Publicar com categoria que não passou pelos passos acima

## Reputação MercadoLíder
- Tempo de resposta: <1h dá peso máximo
- Cancelamentos: <2% pra manter MercadoLíder
- Devoluções: oferecer 30 dias é diferencial

## Catastrofes a evitar
- Título 61+ chars: ML rejeita
- Vender produto com marca registrada de terceiros sem autorização (Disney, Pokemon, marcas registradas) → denúncia derruba
- Mesma palavra-chave 2x no título → "estufamento" → ML reduz exibição
