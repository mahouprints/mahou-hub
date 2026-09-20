import type { Custo } from '@prisma/client';
import {
  CanalEnum,
  CategoriaCustoEnum,
  type CustoRelatorio,
  type RelatorioFinanceiro,
  type TotaisVendasRelatorio,
  type VendaRelatorio,
} from '@mahou-hub/contracts';
import {
  calcularVendaFinanceira,
  resumirFinanceiro,
  somarValoresVendas,
  type ContextoFinanceiro,
  type VendaFinanceira,
} from './financeiro-calculo';
import {
  definirPeriodoFinanceiro,
  diaCivil,
  intervalosSerieFinanceira,
} from './financeiro-periodo';

type LinhaCalculada = { detalhe: VendaRelatorio; valores: TotaisVendasRelatorio };

/** Monta relatório a partir das mesmas parcelas do resumo legado; ex.: ANUAL gera 12 meses, inclusive vazios. */
export function montarRelatorioFinanceiro(
  periodo: ReturnType<typeof definirPeriodoFinanceiro>,
  vendas: VendaFinanceira[],
  custos: Custo[],
  contexto: ContextoFinanceiro,
): RelatorioFinanceiro {
  const linhas = vendas.map((venda) => detalharVenda(venda, contexto));
  const custosGerais = custos.map(detalharCusto);
  const { gte: _gte, lt: _lt, ...identificacao } = periodo;
  return {
    ...identificacao,
    resumo: resumirLinhas(linhas, custosGerais),
    serie: montarSerie(periodo, linhas, custosGerais),
    vendas: linhas.map((linha) => linha.detalhe),
    custosGerais,
    porCategoria: agruparCategorias(custosGerais),
    porCanal: agruparCanais(linhas),
    porProduto: agruparProdutos(linhas),
  };
}

function detalharVenda(venda: VendaFinanceira, contexto: ContextoFinanceiro): LinhaCalculada {
  const valores = calcularVendaFinanceira(venda, contexto);
  const { qtdVendas: _qtdVendas, qtdItensVendidos: _qtdItens, ...parcelas } = valores;
  return {
    valores,
    detalhe: {
      ...parcelas,
      id: venda.id,
      produtoId: venda.produtoId,
      produtoNome: venda.produto.nome,
      canal: venda.canal,
      qtd: venda.qtd,
      precoUnitarioCentavos: venda.precoUnitarioCentavos,
      dataVenda: diaCivil(venda.dataVenda),
      observacao: venda.observacao,
    },
  };
}

function detalharCusto(custo: Custo): CustoRelatorio {
  return {
    id: custo.id,
    descricao: custo.descricao,
    categoria: custo.categoria,
    valorCentavos: custo.valorCentavos,
    dataCompetencia: diaCivil(custo.dataCompetencia),
    observacao: custo.observacao,
  };
}

function resumirLinhas(linhas: LinhaCalculada[], custos: CustoRelatorio[]) {
  return resumirFinanceiro(
    linhas.map((linha) => ({ canal: linha.detalhe.canal, valores: linha.valores })),
    custos,
  );
}

function montarSerie(
  periodo: ReturnType<typeof definirPeriodoFinanceiro>,
  linhas: LinhaCalculada[],
  custos: CustoRelatorio[],
) {
  return intervalosSerieFinanceira(periodo).map((intervalo) => {
    const vendasPeriodo = linhas.filter((linha) =>
      dentroDoIntervalo(linha.detalhe.dataVenda, intervalo),
    );
    const custosPeriodo = custos.filter((custo) =>
      dentroDoIntervalo(custo.dataCompetencia, intervalo),
    );
    const { porCanal: _porCanal, ...totais } = resumirLinhas(vendasPeriodo, custosPeriodo);
    return { ...intervalo, ...totais };
  });
}

function dentroDoIntervalo(dia: string, intervalo: { inicio: string; fim: string }) {
  return dia >= intervalo.inicio && dia <= intervalo.fim;
}

function agruparCategorias(custos: CustoRelatorio[]) {
  return CategoriaCustoEnum.options.map((categoria) => {
    const lancamentos = custos.filter((custo) => custo.categoria === categoria);
    return {
      categoria,
      qtdLancamentos: lancamentos.length,
      valorCentavos: lancamentos.reduce((total, custo) => total + custo.valorCentavos, 0),
    };
  });
}

function agruparCanais(linhas: LinhaCalculada[]) {
  return CanalEnum.options.map((canal) => ({
    canal,
    ...somarValoresVendas(
      linhas.filter((linha) => linha.detalhe.canal === canal).map((linha) => linha.valores),
    ),
  }));
}

function agruparProdutos(linhas: LinhaCalculada[]) {
  const nomes = new Map(
    linhas.map((linha) => [linha.detalhe.produtoId, linha.detalhe.produtoNome]),
  );
  return [...nomes]
    .map(([produtoId, produtoNome]) => ({
      produtoId,
      produtoNome,
      ...somarValoresVendas(
        linhas
          .filter((linha) => linha.detalhe.produtoId === produtoId)
          .map((linha) => linha.valores),
      ),
    }))
    .sort(
      (a, b) =>
        b.faturamentoCentavos - a.faturamentoCentavos ||
        a.produtoNome.localeCompare(b.produtoNome, 'pt-BR'),
    );
}
