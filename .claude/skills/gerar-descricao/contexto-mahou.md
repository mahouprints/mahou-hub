# Contexto do negócio — Mahou Prints

> Este arquivo é a **memória de negócio** da skill. O Gabriel edita aqui quando algo muda;
> a skill lê antes de gerar qualquer coisa. Se um número aqui contradiz o Hub, **o Hub vence**
> (ele é a fonte viva); este arquivo guarda o que o Hub não sabe: estratégia, tom, decisões.

## O negócio em cinco linhas

Mahou Prints é uma loja de produtos impressos em 3D, operada pelo Gabriel. Vende
principalmente na **Shopee**, com presença no **Mercado Livre** e planos para TikTok Shop.
Produção própria com impressora **Bambu Lab A1** (uma unidade — a fila é o gargalo real do
negócio). Tudo é feito sob demanda ou em pequenos lotes de estoque.

O ERP é o **Mahou Hub** (`hub.mahouprints.com`), onde vivem produtos, custos, filamentos,
estoque, produção e a prospecção de modelos do MakerWorld.

## Quem decide o quê

- **Gabriel** — dono, decide preço, o que produzir e o que anunciar. Não programa; descreve
  o que quer e revisa o resultado. Prefere ver a lista curada a receber 500 opções.
- **Ícaro** — sócio/operação, valida slice real (peso e tempo de impressão de verdade).
- **A skill** — propõe, calcula e escreve. Nunca publica anúncio sozinha nem grava em
  produção sem pedir.

## Restrições de produção que mudam qualquer conta

- **Uma impressora.** Hora de máquina é o recurso escasso, não dinheiro de filamento.
  Por isso a métrica que importa é **lucro por hora de impressão**, não margem percentual.
  Peça de 30% de margem em 1h ganha de uma de 50% em 8h.
- **FDM sem pintura.** O que sai da impressora é o que vai pro cliente. Modelo que só fica
  bonito pintado à mão não serve.
- **Peça abaixo de ~18g não é produto avulso.** A taxa fixa da Shopee e o frete inviabilizam.
  Vira kit de N unidades.
- **Multicor custa tempo.** Troca de cor no AMS multiplica a impressão e o desperdício.

## Economia da Shopee — o degrau de R$ 80

A tabela de taxas da Shopee para vendedor **CNPJ** tem um degrau que define a política de
preço da loja inteira:

| Faixa de preço | Comissão | Taxa fixa |
|---|---|---|
| R$ 8,00 – 79,99 | 20% | **R$ 4,00** |
| R$ 80,00 – 99,99 | 14% | **R$ 16,00** |
| R$ 100,00+ | 14% | R$ 20,00 |

Cruzar de R$ 79,90 para R$ 80,00 sobe a taxa de ~R$ 19,80 para ~R$ 27,20. **A faixa ótima
de preço da Mahou é R$ 69,90–79,90** (ainda pega o selo de frete grátis). Subir acima de
R$ 80 só com motivo claro — o fixo de R$ 16 só compensa acima de ~R$ 200.

Outros parâmetros vivos: imposto Simples efetivo **6%** (não 4,5%), tarifa **R$ 0,85/kWh**,
comissão ML **15%**, TikTok soma **45%** em quatro percentuais.

## Como a Mahou pensa anúncio (Shopee Ads)

A skill usa a calculadora do Hub (`calcular_plano_ads`), que trabalha com dois ROAS
diferentes — e confundir os dois é o erro clássico:

- **ROAS alvo do TESTE = break-even.** No teste você não está tentando lucrar, está
  **comprando dados**. Se o anúncio empata, ele passou. Cobrar lucro no teste mata produto bom.
- **ROAS alvo da ESCALA = break-even × 1,4.** Aqui sim exige-se folga, porque o orçamento
  vai subir e o erro custa caro.

O teste dura ~5 dias e mira nas vendas necessárias para concluir com 95% de confiança
(estatística de Poisson: se em break-even a chance de zero vendas é 5%, três vendas bastam).
Se o teste estimar **menos de 60 cliques**, a amostra é fraca demais — a calculadora avisa,
e a recomendação é subir o lance ou o orçamento, não confiar no resultado.

Passando no teste, a escalada sobe **25% a cada 3 dias**, cinco degraus.

## Marcas registradas — a regra que protege a loja

Nunca no título. Na descrição, só como "compatível com":

| Não usar | Usar |
|---|---|
| Pokémon | monstrinho colecionável |
| Patrulha Canina | cachorrinho / patinha |
| Disney, Marvel, Pixar | "inspirado em" só na descrição |
| "PlayStation original" | "compatível com PS5 / DualSense" |
| Kindle | "compatível com Kindle" é aceitável (uso descritivo) |

O ML é o mais rigoroso: denúncia derruba anúncio em menos de 24h. Shopee e TikTok são mais
lentos, mas também removem.

**Atenção especial vinda da prospecção do MakerWorld:** a licença do arquivo 3D **não**
protege contra o direito do personagem. Um modelo do Zelda pode estar sob CC0 e ainda assim
gerar takedown da Nintendo — o autor licenciou o desenho dele, não o personagem que não é dele.

## Tom de voz

- **Premium mas acessível** — "cuidadoso", "artesanal", "design autoral". Nunca "luxuoso".
- **Funcional + decorativo** — quase todo produto tem os dois lados; destacar ambos.
- **O 3D como diferencial** — "feito sob demanda", "impresso camada por camada".
- **Sustentável** — PLA é biodegradável; mencionar quando couber, sem forçar.
- **Presente** — muitos produtos viram presente. Considerar sempre esse ângulo.

## Nichos que vendem (validado na prospecção de jul/2026)

Ordem aproximada de força no mercado brasileiro:

1. **Flexi / articulados** — campeão, especialmente em multipack
2. **Organização de setup** — explodiu com home office
3. **Personalizáveis com nome** — o multiplicador de margem mais confiável
4. **Datas comemorativas** — pico previsível; Natal exige produzir a partir de outubro
5. **Pet** — tag com nome é o carro-chefe
6. **Fidget / anti-stress** — peça pequena, gira bem em vídeo curto
7. **Decoração e vasos** — vende pela foto
8. **Acessórios e joias** — material quase nulo, valor percebido alto

**O que NÃO vende:** acessório de ecossistema maker (Gridfinity, IKEA Skadis, homelab —
público quase inexistente no Brasil), peça de reposição de aparelho específico, e qualquer
coisa que exija o comprador já ter comprado outra coisa antes.

## Onde ficam as coisas

| O quê | Onde |
|---|---|
| Produtos, custos, margem, estoque | Hub (MCP tools `listar_produtos`, `obter_produto`) |
| Regras de cada marketplace | `content/marketplace/regras/{shopee,mercado-livre,tiktok-shop}.md` |
| Keywords por categoria | `content/marketplace/treino/keywords/` |
| Listings que funcionaram | `content/marketplace/treino/listings_que_funcionaram/` |
| Acervo criativo e fotos | `~/Documents/Mahou Prints/` |
| Saída dos anúncios gerados | `~/Documents/Mahou Prints/products/{slug}/listings/` |

## Coisas que o Gabriel já corrigiu (não repetir)

- Preço acima de R$ 80 "porque o produto é bom" — o degrau da Shopee come a diferença.
- Tratar margem % como métrica principal — o gargalo é hora de impressora.
- Assumir que foto bonita do autor do modelo = produto pronto. Verificar se precisa de
  ímã, parafuso, fio, elástico, soquete ou pintura que não vêm juntos.
