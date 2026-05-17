'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Venda } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { VendaDialog } from '@/components/venda-dialog';

type VendaListada = Venda & {
  produto: { nome: string; filamento: { nome: string } };
};

const CANAL_LABEL = { SHOPEE: 'Shopee', ML: 'Mercado Livre', SITE: 'Site próprio' };

export default function VendasPage() {
  const [mes, setMes] = useState(''); // vazio = todos
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<VendaListada | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['vendas', mes],
    queryFn: () => apiFetch<VendaListada[]>(mes ? `/vendas?mes=${mes}` : '/vendas'),
  });

  function abrirNova() {
    setEmEdicao(undefined);
    setDialogAberto(true);
  }
  function abrirEdicao(v: VendaListada) {
    setEmEdicao(v);
    setDialogAberto(true);
  }

  const total = (data ?? []).reduce(
    (acc, v) => acc + v.precoUnitarioCentavos * v.qtd,
    0,
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-muted-foreground">
          <Link href="/financeiro">
            <ArrowLeft className="h-4 w-4" /> Financeiro
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Vendas</h1>
            <p className="text-sm text-muted-foreground">
              {data?.length ?? 0} vendas · total {centavosParaReais(total)}
            </p>
          </div>
          <div className="flex items-end gap-3">
            <div className="space-y-1.5">
              <label htmlFor="mes" className="text-xs uppercase text-muted-foreground">
                Filtrar por mês
              </label>
              <Input
                id="mes"
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-44"
              />
            </div>
            <Button onClick={abrirNova}>
              <Plus className="h-4 w-4" /> Nova venda
            </Button>
          </div>
        </div>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {data && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Preço unit.</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    <span className="block truncate max-w-[260px]" title={v.produto.nome}>
                      {v.produto.nome}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{v.qtd}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {centavosParaReais(v.precoUnitarioCentavos)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {centavosParaReais(v.precoUnitarioCentavos * v.qtd)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="default">{CANAL_LABEL[v.canal]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(v.dataVenda).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(v)}
                        title="Editar venda"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <BotaoExcluirVenda vendaId={v.id} produtoNome={v.produto.nome} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    Nenhuma venda no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <VendaDialog venda={emEdicao} open={dialogAberto} onOpenChange={setDialogAberto} />
    </div>
  );
}

function BotaoExcluirVenda({ vendaId, produtoNome }: { vendaId: string; produtoNome: string }) {
  const [aberto, setAberto] = useState(false);
  const qc = useQueryClient();
  const excluir = useMutation({
    mutationFn: () => apiFetch(`/vendas/${vendaId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendas'] });
      qc.invalidateQueries({ queryKey: ['financeiro-resumo'] });
      setAberto(false);
      toast.success('Venda excluída');
    },
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Excluir venda"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir venda</DialogTitle>
          <DialogDescription>
            Excluir a venda de <strong>{produtoNome}</strong>? Esta ação é permanente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={excluir.isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => excluir.mutate()}
            disabled={excluir.isPending}
          >
            {excluir.isPending ? 'Excluindo…' : 'Excluir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
