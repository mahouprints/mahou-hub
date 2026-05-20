'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  ExternalLink,
  RefreshCw,
  Star,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, pct, tempoRelativo } from '@/lib/format';
import { useTableSort } from '@/lib/use-table-sort';
import { SortableHead } from '@/components/sortable-head';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

type ConcorrenteDetail = {
  id: string;
  loja: string;
  shopId: string | null;
  username: string | null;
  urlOriginal: string | null;
  imageUrl: string | null;
  ratingStar: string | null;
  commissionRatePadrao: string | null;
  sellerCommCoveRatio: string | null;
  observacao: string | null;
  ultimoSyncEm: string | null;
  criadoEm: string;
  ultimoSnapshot: {
    sincronizadoEm: string;
    qtdProdutos: number;
    erroMensagem: string | null;
    origem: 'MANUAL' | 'CRON';
  } | null;
};

type SnapshotMeta = {
  id: string;
  sincronizadoEm: string;
  origem: 'MANUAL' | 'CRON';
  qtdProdutos: number;
  erroMensagem: string | null;
};

type SnapshotProduto = {
  id: string;
  itemId: string;
  productName: string;
  priceMinCentavos: number;
  priceMaxCentavos: number;
  priceDiscountRate: number;
  sales: number;
  commissionRate: string;
  commissionCentavos: number;
  imageUrl: string;
  productLink: string;
  offerLink: string;
  ratingStar: string | null;
  periodStartTime: string;
  periodEndTime: string;
};

type SnapshotDetail = SnapshotMeta & { produtos: SnapshotProduto[] };

type ColunaSort = 'name' | 'preco' | 'sales' | 'comissao' | 'rating' | 'projecao';

// Vendas estimadas/mês via afiliado: `sales` é janela ~30 dias; normalizamos pra base mensal exata.
function estimarProjecaoMes(p: SnapshotProduto): number {
  const diasJanela =
    (new Date(p.periodEndTime).getTime() - new Date(p.periodStartTime).getTime()) / 86_400_000;
  if (!Number.isFinite(diasJanela) || diasJanela <= 0) return p.sales;
  return Math.round((p.sales / diasJanela) * 30);
}

