'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Filter,
  Search,
  Star,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Textarea } from '@/components/ui/textarea';
import { Pagination } from '@/components/pagination';
import { useTablePagination } from '@/lib/use-table-pagination';

type Classificacao = 'GAP' | 'VARIACAO' | 'MATCH' | 'MATCH_MANUAL' | 'DESCARTADO';

type GapItem = {
  marketplace: 'SHOPEE' | 'TIKTOK' | 'ML' | 'OUTRO';
  externalId: string;
  productName: string;
  priceMinCentavos: number;
  priceMaxCentavos: number;
  imageUrl: string;
  productLink: string;
  vendasEstimadasMes: number;
  ratingStar: number | null;
  categoriaIds: number[];
  lojaExternalId: string | null;
  lojaNome: string | null;
  classificacao: Classificacao;
  produtoMahouSimilar: { id: string; nome: string } | null;
  decisao: {
    tipo: 'MATCH_MANUAL' | 'DESCARTADO';
    observacao: string | null;
    decididoPor: string | null;
    decididoEm: string;
  } | null;
};

type GapsResponse = { items: GapItem[]; total: number };

type Filamento = {
  id: string;
  nome: string;
  ativo: boolean;
};

const CLASSIFICACAO_LABEL: Record<Classificacao, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  GAP: { label: 'GAP', variant: 'default' },
  VARIACAO: { label: 'Variação', variant: 'secondary' },
  MATCH: { label: 'Match auto', variant: 'outline' },
  MATCH_MANUAL: { label: 'Match manual', variant: 'outline' },
  DESCARTADO: { label: 'Descartado', variant: 'destructive' },
};

