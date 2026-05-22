'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { Insumo } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { useTableSort } from '@/lib/use-table-sort';
import { useTablePagination } from '@/lib/use-table-pagination';
import { Pagination } from '@/components/pagination';
import { SortableHead } from '@/components/sortable-head';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { InsumoDialog } from '@/components/insumo-dialog';

type InsumoListado = Insumo & { _count?: { produtos: number } };
type ColunaSortInsumo = 'nome' | 'unidade' | 'custo' | 'usos';

export default function InsumosPage() {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Insumo | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['insumos'],
    queryFn: () => apiFetch<InsumoListado[]>('/insumos'),
  });

  const sort = useTableSort<InsumoListado, ColunaSortInsumo>({
    nome: (i) => i.nome,
    unidade: (i) => i.unidade,
    custo: (i) => i.custoUnitarioCentavos,
    usos: (i) => i._count?.produtos ?? 0,
  });

  const ordenados = useMemo(() => (data ? sort.ordenar(data) : []), [data, sort]);
  const pag = useTablePagination();
  const ordenadosPaginados = useMemo(() => pag.paginar(ordenados), [ordenados, pag]);

  function abrirNovo() {
    setEmEdicao(undefined);
    setDialogAberto(true);
  }
  function abrirEdicao(i: Insumo) {
    setEmEdicao(i);
    setDialogAberto(true);
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Insumos</h1>
          <p className="text-sm text-muted-foreground">
            {data?.length ?? 0} itens cadastrados · usados nos produtos pra rastrear consumo
          </p>
        </div>
        <Button onClick={abrirNovo}>
          <Plus className="h-4 w-4" /> Novo insumo
        </Button>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {data && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead chave="nome" estado={sort.estado} onClick={sort.alternar}>
                  Nome
                </SortableHead>
                <SortableHead chave="unidade" estado={sort.estado} onClick={sort.alternar}>
                  Unidade
                </SortableHead>
                <SortableHead
                  chave="custo"
                  estado={sort.estado}
                  onClick={sort.alternar}
                  align="right"
                  className="text-right"
                >
                  Custo por unidade
                </SortableHead>
                <SortableHead
                  chave="usos"
                  estado={sort.estado}
                  onClick={sort.alternar}
                  align="right"
                  className="text-right"
                >
                  Produtos
                </SortableHead>
                <TableHead className="w-20 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenadosPaginados.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.nome}</TableCell>
                  <TableCell>
                    <Badge variant="default">{i.unidade}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {centavosParaReais(i.custoUnitarioCentavos)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {i._count?.produtos ?? 0}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => abrirEdicao(i)}
                        title="Editar insumo"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <BotaoDesativar insumoId={i.id} nome={i.nome} usadoEm={i._count?.produtos ?? 0} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Nenhum insumo cadastrado. Clique em "Novo insumo" pra começar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <Pagination
            page={pag.page}
            pageSize={pag.pageSize}
            total={ordenados.length}
            onPageChange={pag.setPage}
          />
        </Card>
      )}

      <InsumoDialog insumo={emEdicao} open={dialogAberto} onOpenChange={setDialogAberto} />
    </div>
  );
}

function BotaoDesativar({
  insumoId,
  nome,
  usadoEm,
}: {
  insumoId: string;
  nome: string;
  usadoEm: number;
}) {
  const [aberto, setAberto] = useState(false);
  const qc = useQueryClient();
  const desativar = useMutation({
    mutationFn: () => apiFetch(`/insumos/${insumoId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insumos'] });
      setAberto(false);
      toast.success(`Insumo "${nome}" desativado`);
    },
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Desativar insumo"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desativar insumo</DialogTitle>
          <DialogDescription>
            <strong>{nome}</strong> será desativado e não aparecerá mais em novos produtos.
            {usadoEm > 0 && (
              <>
                {' '}Já está em uso por <strong>{usadoEm} produto(s)</strong> — esses continuam
                referenciando normalmente pra preservar histórico.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={desativar.isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={() => desativar.mutate()}
            disabled={desativar.isPending}
          >
            {desativar.isPending ? 'Desativando…' : 'Desativar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
