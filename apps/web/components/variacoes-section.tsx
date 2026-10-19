'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Boxes, Pencil, Plus } from 'lucide-react';
import type { ProdutoVariacao, ProdutoVariacaoComPricing } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, pct } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MovimentoDialog } from '@/components/movimento-dialog';
import { VariacaoDialog } from '@/components/variacao-dialog';

export function VariacoesSection({
  produtoId,
  produtoNome,
}: {
  produtoId: string;
  produtoNome: string;
}) {
  const qc = useQueryClient();
  const { data: variacoes } = useQuery({
    queryKey: ['variacoes', produtoId],
    queryFn: () => apiFetch<ProdutoVariacaoComPricing[]>(`/variacoes?produtoId=${produtoId}`),
  });

  const [dialog, setDialog] = useState<{ open: boolean; variacao: ProdutoVariacao | null }>({
    open: false,
    variacao: null,
  });
  const [movItem, setMovItem] = useState<ProdutoVariacaoComPricing | null>(null);

  const desativar = useMutation({
    mutationFn: (id: string) => apiFetch(`/variacoes/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['variacoes', produtoId] });
      qc.invalidateQueries({ queryKey: ['variacoes'] });
      toast.success('Variação desativada');
    },
  });

  const lista = variacoes ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cores vendáveis, cada uma com SKU e estoque de peças prontas próprio.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDialog({ open: true, variacao: null })}
        >
          <Plus className="h-4 w-4" /> Nova variação
        </Button>
      </div>

      {lista.length === 0 ? (
        <p className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          Nenhuma variação ainda. Crie uma cor pra usar SKU e estoque de prontos.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cor</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Filamento</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Produção</TableHead>
              <TableHead className="text-right">Contribuição ML</TableHead>
              <TableHead className="text-right">Prontos</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.map((v) => {
              const baixo = v.estoqueMinimo > 0 && v.estoqueAtual <= v.estoqueMinimo;
              const contribuicaoMl =
                v.pricing?.custosMlStatus === 'COTADO' && v.pricing.liquidoMlCentavos != null
                  ? v.pricing.liquidoMlCentavos
                  : null;
              const margemMl = v.pricing?.margemMl ?? null;
              return (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.nome}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{v.sku}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {v.filamento?.nome ?? 'herda do produto'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {v.precoEfetivoCentavos == null
                      ? '—'
                      : centavosParaReais(v.precoEfetivoCentavos)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {v.pricing ? (
                      centavosParaReais(v.pricing.custoTotalProducaoCentavos)
                    ) : (
                      <span className="text-amber-600 dark:text-amber-500">
                        {v.pricingPendencias?.length ? 'Revisar composição' : 'Cálculo pendente'}
                      </span>
                    )}
                    {v.pricingPendencias?.map((pendencia) => (
                      <p key={pendencia} className="text-xs text-muted-foreground">
                        {pendencia}
                      </p>
                    ))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {contribuicaoMl !== null && margemMl !== null ? (
                      <>
                        {centavosParaReais(contribuicaoMl)}
                        <p className="text-xs text-muted-foreground">{pct(margemMl)}</p>
                      </>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-500">Cotação pendente</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={baixo ? 'font-medium text-amber-600 dark:text-amber-500' : ''}>
                      {v.estoqueAtual}
                    </span>
                    {baixo && (
                      <Badge variant="default" className="ml-2 bg-amber-500/15 text-amber-600">
                        baixo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {v.estoqueMinimo > 0 ? v.estoqueMinimo : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => setMovItem(v)}>
                        <Boxes className="h-4 w-4" /> Estoque
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDialog({ open: true, variacao: v })}
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => desativar.mutate(v.id)}
                        disabled={desativar.isPending}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Desativar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {lista.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Valores por unidade e filamento da variação. A contribuição do Mercado Livre usa a cotação
          válida para o preço e o pacote; se mudarem, fica pendente. Custos efetivos são apurados
          nos pedidos.
        </p>
      )}

      <VariacaoDialog
        produtoId={produtoId}
        produtoNome={produtoNome}
        variacao={dialog.variacao}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
      {movItem && (
        <MovimentoDialog
          tipoItem="PRODUTO"
          itemId={movItem.id}
          itemNome={`${produtoNome} — ${movItem.nome}`}
          unidade="un"
          saldoAtual={movItem.estoqueAtual}
          open={!!movItem}
          onOpenChange={(v) => {
            if (!v) setMovItem(null);
          }}
          invalidar={[
            ['variacoes', produtoId],
            ['variacoes'],
            ['estoque', 'movimentos'],
            ['estoque', 'alertas'],
          ]}
        />
      )}
    </div>
  );
}
