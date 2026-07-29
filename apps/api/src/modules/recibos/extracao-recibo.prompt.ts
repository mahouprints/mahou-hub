/**
 * Prompt e schema da leitura de nota. Ficam separados do serviço porque são texto
 * editorial — mudam quando o Gabriel descobre um jeito novo da nota vir escrita, não
 * quando a lógica de estoque muda.
 *
 * Duas regras moldam tudo aqui:
 *
 * 1. **Transcrever, não calcular.** Valor unitário × quantidade é conta que o nosso código
 *    faz certo sempre; modelo de linguagem faz certo quase sempre. O "quase" é o que vira
 *    saldo de estoque errado.
 * 2. **Null é resposta legítima.** Campo ilegível volta null e entra em `camposIlegiveis`.
 *    Um chute plausível é pior que um buraco declarado — o buraco a tela mostra e o
 *    Gabriel resolve tirando outra foto.
 */

export const PROMPT_EXTRACAO_RECIBO = `Você está lendo uma nota fiscal ou recibo de compra da Mahou Prints, uma loja brasileira que imprime e vende peças em 3D.

Sua tarefa é TRANSCREVER o que está escrito no documento. Não é interpretar, não é calcular, não é completar.

## Regra que não se quebra: não invente nada

Se você não consegue ler um valor com certeza — está borrado, cortado, fora de foco, escondido por dobra ou reflexo — devolva **null** naquele campo e escreva o nome dele em \`camposIlegiveis\`.

Nunca deduza um número a partir de outro. Nunca "arredonde pro que faz sentido". Nunca preencha o fornecedor porque o logo parece ser de uma marca conhecida. É melhor devolver metade da nota em branco e dizer o que faltou do que entregar uma nota inteira com um número inventado no meio — esse número vira saldo de estoque errado e ninguém descobre.

Se o documento não for uma nota ou recibo (é uma foto de outra coisa, está ilegível por inteiro), devolva \`itens\` vazio e liste tudo em \`camposIlegiveis\`.

## Não calcule

Transcreva apenas números que estão IMPRESSOS no documento. Se a nota mostra o valor unitário mas não o total da linha, devolva o unitário e deixe o total null — nosso sistema multiplica. Se mostra só o total, o contrário.

## Valores

Em reais, como decimal: \`115.5\` para R$ 115,50. Atenção ao padrão brasileiro — "1.234,56" é mil duzentos e trinta e quatro reais e cinquenta e seis centavos, ou seja \`1234.56\`.

## Datas

Formato \`AAAA-MM-DD\`. Use a data de emissão da nota. Se só houver data de vencimento ou de entrega, deixe null e registre "data" em \`camposIlegiveis\`.

## Classificando cada item

Para cada linha da nota, escolha um \`tipo\`:

- **FILAMENTO** — filamento de impressão 3D em qualquer material (PLA, PETG, ABS, ASA, TPU), inclusive quando a descrição vem abreviada ou só com a cor.
- **INSUMO** — material que vira parte do produto entregue ou da embalagem: caixa, saco, fita, etiqueta, ímã, parafuso, elástico, cola, tinta.
- **NAO_ESTOCAVEL** — o que não é estoque: frete, serviço, ferramenta, peça de reposição da impressora, bico, placa, manutenção, software, taxa.

Se a descrição não permitir decidir, deixe \`tipo\` null e ponha "tipo" nos \`camposIlegiveis\` da linha. Não chute a classificação.

### Filamento: gramas

Se a linha for FILAMENTO e a nota disser o peso (1KG, 1000g, 750g), calcule o total em gramas multiplicando pela quantidade e devolva em \`gramasTotal\` — essa é a única multiplicação que você faz, porque converter kg em grama não tem ambiguidade. Se a nota NÃO disser o peso, deixe null; não presuma que rolo é sempre 1kg.

### Não-estocável: categoria

Só para itens NAO_ESTOCAVEL, escolha a categoria do custo. Frete e taxa vão em OUTROS; ferramenta e peça de impressora vão em OUTROS; software e licença em SOFTWARE; anúncio em MARKETING. Nos demais casos, OUTROS.

## Nomes dos campos ilegíveis

Use exatamente estes nomes em \`camposIlegiveis\`: no nível da nota, "fornecedor", "data", "valorTotal". No nível do item, "descricaoNota", "quantidade", "unidade", "valorUnitario", "valorTotal", "tipo", "gramasTotal".`;

/**
 * Schema entregue à Interactions API em `response_format.schema`. Nullable é declarado
 * como união (`["number","null"]`) — é a forma que a API aceita.
 *
 * Espelhado em Zod no serviço: aqui garante o formato, lá garante o conteúdo.
 */
export const SCHEMA_EXTRACAO_RECIBO: Record<string, unknown> = {
  type: 'object',
  properties: {
    fornecedor: { type: ['string', 'null'] },
    data: { type: ['string', 'null'], description: 'AAAA-MM-DD' },
    valorTotal: { type: ['number', 'null'], description: 'Total da nota em reais' },
    camposIlegiveis: {
      type: 'array',
      items: { type: 'string', enum: ['fornecedor', 'data', 'valorTotal'] },
    },
    itens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          descricaoNota: { type: 'string' },
          quantidade: { type: ['number', 'null'] },
          unidade: { type: ['string', 'null'] },
          valorUnitario: { type: ['number', 'null'] },
          valorTotal: { type: ['number', 'null'] },
          tipo: { type: ['string', 'null'], enum: ['FILAMENTO', 'INSUMO', 'NAO_ESTOCAVEL', null] },
          gramasTotal: { type: ['integer', 'null'] },
          categoriaCusto: {
            type: ['string', 'null'],
            enum: ['SOFTWARE', 'MARKETING', 'INSUMOS', 'OUTROS', null],
          },
          camposIlegiveis: { type: 'array', items: { type: 'string' } },
        },
        required: ['descricaoNota', 'camposIlegiveis'],
      },
    },
  },
  required: ['camposIlegiveis', 'itens'],
};
