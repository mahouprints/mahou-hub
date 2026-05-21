'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, ExternalLink, Plus, Search, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, tempoRelativo } from '@/lib/format';
import { useTableSelection } from '@/lib/use-table-selection';
import { useTableSort } from '@/lib/use-table-sort';
import { SortableHead } from '@/components/sortable-head';
import { SelectionToolbar } from '@/components/selection-toolbar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
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

type Status = 'NOVO' | 'EM_ANALISE' | 'APROVADO' | 'DESCARTADO' | 'VIRARAM_PRODUTO';
type Marketplace = 'SHOPEE' | 'TIKTOK' | 'ML' | 'OUTRO';
type Fonte = 'CONCORRENTE' | 'KEYWORD' | 'CATEGORIA' | 'TOP_VENDAS';

type OportunidadeListItem = {
  id: string;
  marketplace: Marketplace;
  externalId: string;
  productName: string;
  priceMinCentavos: number;
  priceMaxCentavos: number;
  imageUrl: string;
  productLink: string;
  vendasEstimadasMes: number;
  ratingStar: string | null;
  fonte: Fonte;
  status: Status;
  score: string | null;
  notas: string | null;
  produtoId: string | null;
  criadoEm: string;
  lojaNome: string | null;
};

type Coluna = 'name' | 'vendas' | 'preco' | 'rating' | 'score' | 'criado';

const STATUS_LABEL: Record<Status, string> = {
  NOVO: 'Novo',
  EM_ANALISE: 'Em análise',
  APROVADO: 'Aprovado',
  DESCARTADO: 'Descartado',
  VIRARAM_PRODUTO: 'Virou produto',
};
const STATUS_VARIANT: Record<Status, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  NOVO: 'outline',
  EM_ANALISE: 'secondary',
  APROVADO: 'default',
  DESCARTADO: 'destructive',
  VIRARAM_PRODUTO: 'default',
};

export default function OportunidadesPage() {
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState<Status | 'TODOS'>('TODOS');
  const [filtroFonte, setFiltroFonte] = useState<Fonte | 'TODAS'>('TODAS');
  const [busca, setBusca] = useState('');

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (filtroStatus !== 'TODOS') p.set('status', filtroStatus);
    if (filtroFonte !== 'TODAS') p.set('fonte', filtroFonte);
    if (busca.trim()) p.set('q', busca.trim());
    p.set('take', '500');
    return p.toString();
  }, [filtroStatus, filtroFonte, busca]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['oportunidades', queryParams],
    queryFn: () => apiFetch<OportunidadeListItem[]>(`/oportunidades?${queryParams}`),
  });

  const sort = useTableSort<OportunidadeListItem, Coluna>(
    {
      name: (o) => o.productName.toLowerCase(),
      vendas: (o) => o.vendasEstimadasMes,
      preco: (o) => o.priceMinCentavos,
      rating: (o) => Number(o.ratingStar ?? 0),
      score: (o) => Number(o.score ?? 0),
      criado: (o) => new Date(o.criadoEm).getTime(),
    },
    { chave: 'score', direcao: 'desc' },
  );

  const lista = useMemo(() => sort.ordenar(data ?? []), [data, sort]);
  const idsVisiveis = useMemo(() => lista.map((o) => o.id), [lista]);
  const sel = useTableSelection(idsVisiveis);

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch('/oportunidades/bulk-delete', { method: 'POST', json: { ids } }),
    onSuccess: (_r, ids) => {
      qc.invalidateQueries({ queryKey: ['oportunidades'] });
      sel.acoes.sairModo();
      toast.success(`${ids.length} oportunidade(s) removida(s)`);
    },
  });

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Oportunidades</h1>
          <p className="text-sm text-muted-foreground">
            Candidatos a virar produtos no catálogo. Vindo de busca direcionada, brainstorm ou
            descoberta automática nos snapshots de concorrentes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sel.modoSelecao ? (
            <Button variant="outline" onClick={sel.acoes.sairModo}>
              <X className="mr-2 h-4 w-4" /> Sair da seleção
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={sel.acoes.entrarModo}
              disabled={lista.length === 0}
            >
              <CheckSquare className="mr-2 h-4 w-4" /> Selecionar
            </Button>
          )}
          <Button asChild>
            <Link href="/oportunidades/novo">
              <Plus className="mr-2 h-4 w-4" /> Buscar novos
            </Link>
          </Button>
        </div>
      </header>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do produto…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as Status | 'TODOS')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os status</SelectItem>
              {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroFonte} onValueChange={(v) => setFiltroFonte(v as Fonte | 'TODAS')}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas as fontes</SelectItem>
              <SelectItem value="CONCORRENTE">Concorrente</SelectItem>
              <SelectItem value="KEYWORD">Keyword</SelectItem>
              <SelectItem value="CATEGORIA">Categoria</SelectItem>
              <SelectItem value="TOP_VENDAS">Top vendas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <SelectionToolbar
        count={sel.count}
        itemLabel="oportunidade"
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
              <TableHead className="w-12"></TableHead>
              <SortableHead chave="name" estado={sort.estado} onClick={sort.alternar}>
                Produto
              </SortableHead>
              <SortableHead chave="vendas" estado={sort.estado} onClick={sort.alternar}>
                Vendas est./mês
              </SortableHead>
              <SortableHead chave="preco" estado={sort.estado} onClick={sort.alternar}>
                Preço
              </SortableHead>
              <SortableHead chave="rating" estado={sort.estado} onClick={sort.alternar}>
                Rating
              </SortableHead>
              <SortableHead chave="score" estado={sort.estado} onClick={sort.alternar}>
                Score
              </SortableHead>
              <TableHead>Status</TableHead>
              <SortableHead chave="criado" estado={sort.estado} onClick={sort.alternar}>
                Criado
              </SortableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-destructive">
                  Erro ao carregar
                </TableCell>
              </TableRow>
            )}
            {!isLoading && lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                  Nenhuma oportunidade. Use &quot;Buscar novos&quot; pra descobrir candidatos.
                </TableCell>
              </TableRow>
            )}
            {lista.map((o) => {
              const precoStr =
                o.priceMinCentavos === o.priceMaxCentavos
                  ? centavosParaReais(o.priceMinCentavos)
                  : `${centavosParaReais(o.priceMinCentavos)} – ${centavosParaReais(o.priceMaxCentavos)}`;
              return (
                <TableRow key={o.id}>
                  {sel.modoSelecao && (
                    <TableCell>
                      <Checkbox
                        checked={sel.selecionados.has(o.id)}
                        onCheckedChange={() => sel.acoes.toggle(o.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={o.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded border object-cover"
                    />
                  </TableCell>
                  <TableCell className="max-w-[380px]">
                    <Link
                      href={`/oportunidades/${o.id}`}
                      className="line-clamp-2 font-medium hover:underline"
                    >
                      {o.productName}
                    </Link>
                    {o.lojaNome && (
                      <div className="text-xs text-muted-foreground">{o.lojaNome}</div>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {o.vendasEstimadasMes.toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell className="tabular-nums">{precoStr}</TableCell>
                  <TableCell>
                    {o.ratingStar ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-500" />
                        {Number(o.ratingStar).toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums font-medium">
                    {o.score ? Math.round(Number(o.score)) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {tempoRelativo(o.criadoEm)}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild title="Abrir no marketplace">
                      <a href={o.productLink} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" />
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
