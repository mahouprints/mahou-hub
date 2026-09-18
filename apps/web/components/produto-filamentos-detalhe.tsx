import { centavosParaReais } from '@/lib/format';
import {
  filamentosDoFormulario,
  linhasFilamentosDoProduto,
  type ProdutoComComposicao,
} from '@/lib/produto-filamentos';
import { parseDecimalBr } from '@/lib/parsing';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Mostra os materiais de uma peça sem atribuir o peso total à primeira cor. Ex.: <ProdutoFilamentosDetalhe produto={produto} custoCentavos={pricing.custoFilamentoCentavos} />. */
export function ProdutoFilamentosDetalhe({
  produto,
  custoCentavos,
}: {
  produto: ProdutoComComposicao;
  custoCentavos: number;
}) {
  const linhas = linhasFilamentosDoProduto(produto);
  const filamentos = filamentosDoFormulario([], produto);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Composição de filamentos</CardTitle>
        <CardDescription>Consumo e custo por unidade do produto</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {linhas.map((linha, indice) => {
          const filamento = filamentos.find((item) => item.id === linha.filamentoId);
          const peso = parseDecimalBr(linha.pesoGStr);
          return (
            <div
              key={linha.filamentoId}
              className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm"
            >
              <div>
                <span className="font-medium">{filamento?.nome ?? 'Filamento não encontrado'}</span>
                {filamento && !filamento.ativo && (
                  <span className="ml-2 text-xs text-muted-foreground">inativo</span>
                )}
                {indice === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Referência de potência para energia
                  </p>
                )}
              </div>
              <div className="flex gap-5 tabular-nums">
                <span>{peso.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} g</span>
                <span>
                  {filamento
                    ? centavosParaReais(Math.round((peso * filamento.custoKgCentavos) / 1000))
                    : '—'}
                </span>
              </div>
            </div>
          );
        })}
        <div className="flex justify-between gap-4 text-sm font-semibold">
          <span>Total dos filamentos</span>
          <span>{centavosParaReais(custoCentavos)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          A energia é calculada uma vez pelo tempo total de impressão. O custo dos materiais é
          somado antes de arredondar para centavos.
        </p>
      </CardContent>
    </Card>
  );
}
