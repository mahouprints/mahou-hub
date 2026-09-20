'use client';

import { useId } from 'react';
import type { PontoSerieFinanceira, RelatorioFinanceiro } from '@mahou-hub/contracts';
import { centavosParaReais, pct } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Props = { relatorio: RelatorioFinanceiro };
type Metrica = 'faturamentoCentavos' | 'gastosTotaisCentavos' | 'lucroLiquidoCentavos';
const SERIES: { chave: Metrica; nome: string; cor: string; tracejado?: string }[] = [
  { chave: 'faturamentoCentavos', nome: 'Receita', cor: '#c4b5fd' },
  { chave: 'gastosTotaisCentavos', nome: 'Gastos', cor: '#fbbf24', tracejado: '7 4' },
  { chave: 'lucroLiquidoCentavos', nome: 'Lucro líquido', cor: '#34d399', tracejado: '2 4' },
];
const AREA = { esquerda: 122, direita: 750, topo: 24, base: 254 };

function escalaFinanceira(serie: PontoSerieFinanceira[]) {
  const valores = serie.flatMap((ponto) => SERIES.map(({ chave }) => ponto[chave]));
  const menor = Math.min(0, ...valores);
  const maior = Math.max(100, ...valores);
  const intervalo = maior - menor;
  const minimo = menor < 0 ? menor - intervalo * 0.08 : 0;
  const maximo = maior + intervalo * 0.08;
  return {
    marcas: Array.from({ length: 5 }, (_, indice) => minimo + ((maximo - minimo) * indice) / 4),
    x: (indice: number) =>
      AREA.esquerda + ((AREA.direita - AREA.esquerda) * indice) / Math.max(1, serie.length - 1),
    y: (centavos: number) =>
      AREA.base - ((centavos - minimo) / (maximo - minimo)) * (AREA.base - AREA.topo),
  };
}

function GradeFinanceira({ escala }: { escala: ReturnType<typeof escalaFinanceira> }) {
  return (
    <>
      {escala.marcas.map((valor, indice) => (
        <g key={indice}>
          <line
            x1={AREA.esquerda}
            x2={AREA.direita}
            y1={escala.y(valor)}
            y2={escala.y(valor)}
            stroke="currentColor"
            strokeOpacity="0.12"
          />
          <text
            x={AREA.esquerda - 12}
            y={escala.y(valor) + 4}
            textAnchor="end"
            fill="currentColor"
            fontSize="11"
          >
            {centavosParaReais(Math.round(valor))}
          </text>
        </g>
      ))}
    </>
  );
}

function LinhasFinanceiras({
  serie,
  escala,
}: {
  serie: PontoSerieFinanceira[];
  escala: ReturnType<typeof escalaFinanceira>;
}) {
  return (
    <>
      {SERIES.map(({ chave, nome, cor, tracejado }) => (
        <g key={chave}>
          <polyline
            fill="none"
            stroke={cor}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeDasharray={tracejado}
            points={serie
              .map((ponto, indice) => `${escala.x(indice)},${escala.y(ponto[chave])}`)
              .join(' ')}
          />
          {serie.map((ponto, indice) => (
            <circle
              key={ponto.inicio}
              cx={escala.x(indice)}
              cy={escala.y(ponto[chave])}
              r="3.5"
              fill={cor}
              stroke="#191224"
              strokeWidth="1.5"
            >
              <title>{`${ponto.rotulo} · ${nome}: ${centavosParaReais(ponto[chave])}`}</title>
            </circle>
          ))}
        </g>
      ))}
    </>
  );
}

