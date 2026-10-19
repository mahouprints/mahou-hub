'use client';

import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { custosMlDaCotacao, type Produto } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

/** Mostra contexto e validade da estimativa, separados dos custos efetivos dos pedidos. */
export function ProdutoMercadoLivreCard({
  produto,
}: {
  produto: Pick<Produto, 'id' | 'precoCentavos' | 'mercadoLivre' | 'cotacaoMl'>;
}) {
  const qc = useQueryClient();
  const cotar = useMutation({
    mutationFn: () => apiFetch(`/produtos/${produto.id}/mercado-livre/cotar`, { method: 'POST' }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['produto', produto.id] });
      await qc.invalidateQueries({ queryKey: ['produtos'] });
      await qc.invalidateQueries({ queryKey: ['variacoes', produto.id] });
    },
  });
  const custos = custosMlDaCotacao(produto);
  const config = produto.mercadoLivre;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mercado Livre: categoria e custos previstos</CardTitle>
        <CardDescription>
          Tarifa e frete consultados para as condições deste produto. Os custos efetivos ficam nos
          pedidos e no financeiro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {config ? (
          <>
            <p>
              {produto.cotacaoMl?.contexto.categoriaId === config.categoriaId
                ? produto.cotacaoMl.categoriaNome
                : 'Categoria'}{' '}
              · {config.categoriaId} · {config.tipoAnuncio === 'gold_pro' ? 'Premium' : 'Clássico'}
            </p>
            <p className="text-sm text-muted-foreground">
              Logística: {config.tipoLogistica}. Frete grátis ao comprador:{' '}
              {config.freteGratis ? 'sim' : 'não'}.
            </p>
            {custos ? (
              <p>
                Tarifa prevista: <strong>{centavosParaReais(custos.tarifaCentavos)}</strong>. Envio
                previsto:{' '}
                <strong>
                  {custos.freteCentavos === null
                    ? 'pendente'
                    : centavosParaReais(custos.freteCentavos)}
                </strong>
                .
              </p>
            ) : (
              <p className="text-amber-400">
                Margem do Mercado Livre pendente. Consulte os custos para o preço e as condições
                atuais.
              </p>
            )}
            {produto.cotacaoMl && (
              <p className="text-xs text-muted-foreground">
                Consulta: {new Date(produto.cotacaoMl.cotadoEm).toLocaleString('pt-BR')}. Validade
                de 24 horas para as mesmas condições; o custo final pode variar.
              </p>
            )}
            {produto.cotacaoMl?.pendencias.map((aviso) => (
              <p key={aviso} className="text-sm text-amber-400">
                {aviso}
              </p>
            ))}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Defina a categoria, as condições do anúncio e as medidas do pacote para calcular a
            margem.
          </p>
        )}
        {cotar.error && (
          <p role="alert" className="text-sm text-destructive">
            {cotar.error.message}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/produtos/${produto.id}/editar`}>Definir condições</Link>
          </Button>
          <Button disabled={!config || cotar.isPending} onClick={() => cotar.mutate()}>
            {cotar.isPending ? 'Consultando…' : 'Consultar tarifa e envio'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
