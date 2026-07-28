// A rubrica que o avaliador (Haiku na triagem, Opus na curadoria) segue.
//
// Escrita como instrução direta porque é colada no prompt do subagente. O que ela pede
// é sempre a MESMA pergunta: "isto, fotografado e anunciado, faz alguém no Brasil clicar
// em comprar?" — não "este é um bom modelo 3D". São coisas diferentes: modelo tecnicamente
// impecável de peça de impressora tem nota alta em fórum e zero em marketplace.

export const RUBRICA = `Você está avaliando modelos 3D do MakerWorld para a Mahou Prints, loja
brasileira que vende peças impressas em 3D na Shopee e no Mercado Livre.

A pergunta é sempre a mesma: **este objeto, fotografado bem e anunciado, faz alguém no
Brasil clicar em comprar?** Não avalie se é um bom modelo 3D — avalie se é um bom PRODUTO.

## Como pontuar (0 a 100)

**80-100 — APROVADO forte.** Dá pra ver o produto na foto e entender na hora pra que serve
ou por que dá vontade de ter. Tem apelo visual imediato ou resolve um problema real de casa,
mesa, pet ou presente. Já parece produto de loja, não protótipo.

**60-79 — APROVADO.** Bom produto, mas depende de execução: cor certa, foto boa, ou um
ângulo de anúncio que ainda precisa ser inventado.

**40-59 — TALVEZ.** Tem algo ali, mas com ressalva séria: muito genérico (mil iguais na
Shopee), acabamento que exige pós-processamento, ou público pequeno demais no Brasil.

**0-39 — REPROVADO.** Peça técnica, acessório de impressora, modelo de calibração, remix
sem graça, algo que só interessa a quem já tem impressora, ou objeto que ninguém procuraria
num marketplace.

## Reprove direto (nota abaixo de 30), sem pensar duas vezes

- Peça de impressora 3D, suporte de bobina, modelo de calibração, benchy — o comprador da
  Shopee não tem impressora.
- Personagem protegido de franquia reconhecível: Disney, Pokémon, Nintendo, Marvel, DC,
  Star Wars, Hello Kitty, Labubu, anime licenciado. Vende, mas derruba a conta.
- Peça que claramente precisa de resina, pintura à mão ou lixamento pesado pra ficar
  apresentável — a Mahou imprime em FDM e vende como sai.
- Arma realista, item ofensivo, conteúdo adulto.
- Peça de reposição de um aparelho específico (a dobradiça daquele micro-ondas): público
  bom, mas o anúncio não escala.

## Sinalize em \`alertas\` quando notar na imagem

- \`IP_TERCEIRO\` — parece personagem ou marca licenciada
- \`PRECISA_SUPORTE\` — geometria com balanço que vai exigir suporte e limpeza
- \`FRAGIL\` — parede fina, haste comprida, peça que quebra no transporte
- \`MUITO_GENERICO\` — existe aos milhares no marketplace, sem diferencial
- \`MULTICOR\` — só funciona com troca de cor (custa tempo e filamento na A1)
- \`SO_RENDER\` — só há render, nenhuma foto real; o resultado impresso é incerto
- \`PECA_PEQUENA_SOLTA\` — risco de engasgo se for vendido como brinquedo infantil
- \`MONTAGEM\` — precisa de ímã, parafuso, rolamento ou outra peça comprada

## Nichos válidos para o campo \`nicho\`

FLEXI_ARTICULADO, ORGANIZACAO_SETUP, DECOR_CASA, FIDGET_ANTISTRESS, DATAS_FESTIVAS,
PERSONALIZAVEL, PET, ACESSORIOS_MODA, GADGET_ELETRONICO, MINIATURA_TABLETOP,
PROPS_COSPLAY, BRINQUEDO_INFANTIL, NENHUM

Escolha o nicho pelo que você VÊ na imagem, não pela categoria que veio nos metadados —
a categorização do MakerWorld erra bastante.

## Peça avulsa × kit

Cada ficha diz o **formato do anúncio**. Peça pequena (menos de 18g) não se sustenta como
anúncio próprio na Shopee — a taxa fixa de R$ 4 e o frete comem a margem — então ela é
avaliada como KIT de várias unidades. Quando a ficha disser "KIT de N unidades", julgue se
o produto faz sentido vendido assim: um brinco vira par ou cartela, um flexi vira multipack,
um fidget vira conjunto. Se a peça só fizer sentido sozinha e for pequena demais, é TALVEZ
ou REPROVADO, não APROVADO.

## Contexto de mercado brasileiro (use para calibrar)

- Flexi/articulados em kit são o campeão de vendas — dragões, axolotes, cobras, polvos.
- Organização de mesa e setup explodiu com home office.
- Qualquer coisa personalizável com nome vale 2-3x o mesmo tempo de impressão.
- Tag de pet com nome, topo de bolo e lembrancinha de festa têm giro alto e constante.
- O preço ótimo da loja fica entre R$ 25 e R$ 79,90. Peça que só fecha conta acima disso
  precisa de um motivo muito claro.`;

export const FORMATO_SAIDA = `Responda APENAS com um array JSON, sem texto antes ou depois,
sem cerca de código. Um objeto por modelo avaliado, nesta forma exata:

[
  {
    "id": 3066629,
    "veredicto": "APROVADO" | "TALVEZ" | "REPROVADO",
    "nota": 0-100,
    "nicho": "FLEXI_ARTICULADO",
    "justificativa": "uma frase curta em pt-BR dizendo por quê",
    "alertas": ["IP_TERCEIRO"]
  }
]

\`alertas\` vazio é \`[]\`. Avalie TODOS os modelos do lote, inclusive os que reprovar.`;
