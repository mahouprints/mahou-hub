'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, Plus, RefreshCcw, Trash2 } from 'lucide-react';
import type { CategoriaCusto, Custo } from '@mahou-hub/contracts';
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
import { MonthPicker } from '@/components/ui/month-picker';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CustoDialog } from '@/components/custo-dialog';

const CATEGORIA_LABEL: Record<CategoriaCusto, string> = {
  ALUGUEL: 'Aluguel',
  ENERGIA: 'Energia',
  INTERNET: 'Internet',
  SOFTWARE: 'Software',
  MARKETING: 'Marketing',
  INSUMOS: 'Insumos',
  IMPOSTOS: 'Impostos',
  OUTROS: 'Outros',
};

export default function CustosPage() {
  const [mes, setMes] = useState('');
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Custo | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['custos', mes],
    queryFn: () => apiFetch<Custo[]>(mes ? `/custos?mes=${mes}` : '/custos'),
  });

  function abrirNovo() {
    setEmEdicao(undefined);
    setDialogAberto(true);
  }
  function abrirEdicao(c: Custo) {
    setEmEdicao(c);
    setDialogAberto(true);
  }

  const total = (data ?? []).reduce((s, c) => s + c.valorCentavos, 0);

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
            <h1 className="text-2xl font-semibold tracking-tight">Custos gerais</h1>
            <p className="text-sm text-muted-foreground">
              {data?.length ?? 0} registros · total {centavosParaReais(total)}
            </p>
          </div>
          <div className="flex items-end gap-3">
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
            <Button onClick={abrirNovo}>
              <Plus className="h-4 w-4" /> Novo custo
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
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.descricao}</TableCell>
                  <TableCell>
                    <Badge variant="default">{CATEGORIA_LABEL[c.categoria]}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {centavosParaReais(c.valorCentavos)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatarMes(new Date(c.dataCompetencia))}
                  </TableCell>
                  <TableCell>
                    {c.geradoAutomatico ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <RefreshCcw className="h-3 w-3" /> Recorrência
                      </span>
                    ) : c.recorrente ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <RefreshCcw className="h-3 w-3" /> Origem
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Manual</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(c)}
                        title="Editar custo"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <BotaoExcluirCusto custoId={c.id} descricao={c.descricao} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Nenhum custo no período.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <CustoDialog custo={emEdicao} open={dialogAberto} onOpenChange={setDialogAberto} />
    </div>
  );
}

function BotaoExcluirCusto({ custoId, descricao }: { custoId: string; descricao: string }) {
  const [aberto, setAberto] = useState(false);
  const qc = useQueryClient();
  const excluir = useMutation({
    mutationFn: () => apiFetch(`/custos/${custoId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custos'] });
      qc.invalidateQueries({ queryKey: ['financeiro-resumo'] });
      setAberto(false);
      toast.success('Custo excluído');
    },
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Excluir custo"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir custo</DialogTitle>
          <DialogDescription>
            Excluir <strong>{descricao}</strong>? Cópias geradas em outros meses não são afetadas.
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

function formatarMes(d: Date): string {
  return d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}
