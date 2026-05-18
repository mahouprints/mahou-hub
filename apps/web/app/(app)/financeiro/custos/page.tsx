'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, CheckSquare, Pencil, Plus, RefreshCcw, Trash2, X } from 'lucide-react';
import type { CategoriaCusto, Custo } from '@mahou-hub/contracts';
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
import { CustoDialog } from '@/components/custo-dialog';
import { SelectionToolbar } from '@/components/selection-toolbar';

const CATEGORIA_LABEL: Record<CategoriaCusto, string> = {
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

const TODOS = '__todos__';
type FiltroOrigem = 'todos' | 'manual' | 'recorrencia';

export default function CustosPage() {
  const qc = useQueryClient();
  const [mes, setMes] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState(TODOS);
  const [filtroOrigem, setFiltroOrigem] = useState<FiltroOrigem>('todos');
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Custo | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['custos', mes],
    queryFn: () => apiFetch<Custo[]>(mes ? `/custos?mes=${mes}` : '/custos'),
  });

  const filtrados = useMemo(() => {
    if (!data) return [];
    return data.filter((c) => {
      if (filtroCategoria !== TODOS && c.categoria !== filtroCategoria) return false;
      if (filtroOrigem === 'manual' && c.geradoAutomatico) return false;
      if (filtroOrigem === 'recorrencia' && !c.geradoAutomatico) return false;
      return true;
    });
  }, [data, filtroCategoria, filtroOrigem]);

  const idsVisiveis = useMemo(() => filtrados.map((c) => c.id), [filtrados]);
  const sel = useTableSelection(idsVisiveis);

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ count: number }>('/custos/bulk-delete', { method: 'POST', json: { ids } }),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['custos'] });
      qc.invalidateQueries({ queryKey: ['financeiro-resumo'] });
      sel.acoes.limpar();
      toast.success(`${resp.count} ${resp.count === 1 ? 'custo excluído' : 'custos excluídos'}`);
    },
  });

  function abrirNovo() {
    setEmEdicao(undefined);
    setDialogAberto(true);
  }
  function abrirEdicao(c: Custo) {
    setEmEdicao(c);
    setDialogAberto(true);
  }

  const total = filtrados.reduce((s, c) => s + c.valorCentavos, 0);

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
              {filtrados.length} de {data?.length ?? 0} registros · total {centavosParaReais(total)}
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
              <label className="text-xs uppercase text-muted-foreground">Categoria</label>
              <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {(Object.entries(CATEGORIA_LABEL) as [CategoriaCusto, string][]).map(([v, lbl]) => (
                    <SelectItem key={v} value={v}>
                      {lbl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase text-muted-foreground">Origem</label>
              <Select
                value={filtroOrigem}
                onValueChange={(v) => setFiltroOrigem(v as FiltroOrigem)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as origens</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="recorrencia">Gerado por recorrência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {sel.modoSelecao ? (
              <Button variant="outline" onClick={sel.acoes.sairModo}>
                <X className="h-4 w-4" /> Sair da seleção
              </Button>
            ) : (
              <Button variant="outline" onClick={sel.acoes.entrarModo}>
                <CheckSquare className="h-4 w-4" /> Selecionar
              </Button>
            )}
            <Button onClick={abrirNovo}>
              <Plus className="h-4 w-4" /> Novo custo
            </Button>
          </div>
        </div>
      </header>

      <SelectionToolbar
        count={sel.count}
        itemLabel="custo"
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
                {sel.modoSelecao && (
                  <TableHead className="w-8">
                    <Checkbox
                      checked={
                        sel.todosVisiveisMarcados
                          ? true
                          : sel.algumVisivelMarcado
                            ? 'indeterminate'
                            : false
                      }
                      onCheckedChange={() => sel.acoes.toggleTodos()}
                      aria-label="Selecionar todos visíveis"
                    />
                  </TableHead>
                )}
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Competência</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((c) => (
                <TableRow key={c.id}>
                  {sel.modoSelecao && (
                    <TableCell>
                      <Checkbox
                        checked={sel.selecionados.has(c.id)}
                        onCheckedChange={() => sel.acoes.toggle(c.id)}
                        aria-label={`Selecionar ${c.descricao}`}
                      />
                    </TableCell>
                  )}
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
              {filtrados.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={sel.modoSelecao ? 7 : 6}
                    className="text-center text-sm text-muted-foreground"
                  >
                    {data.length === 0 ? 'Nenhum custo no período.' : 'Nenhum custo bate com os filtros.'}
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