export default function GapsPage() {
  const [filtros, setFiltros] = useState({
    classificacao: 'GAP' as Classificacao | 'TODAS',
    lojaExternalId: '',
    vendasMin: '',
    q: '',
  });
  const [dialogCopiar, setDialogCopiar] = useState<GapItem | null>(null);
  const [dialogDescartar, setDialogDescartar] = useState<GapItem | null>(null);
  const [dialogMatch, setDialogMatch] = useState<GapItem | null>(null);

  const queryClient = useQueryClient();
  const pag = useTablePagination({ resetKey: filtros });

  const qsParams = useMemo(() => {
    const p = new URLSearchParams();
    if (filtros.classificacao !== 'TODAS') p.set('classificacao', filtros.classificacao);
    if (filtros.lojaExternalId) p.set('lojaExternalId', filtros.lojaExternalId);
    if (filtros.vendasMin) p.set('vendasMin', filtros.vendasMin);
    if (filtros.q) p.set('q', filtros.q);
    p.set('page', String(pag.page));
    p.set('pageSize', String(pag.pageSize));
    return p.toString();
  }, [filtros, pag.page, pag.pageSize]);

  const gapsQuery = useQuery<GapsResponse>({
    queryKey: ['gaps', qsParams],
    queryFn: () => apiFetch(`/oportunidades/gaps?${qsParams}`),
  });

  const filamentosQuery = useQuery<Filamento[]>({
    queryKey: ['filamentos-ativos'],
    queryFn: () => apiFetch('/filamentos'),
    select: (data) => data.filter((f) => f.ativo),
  });

  // Counts globais (independentes da página atual). pageSize=1 economiza payload;
  // só precisamos do `total`. Não passa lojaExternalId/q/vendasMin de propósito —
  // queremos o totalizador de gaps/variações do universo todo, não do filtro UI.
  const gapsCountQuery = useQuery<GapsResponse>({
    queryKey: ['gaps-count', 'GAP'],
    queryFn: () => apiFetch('/oportunidades/gaps?classificacao=GAP&pageSize=1'),
  });
  const variacoesCountQuery = useQuery<GapsResponse>({
    queryKey: ['gaps-count', 'VARIACAO'],
    queryFn: () => apiFetch('/oportunidades/gaps?classificacao=VARIACAO&pageSize=1'),
  });

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/oportunidades"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Voltar pra Oportunidades
          </Link>
          <h1 className="text-2xl font-semibold">Gaps de Catálogo</h1>
          <p className="text-sm text-muted-foreground">
            Produtos que concorrentes monitorados vendem × catálogo Mahou. Use pra detectar
            oportunidades de copiar ou gerar variações.
          </p>
        </div>
      </header>

      {/* Insights — counts globais, independentes do filtro/página atual */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Gaps detectados (total)</div>
          <div className="text-2xl font-semibold">{gapsCountQuery.data?.total ?? '—'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Variações sugeridas (total)</div>
          <div className="text-2xl font-semibold">{variacoesCountQuery.data?.total ?? '—'}</div>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Filter className="h-4 w-4" /> Filtros
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Classificação</Label>
            <Select
              value={filtros.classificacao}
              onValueChange={(v) => setFiltros({ ...filtros, classificacao: v as Classificacao | 'TODAS' })}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas</SelectItem>
                <SelectItem value="GAP">GAP</SelectItem>
                <SelectItem value="VARIACAO">Variação</SelectItem>
                <SelectItem value="MATCH">Match (auto)</SelectItem>
                <SelectItem value="MATCH_MANUAL">Match manual</SelectItem>
                <SelectItem value="DESCARTADO">Descartado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Vendas/mês mínimas</Label>
            <Input
              type="number"
              className="w-32"
              placeholder="0"
              value={filtros.vendasMin}
              onChange={(e) => setFiltros({ ...filtros, vendasMin: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Loja (shopId)</Label>
            <Input
              className="w-40"
              placeholder="ex: 789036029"
              value={filtros.lojaExternalId}
              onChange={(e) => setFiltros({ ...filtros, lojaExternalId: e.target.value })}
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Buscar nome</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="cantinho, porta aliança, suporte..."
                value={filtros.q}
                onChange={(e) => setFiltros({ ...filtros, q: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Tabela */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Foto</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead className="w-40">Loja</TableHead>
              <TableHead className="w-28 text-right">Preço</TableHead>
              <TableHead className="w-24 text-right">Vendas/mês</TableHead>
              <TableHead className="w-32">Classificação</TableHead>
              <TableHead className="w-48">Mahou similar</TableHead>
              <TableHead className="w-44 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {gapsQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Carregando…
                </TableCell>
              </TableRow>
            )}
            {gapsQuery.data?.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Nenhum gap nesse filtro.
                </TableCell>
              </TableRow>
            )}
            {gapsQuery.data?.items.map((item) => (
              <TableRow key={`${item.marketplace}-${item.externalId}`}>
                <TableCell>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-muted" />
                  )}
                </TableCell>
                <TableCell>
                  <a
                    href={item.productLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    <span className="line-clamp-2">{item.productName}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                  {item.ratingStar != null && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      {item.ratingStar.toFixed(1)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <div>{item.lojaNome}</div>
                  <div className="text-muted-foreground">{item.lojaExternalId}</div>
                </TableCell>
                <TableCell className="text-right text-sm">
                  {item.priceMinCentavos === item.priceMaxCentavos
                    ? centavosParaReais(item.priceMinCentavos)
                    : `${centavosParaReais(item.priceMinCentavos)} – ${centavosParaReais(item.priceMaxCentavos)}`}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {item.vendasEstimadasMes.toLocaleString('pt-BR')}
                </TableCell>
                <TableCell>
                  <Badge variant={CLASSIFICACAO_LABEL[item.classificacao].variant}>
                    {CLASSIFICACAO_LABEL[item.classificacao].label}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {item.produtoMahouSimilar ? (
                    <Link
                      href={`/produtos/${item.produtoMahouSimilar.id}`}
                      className="line-clamp-2 hover:underline"
                    >
                      {item.produtoMahouSimilar.nome}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      title="Copiar como rascunho"
                      onClick={() => setDialogCopiar(item)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Marcar match manual (Mahou já tem)"
                      onClick={() => setDialogMatch(item)}
                    >
                      <Check className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      title="Descartar (não-relevante)"
                      onClick={() => setDialogDescartar(item)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Pagination
          page={pag.page}
          pageSize={pag.pageSize}
          total={gapsQuery.data?.total ?? 0}
          onPageChange={pag.setPage}
        />
      </Card>

      {/* Modal: Copiar como rascunho */}
      <CopiarRascunhoDialog
        item={dialogCopiar}
        onClose={() => setDialogCopiar(null)}
        filamentos={filamentosQuery.data ?? []}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['gaps'] });
        }}
      />

      {/* Modal: Match manual */}
      <DecisaoDialog
        item={dialogMatch}
        decisao="MATCH_MANUAL"
        title="Marcar match manual"
        descricao="Mahou já tem produto similar a esse. Esse item vai sumir do filtro GAP."
        onClose={() => setDialogMatch(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['gaps'] })}
      />

      {/* Modal: Descartar */}
      <DecisaoDialog
        item={dialogDescartar}
        decisao="DESCARTADO"
        title="Descartar"
        descricao="Produto não-relevante (material/categoria incompatível com 3D Mahou). Some do GAP."
        onClose={() => setDialogDescartar(null)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['gaps'] })}
      />
    </div>
  );
}

function CopiarRascunhoDialog({
  item,
  filamentos,
  onClose,
  onSuccess,
}: {
  item: GapItem | null;
  filamentos: Filamento[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [filamentoId, setFilamentoId] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!item) return null;
      return apiFetch(`/oportunidades/gaps/${item.marketplace}/${item.externalId}/copiar-rascunho`, {
        method: 'POST',
        body: JSON.stringify({ filamentoId, canalPrincipal: 'SHOPEE' }),
      });
    },
    onSuccess: () => {
      toast.success('Rascunho criado. Complete peso/tempo em Produtos.');
      onSuccess();
      onClose();
    },
  });

  return (
    <Dialog open={item != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Copiar como rascunho</DialogTitle>
          <DialogDescription>
            Cria um Produto rascunho com inspiração no produto do concorrente. Você completa
            peso, tempo e impressora antes de anunciar.
          </DialogDescription>
        </DialogHeader>
        {item && (
          <div className="space-y-3 text-sm">
            <div className="rounded bg-muted p-2 text-xs">
              <div className="font-medium">{item.productName}</div>
              <div className="text-muted-foreground">
                {item.lojaNome} · {centavosParaReais(item.priceMinCentavos)}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Filamento</Label>
              <Select value={filamentoId} onValueChange={setFilamentoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o filamento" />
                </SelectTrigger>
                <SelectContent>
                  {filamentos.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!filamentoId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            <Copy className="mr-1 h-3 w-3" />
            Criar rascunho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DecisaoDialog({
  item,
  decisao,
  title,
  descricao,
  onClose,
  onSuccess,
}: {
  item: GapItem | null;
  decisao: 'MATCH_MANUAL' | 'DESCARTADO';
  title: string;
  descricao: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [observacao, setObservacao] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      if (!item) return null;
      return apiFetch(`/oportunidades/gaps/${item.marketplace}/${item.externalId}/decisao`, {
        method: 'POST',
        body: JSON.stringify({ decisao, observacao: observacao || null }),
      });
    },
    onSuccess: () => {
      toast.success('Decisão registrada.');
      setObservacao('');
      onSuccess();
      onClose();
    },
  });

  return (
    <Dialog open={item != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{descricao}</DialogDescription>
        </DialogHeader>
        {item && (
          <div className="space-y-3 text-sm">
            <div className="rounded bg-muted p-2 text-xs">
              <div className="font-medium">{item.productName}</div>
              <div className="text-muted-foreground">
                {item.lojaNome} · {centavosParaReais(item.priceMinCentavos)}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observação (opcional)</Label>
              <Textarea
                rows={2}
                placeholder="Ex.: já temos versão genérica; ou: cerâmica, não-3D printable"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {decisao === 'MATCH_MANUAL' ? (
              <>
                <Check className="mr-1 h-3 w-3" />
                Marcar match
              </>
            ) : (
              <>
                <X className="mr-1 h-3 w-3" />
                Descartar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