function RotulosFinanceiros({
  serie,
  escala,
}: {
  serie: PontoSerieFinanceira[];
  escala: ReturnType<typeof escalaFinanceira>;
}) {
  const passo = Math.max(1, Math.ceil(serie.length / 8));
  return (
    <>
      {serie.map((ponto, indice) => (
        <text
          key={ponto.inicio}
          x={escala.x(indice)}
          y="280"
          textAnchor="middle"
          fill="currentColor"
          fontSize="11"
        >
          {indice === serie.length - 1 ||
          (indice % passo === 0 && serie.length - 1 - indice >= passo)
            ? ponto.rotulo
            : ''}
        </text>
      ))}
    </>
  );
}

function ValoresEvolucao({ serie }: { serie: PontoSerieFinanceira[] }) {
  return (
    <details className="mt-4 text-xs text-muted-foreground">
      <summary className="cursor-pointer rounded py-2 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Ver valores do gráfico
      </summary>
      <div className="overflow-x-auto">
        <table className="mt-2 w-full text-right tabular-nums">
          <caption className="sr-only">Valores da evolução financeira por período</caption>
          <thead>
            <tr>
              <th scope="col" className="p-2 text-left">
                Período
              </th>
              {SERIES.map(({ nome }) => (
                <th key={nome} scope="col" className="whitespace-nowrap p-2">
                  {nome}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {serie.map((ponto) => (
              <tr key={ponto.inicio} className="border-t border-border">
                <th scope="row" className="p-2 text-left font-normal">
                  {ponto.rotulo}
                </th>
                {SERIES.map(({ chave }) => (
                  <td key={chave} className="whitespace-nowrap p-2">
                    {centavosParaReais(ponto[chave])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Compara os totais em cada intervalo. Ex.: <EvolucaoFinanceira relatorio={relatorio} />. */
export function EvolucaoFinanceira({ relatorio }: Props) {
  const tituloId = useId();
  const escala = escalaFinanceira(relatorio.serie);
  const semMovimento = relatorio.resumo.qtdVendas === 0 && relatorio.custosGerais.length === 0;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Evolução financeira</CardTitle>
        <CardDescription>
          Receita, gastos totais e lucro líquido ao longo do período.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">
          {SERIES.map(({ nome, cor, tracejado }) => (
            <span key={nome} className="inline-flex items-center gap-2">
              <svg width="24" height="8" aria-hidden="true">
                <line
                  x1="0"
                  x2="24"
                  y1="4"
                  y2="4"
                  stroke={cor}
                  strokeWidth="3"
                  strokeDasharray={tracejado}
                />
              </svg>
              {nome}
            </span>
          ))}
        </div>
        {semMovimento || relatorio.serie.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">
            Sem vendas ou custos gerais neste período.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg bg-[#191224]/70 p-2">
            <svg
              viewBox="0 0 790 302"
              className="w-full min-w-[560px] text-slate-300"
              role="img"
              aria-labelledby={tituloId}
            >
              <title id={tituloId}>
                Evolução da receita, gastos e lucro líquido. Os valores completos estão disponíveis
                abaixo.
              </title>
              <GradeFinanceira escala={escala} />
              <line
                x1={AREA.esquerda}
                x2={AREA.direita}
                y1={escala.y(0)}
                y2={escala.y(0)}
                stroke="currentColor"
                strokeOpacity="0.35"
              />
              <LinhasFinanceiras serie={relatorio.serie} escala={escala} />
              <RotulosFinanceiros serie={relatorio.serie} escala={escala} />
            </svg>
          </div>
        )}
        {!semMovimento && <ValoresEvolucao serie={relatorio.serie} />}
      </CardContent>
    </Card>
  );
}

function tiposDeGasto(resumo: RelatorioFinanceiro['resumo']) {
  return [
    {
      nome: 'Produção',
      detalhe: 'Filamento, energia e embalagem',
      valor: resumo.custosVariaveisCentavos,
      cor: '#c4b5fd',
    },
    {
      nome: 'Insumos dos produtos',
      detalhe: 'Consumo dos insumos nas vendas',
      valor: resumo.custosInsumosCentavos,
      cor: '#818cf8',
    },
    {
      nome: 'Custos gerais',
      detalhe: 'Lançamentos por competência',
      valor: resumo.custosGeraisCentavos,
      cor: '#f472b6',
    },
    {
      nome: 'Impostos',
      detalhe: 'Impostos sobre as vendas',
      valor: resumo.impostosCentavos,
      cor: '#fbbf24',
    },
    {
      nome: 'Taxas dos canais',
      detalhe: 'Taxas dos marketplaces',
      valor: resumo.taxasMarketplaceCentavos,
      cor: '#38bdf8',
    },
  ];
}

function RoscaGastos({
  gastos,
  total,
}: {
  gastos: ReturnType<typeof tiposDeGasto>;
  total: number;
}) {
  const tituloId = useId();
  return (
    <svg
      viewBox="0 0 160 160"
      className="mx-auto w-40 shrink-0"
      role="img"
      aria-labelledby={tituloId}
    >
      <title id={tituloId}>
        {`Distribuição dos gastos: ${centavosParaReais(total)}. Valores por tipo na legenda.`}
      </title>
      <circle
        cx="80"
        cy="80"
        r="60"
        fill="none"
        stroke="currentColor"
        strokeWidth="20"
        className="text-muted"
      />
      {gastos.map((gasto, indice) => (
        <circle
          key={gasto.nome}
          cx="80"
          cy="80"
          r="60"
          pathLength="100"
          fill="none"
          stroke={gasto.cor}
          strokeWidth="20"
          strokeDasharray={`${(gasto.valor / total) * 100} 100`}
          strokeDashoffset={
            (-gastos.slice(0, indice).reduce((soma, item) => soma + item.valor, 0) / total) * 100
          }
          transform="rotate(-90 80 80)"
        >
          <title>
            {`${gasto.nome}: ${centavosParaReais(gasto.valor)} (${pct(gasto.valor / total)})`}
          </title>
        </circle>
      ))}
      <text x="80" y="77" textAnchor="middle" fill="currentColor" fontSize="12">
        Gastos
      </text>
      <text x="80" y="95" textAnchor="middle" fill="currentColor" fontSize="13" fontWeight="600">
        100%
      </text>
    </svg>
  );
}

/** Separa o consumo nas vendas dos custos gerais. Ex.: <ComposicaoGastos relatorio={relatorio} />. */
export function ComposicaoGastos({ relatorio }: Props) {
  const gastos = tiposDeGasto(relatorio.resumo);
  const total = gastos.reduce((soma, gasto) => soma + gasto.valor, 0);
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Composição dos gastos</CardTitle>
        <CardDescription>Os insumos aparecem separados do custo de produção.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {total > 0 ? (
          <RoscaGastos gastos={gastos} total={total} />
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum gasto neste período.
          </p>
        )}
        <dl className="space-y-3">
          {gastos.map((gasto) => (
            <div key={gasto.nome} className="flex items-start justify-between gap-3 text-sm">
              <dt className="flex items-start gap-2">
                <span
                  className="mt-1.5 size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: gasto.cor }}
                />
                <span>
                  {gasto.nome}
                  <span className="block text-xs text-muted-foreground">{gasto.detalhe}</span>
                </span>
              </dt>
              <dd className="shrink-0 text-right tabular-nums">
                {centavosParaReais(gasto.valor)}
                <span className="block text-xs text-muted-foreground">
                  {pct(total > 0 ? gasto.valor / total : 0)}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="flex justify-between gap-3 border-t border-border pt-3 text-sm font-semibold">
          <span>Total de gastos</span>
          <span className="tabular-nums">{centavosParaReais(total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/** Organiza os dois gráficos do relatório. Ex.: <RelatoriosGraficos relatorio={relatorio} />. */
export function RelatoriosGraficos({ relatorio }: Props) {
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
      <EvolucaoFinanceira relatorio={relatorio} />
      <ComposicaoGastos relatorio={relatorio} />
    </div>
  );
}
