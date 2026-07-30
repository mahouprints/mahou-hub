'use client';

import { useQuery } from '@tanstack/react-query';
import { Palette } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type LinhaPorCor = {
  produto: string;
  cor: string | null;
  sku: string | null;
  unidades: number;
  receitaCentavos: number;
};

/**
 * "Vendi 12 azuis e 3 rosas" — é o número que decide qual cor vale ter impressa na
 * prateleira em vez de esperar o pedido chegar pra começar a imprimir.
 */
export function VendasPorCor({ mes }: { mes: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['vendas-por-variacao', mes],
    queryFn: () =>
      apiFetch<LinhaPorCor[]>(mes ? `/vendas/por-variacao?mes=${mes}` : '/vendas/por-variacao'),
  });

  if (isLoading) return null;
  const linhas = data ?? [];
  if (linhas.length === 0) return null;

  const maior = Math.max(...linhas.map((l) => l.unidades));

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Palette className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">O que saiu por cor</h2>
        <span className="text-xs text-muted-foreground">
          {mes ? 'no mês selecionado' : 'em todo o período'}
        </span>
      </div>

      <div className="space-y-1.5">
        {linhas.slice(0, 12).map((l) => (
          <div key={`${l.produto}-${l.sku ?? 'sem'}`} className="flex items-center gap-3 text-sm">
            <div className="w-56 shrink-0 truncate">
              <span>{l.produto}</span>
              {l.cor ? (
                <span className="text-muted-foreground"> · {l.cor}</span>
              ) : (
                <Badge variant="outline" className="ml-1.5 text-[10px]">
                  sem cor
                </Badge>
              )}
            </div>
            {/* Barra proporcional: comparar cores de relance é o ponto da tela. */}
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max(4, (l.unidades / maior) * 100)}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right tabular-nums">{l.unidades} un</span>
            <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
              {centavosParaReais(l.receitaCentavos)}
            </span>
          </div>
        ))}
      </div>

      {linhas.length > 12 && (
        <p className="mt-2 text-xs text-muted-foreground">
          e mais {linhas.length - 12} combinação(ões) com menos saída.
        </p>
      )}
    </Card>
  );
}
