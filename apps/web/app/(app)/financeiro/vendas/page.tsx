'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Venda } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { useTableSelection } from '@/lib/use-table-selection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MonthPicker } from '@/components/ui/month-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { VendaDialog } from '@/components/venda-dialog';
import { SelectionToolbar } from '@/components/selection-toolbar';

type VendaListada = Venda & {
  produto: { nome: string; filamento: { nome: string } };
};

const CANAL_LABEL = { SHOPEE: 'Shopee', ML: 'Mercado Livre', SITE: 'Site próprio' };
const TODOS = '__todos__';

export default function VendasPage() {
  const qc = useQueryClient();
  const [mes, setMes] = useState('');
  const [filtroCanal, setFiltroCanal] = useState(TODOS);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<VendaListada | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['vendas', mes],
    queryFn: () => apiFetch<VendaListada[]>(mes ? `/vendas?mes=${mes}` : '/vendas'),
  });

  const filtradas = useMemo(() => {
    if (!data) return [];
    return data.filter((v) => filtroCanal === TODOS || v.canal === filtroCanal);
  }, [data, filtroCanal]);

  const idsVisiveis = useMemo(() => filtradas.map((v) => v.id), [filtradas]);
  const sel = useTableSelection(idsVisiveis);

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ count: number }>('/vendas/bulk-delete', { method: 'POST', json: { ids } }),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['vendas'] });
      qc.invalidateQueries({ queryKey: ['financeiro-resumo'] });
      sel.acoes.limpar();
      toast.success(`${resp.count} ${resp.count === 1 ? 'venda excluída' : 'vendas excluídas'}`);
    },
  });

  function abrirNova() {
    setEmEdicao(undefined);
    setDialogAberto(true);
  }
  function abrirEdicao(v: VendaListada) {
    setEmEdicao(v);
    setDialogAberto(true);
  }

  const total = filtradas.reduce((acc, v) => acc + v.precoUnitarioCentavos * v.qtd, 0);

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
              {filtradas.length} de {data?.length ?? 0} vendas · total {centavosParaReais(total)}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-xs uppercase text-muted-foreground">Filtrar por mês</label>
              <MonthPicker
                value={mes}
                onChange={setMes}
                placeholder="Todos os meses"
                clearable
                className="w-56"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase text-muted-foreground">Canal</label>
              <Select value={filtroCanal} onValueChange={setFiltroCanal}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos os canais</SelectItem>
                  <SelectItem value="SHOPEE">Shopee</SelectItem>
                  <SelectItem value="ML">Mercado Livre</SelectItem>
                  <SelectItem value="SITE">Site próprio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={abrirNova}>
              <Plus className="h-4 w-4" /> Nova venda
            </Button>
          </div>
        </div>
      </header>

      <SelectionToolbar
        count={sel.count}
        itemLabel="venda"
        excluindo={bulkDelete.isPending}
        onLimpar={sel.acoes.limpar}
        onExcluir={() => bulkDelete.mutateAsync([...sel.selecionados])}
      />

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {data && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={
                      sel.todosVisiveisMarcados
                        ? true
                        : sel.algumVisivelMarcado
                          ? 'indeterminate'
                          : false
                    }
                    onCheckedChange={() => sel.acoes.toggleTodos()}
                    aria-label="Selecionar todas visíveis"
                  />
                </TableHead>
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
              {filtradas.map((v) => (
                <TableRow key={v.id}>
                  <TableCell>
                    <Checkbox
                      checked={sel.selecionados.has(v.id)}
                      onCheckedChange={() => sel.acoes.toggle(v.id)}
                      aria-label={`Selecionar venda de ${v.produto.nome}`}
                    />
                  </TableCell>
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
              {filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    {data.length === 0 ? 'Nenhuma venda no período.' : 'Nenhuma venda bate com os filtros.'}
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
