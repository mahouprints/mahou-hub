'use client';

import type { ReactNode } from 'react';
import type {
  Canal,
  CategoriaCusto,
  CustoRelatorio,
  RelatorioFinanceiro,
  TotaisVendasRelatorio,
  VendaRelatorio,
} from '@mahou-hub/contracts';
import { centavosParaReais } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ObservacaoExpansivel } from '@/components/observacao-expansivel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Props = { relatorio: RelatorioFinanceiro };
const CANAIS: Record<Canal, string> = {
  SHOPEE: 'Shopee',
  ML: 'Mercado Livre',
  SITE: 'Site próprio',
  TIKTOK: 'TikTok Shop',
};
const CATEGORIAS: Record<CategoriaCusto, string> = {
  ALUGUEL: 'Aluguel',
  ENERGIA: 'Energia',
  INTERNET: 'Internet',
  SOFTWARE: 'Software',
  ASSINATURA: 'Assinatura',
  MARKETING: 'Marketing',
  INSUMOS: 'Insumos',
  IMPOSTOS: 'Impostos',
  OUTROS: 'Outros',
};
const COLUNAS_RESULTADO = [
  'Vendas',
  'Peças',
  'Receita',
  'Produção',
  'Insumos',
  'Impostos',
  'Taxas',
  'Lucro de contribuição',
];

function DiaRelatorio({ valor }: { valor: string }) {
  return <time dateTime={valor}>{valor.split('-').reverse().join('/')}</time>;
}

function ValorMonetario({ valor, destaque = false }: { valor: number; destaque?: boolean }) {
  return (
    <TableCell
      className={cn(
        'whitespace-nowrap text-right tabular-nums',
        destaque && (valor >= 0 ? 'font-medium text-emerald-400' : 'font-medium text-rose-400'),
      )}
    >
      {centavosParaReais(valor)}
    </TableCell>
  );
}

function CelulasResultado({ totais }: { totais: TotaisVendasRelatorio }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">{totais.qtdVendas}</TableCell>
      <TableCell className="text-right tabular-nums">{totais.qtdItensVendidos}</TableCell>
      <ValorMonetario valor={totais.faturamentoCentavos} />
      <ValorMonetario valor={totais.custosVariaveisCentavos} />
      <ValorMonetario valor={totais.custosInsumosCentavos} />
      <ValorMonetario valor={totais.impostosCentavos} />
      <ValorMonetario valor={totais.taxasMarketplaceCentavos} />
      <ValorMonetario valor={totais.lucroContribuicaoCentavos} destaque />
    </>
  );
}

function CabecalhoResultado({ primeiraColuna }: { primeiraColuna: string }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{primeiraColuna}</TableHead>
        {COLUNAS_RESULTADO.map((rotulo) => (
          <TableHead key={rotulo} className="text-right">
            {rotulo}
          </TableHead>
        ))}
      </TableRow>
    </TableHeader>
  );
}

function TabelaVazia({ colunas, mensagem }: { colunas: number; mensagem: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colunas} className="py-8 text-center text-muted-foreground">
        {mensagem}
      </TableCell>
    </TableRow>
  );
}

