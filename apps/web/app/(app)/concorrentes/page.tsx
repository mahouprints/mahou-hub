'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, ExternalLink, Link2, Plus, RefreshCw, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { tempoRelativo } from '@/lib/format';
import { useTableSelection } from '@/lib/use-table-selection';
import { useTableSort } from '@/lib/use-table-sort';
import { SortableHead } from '@/components/sortable-head';
import { SelectionToolbar } from '@/components/selection-toolbar';
import { ConcorrenteLinkDialog } from '@/components/concorrente-link-dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

/** Shape do GET /concorrentes — strings pra BigInt/Decimal (serializados na borda do backend). */
type ConcorrenteListItem = {
  id: string;
  loja: string;
  shopId: string | null;
  username: string | null;
  imageUrl: string | null;
  ratingStar: string | null;
  commissionRatePadrao: string | null;
  ultimoSyncEm: string | null;
  criadoEm: string;
  ultimoSnapshot: {
    sincronizadoEm: string;
    qtdProdutos: number;
    erroMensagem: string | null;
    origem: 'MANUAL' | 'CRON';
  } | null;
  vendasEstimadasMesTotal: number | null;
};

type ColunaSort = 'loja' | 'rating' | 'produtos' | 'estimado' | 'sync';

export default function ConcorrentesPage() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  // Quando o user clica "Linkar Shopee" numa loja sem shopId, abrimos o modal com o id+url editável.
  const [linkando, setLinkando] = useState<{ id: string; loja: string; url: string } | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['concorrentes'],
    queryFn: () => apiFetch<ConcorrenteListItem[]>('/concorrentes'),
  });

  const sort = useTableSort<ConcorrenteListItem, ColunaSort>({
    loja: (c) => c.loja.toLowerCase(),
    rating: (c) => Number(c.ratingStar ?? 0),
    produtos: (c) => c.ultimoSnapshot?.qtdProdutos ?? -1,
    estimado: (c) => c.vendasEstimadasMesTotal ?? -1,
    sync: (c) => (c.ultimoSyncEm ? new Date(c.ultimoSyncEm).getTime() : 0),
  });

  const lista = useMemo(() => sort.ordenar(data ?? []), [data, sort]);
  const idsVisiveis = useMemo(() => lista.map((c) => c.id), [lista]);
  const sel = useTableSelection(idsVisiveis);

  const sincronizar = useMutation({
    mutationFn: (id: string) => apiFetch(`/concorrentes/${id}/sync`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concorrentes'] });
      toast.success('Sincronização concluída');
    },
  });

  const linkar = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) =>
      apiFetch(`/concorrentes/${id}/link-shopee`, { method: 'POST', json: { url } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concorrentes'] });
      toast.success('Loja linkada e sincronizada');
      setLinkando(null);
    },
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch('/concorrentes/bulk-delete', { method: 'POST', json: { ids } }),
    onSuccess: (_res, ids) => {
      qc.invalidateQueries({ queryKey: ['concorrentes'] });
      sel.acoes.sairModo();
      toast.success(`${ids.length} concorrente(s) removido(s)`);
    },
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Concorrentes</h1>
          <p className="text-sm text-muted-foreground">
            Lojas Shopee monitoradas via API de afiliados. Cada sync grava um snapshot histórico.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sel.modoSelecao ? (
            <Button variant="outline" onClick={sel.acoes.sairModo}>
              <X className="mr-2 h-4 w-4" /> Sair da seleção
            </Button>
          ) : (
            <Button variant="outline" onClick={sel.acoes.entrarModo} disabled={(lista.length === 0)}>
              <CheckSquare className="mr-2 h-4 w-4" /> Selecionar
            </Button>
          )}
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar via link
          </Button>
        </div>
      </header>

      <ConcorrenteLinkDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <Dialog open={!!linkando} onOpenChange={(v) => !v && setLinkando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Linkar &quot;{linkando?.loja}&quot; à Shopee</DialogTitle>
            <DialogDescription>
              Cole a URL da loja Shopee. Vou resolver o shopId, marcar essa entrada como linkada e
              sincronizar os produtos.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!linkando) return;
              const url = linkando.url.trim();
              if (!/^https?:\/\/.+shopee\.com\.br/.test(url)) {
                toast.error('URL precisa ser de shopee.com.br');
                return;
              }
              linkar.mutate({ id: linkando.id, url });
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="shopee-url">URL da loja</Label>
              <Input
                id="shopee-url"
                value={linkando?.url ?? ''}
                onChange={(e) => linkando && setLinkando({ ...linkando, url: e.target.value })}
                placeholder="https://shopee.com.br/nome-da-loja"
                autoFocus
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={linkar.isPending}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={linkar.isPending}>
                {linkar.isPending ? 'Sincronizando…' : 'Linkar e sincronizar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <SelectionToolbar
        count={sel.count}
        itemLabel="concorrente"
        onLimpar={sel.acoes.limpar}
        onExcluir={() => bulkDelete.mutateAsync([...sel.selecionados])}
        excluindo={bulkDelete.isPending}
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              {sel.modoSelecao && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={sel.todosVisiveisMarcados}
                    onCheckedChange={() => sel.acoes.toggleTodos()}
                  />
                </TableHead>
              )}
              <SortableHead chave="loja" estado={sort.estado} onClick={sort.alternar}>
                Loja
              </SortableHead>
              <SortableHead chave="rating" estado={sort.estado} onClick={sort.alternar}>
                Rating
              </SortableHead>
              <SortableHead chave="produtos" estado={sort.estado} onClick={sort.alternar}>
                Produtos
              </SortableHead>
              <SortableHead chave="estimado" estado={sort.estado} onClick={sort.alternar}>
                Vendas est./mês
              </SortableHead>
              <SortableHead chave="sync" estado={sort.estado} onClick={sort.alternar}>
                Último sync
              </SortableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-destructive">
                  Erro ao carregar
                </TableCell>
              </TableRow>
            )}
            {!isLoading && lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Nenhum concorrente. Adicione via link.
                </TableCell>
              </TableRow>
            )}
            {lista.map((c) => {
              const snap = c.ultimoSnapshot;
              const erroSync = snap?.erroMensagem;
              const sincronizandoEsta = sincronizar.isPending && sincronizar.variables === c.id;
              return (
                <TableRow key={c.id}>
                  {sel.modoSelecao && (
                    <TableCell>
                      <Checkbox
                        checked={sel.selecionados.has(c.id)}
                        onCheckedChange={() => sel.acoes.toggle(c.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {c.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.imageUrl}
                          alt=""
                          className="h-9 w-9 rounded-full border object-cover"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full border bg-muted" />
                      )}
                      <div>
                        <Link
                          href={`/concorrentes/${c.id}`}
                          className="font-medium hover:underline"
                        >
                          {c.loja}
                        </Link>
                        {c.username && (
                          <div className="text-xs text-muted-foreground">@{c.username}</div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.ratingStar ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-500" />
                        {Number(c.ratingStar).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{snap?.qtdProdutos ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">
                    {c.vendasEstimadasMesTotal != null ? (
                      c.vendasEstimadasMesTotal.toLocaleString('pt-BR')
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span title={c.ultimoSyncEm ?? ''}>{tempoRelativo(c.ultimoSyncEm)}</span>
                    {erroSync && (
                      <span
                        className="ml-2 inline-block rounded bg-destructive/10 px-1.5 py-0.5 text-xs text-destructive"
                        title={erroSync}
                      >
                        erro
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {c.shopId ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={sincronizandoEsta}
                          onClick={() => sincronizar.mutate(c.id)}
                          title="Sincronizar agora"
                        >
                          <RefreshCw className={`h-4 w-4 ${sincronizandoEsta ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="ghost" size="icon" asChild title="Abrir na Shopee">
                          <a
                            href={`https://shopee.com.br/shop/${c.shopId}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLinkando({ id: c.id, loja: c.loja, url: '' })}
                        title="Linkar à loja Shopee"
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