export default function ConcorrenteDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const qc = useQueryClient();

  const { data: concorrente, isLoading: loadingC } = useQuery({
    queryKey: ['concorrente', id],
    queryFn: () => apiFetch<ConcorrenteDetail>(`/concorrentes/${id}`),
  });

  const { data: snapshots } = useQuery({
    queryKey: ['concorrente', id, 'snapshots'],
    queryFn: () => apiFetch<SnapshotMeta[]>(`/concorrentes/${id}/snapshots`),
  });

  // Snapshot selecionado — default = mais recente quando carregar.
  const [snapshotId, setSnapshotId] = useState<string | null>(null);
  const idEscolhido = snapshotId ?? snapshots?.[0]?.id ?? null;

  const { data: snapshotDetail, isLoading: loadingSnap } = useQuery({
    queryKey: ['concorrente', id, 'snapshot', idEscolhido],
    queryFn: () =>
      apiFetch<SnapshotDetail>(`/concorrentes/${id}/snapshots/${idEscolhido}`),
    enabled: !!idEscolhido,
  });

  const sort = useTableSort<SnapshotProduto, ColunaSort>(
    {
      name: (p) => p.productName.toLowerCase(),
      preco: (p) => p.priceMinCentavos,
      sales: (p) => p.sales,
      comissao: (p) => Number(p.commissionRate),
      rating: (p) => Number(p.ratingStar ?? 0),
      projecao: (p) => estimarProjecaoMes(p),
    },
    { chave: 'sales', direcao: 'desc' },
  );

  const produtos = useMemo(
    () => sort.ordenar(snapshotDetail?.produtos ?? []),
    [snapshotDetail, sort],
  );

  const sincronizar = useMutation({
    mutationFn: () => apiFetch(`/concorrentes/${id}/sync`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['concorrente', id] });
      qc.invalidateQueries({ queryKey: ['concorrente', id, 'snapshots'] });
      qc.invalidateQueries({ queryKey: ['concorrentes'] });
      setSnapshotId(null); // volta pro mais recente
      toast.success('Sincronização concluída');
    },
  });

  if (loadingC) {
    return <div className="p-6 text-muted-foreground">Carregando…</div>;
  }
  if (!concorrente) {
    return <div className="p-6 text-destructive">Concorrente não encontrado</div>;
  }

  const totalSalesSnapshot = produtos.reduce((s, p) => s + p.sales, 0);
  const totalProjMes = produtos.reduce((s, p) => s + estimarProjecaoMes(p), 0);
  const totalComissaoMes = produtos.reduce(
    (s, p) => s + estimarProjecaoMes(p) * p.commissionCentavos,
    0,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/concorrentes">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            {concorrente.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={concorrente.imageUrl}
                alt=""
                className="h-16 w-16 rounded-full border object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full border bg-muted" />
            )}
            <div className="flex-1">
              <CardTitle className="text-xl">{concorrente.loja}</CardTitle>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {concorrente.username && <span>@{concorrente.username}</span>}
                {concorrente.ratingStar && (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-500" />
                    {Number(concorrente.ratingStar).toFixed(2)}
                  </span>
                )}
                {concorrente.commissionRatePadrao && (
                  <Badge variant="secondary">
                    Comissão padrão {pct(Number(concorrente.commissionRatePadrao), 0)}
                  </Badge>
                )}
                {concorrente.shopId && (
                  <a
                    href={`https://shopee.com.br/shop/${concorrente.shopId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    Abrir na Shopee <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
            <Button
              onClick={() => sincronizar.mutate()}
              disabled={sincronizar.isPending || !concorrente.shopId}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${sincronizar.isPending ? 'animate-spin' : ''}`}
              />
              {sincronizar.isPending ? 'Sincronizando…' : 'Atualizar agora'}
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Snapshots</CardTitle>
            <p className="text-xs text-muted-foreground">
              {snapshots?.length ?? 0} sync(s) registrado(s). Selecione um pra ver os produtos daquele momento.
            </p>
          </div>
          <Select
            value={idEscolhido ?? ''}
            onValueChange={(v) => setSnapshotId(v)}
            disabled={!snapshots?.length}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Sem snapshots" />
            </SelectTrigger>
            <SelectContent>
              {snapshots?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {new Date(s.sincronizadoEm).toLocaleString('pt-BR')} ·{' '}
                  {s.origem === 'CRON' ? 'cron' : 'manual'} ·{' '}
                  {s.qtdProdutos} produto(s)
                  {s.erroMensagem ? ' · ERRO' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        {snapshotDetail?.erroMensagem && (
          <CardContent>
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Erro no sync: {snapshotDetail.erroMensagem}
            </div>
          </CardContent>
        )}
      </Card>

      {produtos.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Vendas (afiliado) na janela</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totalSalesSnapshot}</div>
              <p className="text-xs text-muted-foreground">Soma de sales de todos os produtos</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Projeção vendas/mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totalProjMes}</div>
              <p className="text-xs text-muted-foreground">
                Normalizada via periodStartTime/EndTime
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Comissão projetada/mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {centavosParaReais(totalComissaoMes)}
              </div>
              <p className="text-xs text-muted-foreground">Σ projVendas × commission</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <SortableHead chave="name" estado={sort.estado} onClick={sort.alternar}>
                Produto
              </SortableHead>
              <SortableHead chave="preco" estado={sort.estado} onClick={sort.alternar}>
                Preço
              </SortableHead>
              <SortableHead chave="sales" estado={sort.estado} onClick={sort.alternar}>
                Vendas (afiliado)
              </SortableHead>
              <SortableHead chave="projecao" estado={sort.estado} onClick={sort.alternar}>
                Proj. mensal
              </SortableHead>
              <SortableHead chave="comissao" estado={sort.estado} onClick={sort.alternar}>
                Comissão
              </SortableHead>
              <SortableHead chave="rating" estado={sort.estado} onClick={sort.alternar}>
                Rating
              </SortableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingSnap && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Carregando snapshot…
                </TableCell>
              </TableRow>
            )}
            {!loadingSnap && produtos.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  Sem produtos neste snapshot
                </TableCell>
              </TableRow>
            )}
            {produtos.map((p) => {
              const projMes = estimarProjecaoMes(p);
              const precoStr =
                p.priceMinCentavos === p.priceMaxCentavos
                  ? centavosParaReais(p.priceMinCentavos)
                  : `${centavosParaReais(p.priceMinCentavos)} – ${centavosParaReais(p.priceMaxCentavos)}`;
              return (
                <TableRow key={p.id}>
                  <TableCell>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded border object-cover"
                    />
                  </TableCell>
                  <TableCell className="max-w-[420px]">
                    <a
                      href={p.offerLink}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 hover:underline"
                    >
                      {p.productName}
                    </a>
                    {p.priceDiscountRate > 0 && (
                      <Badge variant="secondary" className="mt-1">
                        -{p.priceDiscountRate}%
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{precoStr}</TableCell>
                  <TableCell className="tabular-nums">{p.sales}</TableCell>
                  <TableCell className="tabular-nums">{projMes}</TableCell>
                  <TableCell className="tabular-nums">
                    {pct(Number(p.commissionRate), 0)} ·{' '}
                    <span className="text-muted-foreground">
                      {centavosParaReais(p.commissionCentavos)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {p.ratingStar ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3 w-3 fill-amber-400 stroke-amber-500" />
                        {Number(p.ratingStar).toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <a href={p.productLink} target="_blank" rel="noreferrer" title="Produto na Shopee">
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </Button>
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