function SecaoTabela({
  titulo,
  descricao,
  quantidade,
  children,
}: {
  titulo: string;
  descricao: string;
  quantidade: number;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {quantidade > 12 ? (
          <details className="group">
            <summary className="mx-6 mb-4 cursor-pointer rounded py-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Ver {quantidade} registros
            </summary>
            {children}
          </details>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function ProdutosRelatorio({ relatorio }: Props) {
  return (
    <SecaoTabela
      titulo="Resultado por produto"
      descricao="Lucro de contribuição: receita menos produção, insumos, impostos e taxas. Custos gerais não são rateados."
      quantidade={relatorio.porProduto.length}
    >
      <Table>
        <caption className="sr-only">Resultado financeiro por produto</caption>
        <CabecalhoResultado primeiraColuna="Produto" />
        <TableBody>
          {relatorio.porProduto.length === 0 && (
            <TabelaVazia colunas={9} mensagem="Nenhum produto vendido neste período." />
          )}
          {relatorio.porProduto.map((produto) => (
            <TableRow key={produto.produtoId}>
              <TableCell className="min-w-[200px] font-medium">{produto.produtoNome}</TableCell>
              <CelulasResultado totais={produto} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SecaoTabela>
  );
}

function CanaisRelatorio({ relatorio }: Props) {
  return (
    <SecaoTabela
      titulo="Resultado por canal"
      descricao="Custos de produção incluem filamento, energia e embalagem. Insumos são apresentados na coluna própria."
      quantidade={relatorio.porCanal.length}
    >
      <Table>
        <caption className="sr-only">Resultado financeiro por canal de venda</caption>
        <CabecalhoResultado primeiraColuna="Canal" />
        <TableBody>
          {relatorio.porCanal.length === 0 && (
            <TabelaVazia colunas={9} mensagem="Nenhuma venda por canal neste período." />
          )}
          {relatorio.porCanal.map((canal) => (
            <TableRow key={canal.canal}>
              <TableCell className="whitespace-nowrap font-medium">{CANAIS[canal.canal]}</TableCell>
              <CelulasResultado totais={canal} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SecaoTabela>
  );
}

function LinhaVenda({ venda }: { venda: VendaRelatorio }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        <DiaRelatorio valor={venda.dataVenda} />
      </TableCell>
      <TableCell className="min-w-[220px] font-medium">
        {venda.produtoNome}
        <ObservacaoExpansivel texto={venda.observacao} referencia={venda.produtoNome} />
      </TableCell>
      <TableCell className="whitespace-nowrap">{CANAIS[venda.canal]}</TableCell>
      <TableCell className="text-right tabular-nums">{venda.qtd}</TableCell>
      <ValorMonetario valor={venda.precoUnitarioCentavos} />
      <ValorMonetario valor={venda.faturamentoCentavos} />
      <ValorMonetario valor={venda.custosVariaveisCentavos} />
      <ValorMonetario valor={venda.custosInsumosCentavos} />
      <ValorMonetario valor={venda.impostosCentavos} />
      <ValorMonetario valor={venda.taxasMarketplaceCentavos} />
      <ValorMonetario valor={venda.lucroContribuicaoCentavos} destaque />
    </TableRow>
  );
}

function VendasRelatorio({ relatorio }: Props) {
  const colunas = [
    'Quantidade',
    'Preço unitário',
    'Receita',
    'Produção',
    'Insumos',
    'Impostos',
    'Taxas',
    'Lucro de contribuição',
  ];
  return (
    <SecaoTabela
      titulo="Vendas do período"
      descricao="Valores totais de cada venda, já considerando a quantidade de peças, exceto o preço unitário."
      quantidade={relatorio.vendas.length}
    >
      <Table>
        <caption className="sr-only">Detalhamento de todas as vendas do período</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Produto / observação</TableHead>
            <TableHead>Canal</TableHead>
            {colunas.map((rotulo) => (
              <TableHead key={rotulo} className="text-right">
                {rotulo}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {relatorio.vendas.length === 0 && (
            <TabelaVazia colunas={11} mensagem="Nenhuma venda registrada neste período." />
          )}
          {relatorio.vendas.map((venda) => (
            <LinhaVenda key={venda.id} venda={venda} />
          ))}
        </TableBody>
      </Table>
    </SecaoTabela>
  );
}

function LinhaCusto({ custo }: { custo: CustoRelatorio }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap">
        <DiaRelatorio valor={custo.dataCompetencia} />
      </TableCell>
      <TableCell className="min-w-[220px] font-medium">
        {custo.descricao}
        <ObservacaoExpansivel texto={custo.observacao} referencia={custo.descricao} />
      </TableCell>
      <TableCell>{CATEGORIAS[custo.categoria]}</TableCell>
      <ValorMonetario valor={custo.valorCentavos} />
    </TableRow>
  );
}

function CustosRelatorio({ relatorio }: Props) {
  return (
    <SecaoTabela
      titulo="Custos gerais do período"
      descricao="Lançamentos considerados pela data de competência. O consumo de materiais nas vendas está separado acima."
      quantidade={relatorio.custosGerais.length}
    >
      <Table>
        <caption className="sr-only">Detalhamento dos custos gerais por competência</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Competência</TableHead>
            <TableHead>Descrição / observação</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {relatorio.custosGerais.length === 0 && (
            <TabelaVazia colunas={4} mensagem="Nenhum custo geral registrado neste período." />
          )}
          {relatorio.custosGerais.map((custo) => (
            <LinhaCusto key={custo.id} custo={custo} />
          ))}
        </TableBody>
      </Table>
    </SecaoTabela>
  );
}

function CategoriasRelatorio({ relatorio }: Props) {
  return (
    <SecaoTabela
      titulo="Custos gerais por categoria"
      descricao="Distribuição dos lançamentos de custos gerais, sem somar novamente os custos das vendas."
      quantidade={relatorio.porCategoria.length}
    >
      <Table>
        <caption className="sr-only">Totais dos custos gerais por categoria</caption>
        <TableHeader>
          <TableRow>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Lançamentos</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {relatorio.porCategoria.length === 0 && (
            <TabelaVazia colunas={3} mensagem="Nenhum custo geral neste período." />
          )}
          {relatorio.porCategoria.map((categoria) => (
            <TableRow key={categoria.categoria}>
              <TableCell className="font-medium">{CATEGORIAS[categoria.categoria]}</TableCell>
              <TableCell className="text-right tabular-nums">{categoria.qtdLancamentos}</TableCell>
              <ValorMonetario valor={categoria.valorCentavos} />
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SecaoTabela>
  );
}

/** Exibe totais e lançamentos auditáveis. Ex.: <RelatoriosTabelas relatorio={relatorio} />. */
export function RelatoriosTabelas({ relatorio }: Props) {
  return (
    <div className="min-w-0 space-y-4">
      <ProdutosRelatorio relatorio={relatorio} />
      <CanaisRelatorio relatorio={relatorio} />
      <CategoriasRelatorio relatorio={relatorio} />
      <VendasRelatorio relatorio={relatorio} />
      <CustosRelatorio relatorio={relatorio} />
    </div>
  );
}
