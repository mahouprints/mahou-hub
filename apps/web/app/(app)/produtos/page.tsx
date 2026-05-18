'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Check,
  CheckSquare,
  Circle,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import type { CalcularOutput, Filamento, Produto } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, isUrl, pct } from '@/lib/format';
import { useTableSelection } from '@/lib/use-table-selection';
import { useTableSort } from '@/lib/use-table-sort';
import { SortableHead } from '@/components/sortable-head';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
import { SelectionToolbar } from '@/components/selection-toolbar';

type ProdutoComPricing = Produto & {
  filamento: { id: string; nome: string };
  pesoG: number;
  tempoH: number;
  pricing: CalcularOutput;
};

interface MelhorCanal {
  canal: 'SHOPEE' | 'ML';
  liquidoCentavos: number;
  margem: number;
  lucroPorHoraCentavos: number;
}

/** Sentinel pro Select do shadcn — value não pode ser ''. */
const TODOS = '__todos__';

type ColunaSort =
  | 'nome'
  | 'pesoG'
  | 'tempoH'
  | 'custoTotal'
  | 'preco'
  | 'imposto'
  | 'liquido'
  | 'margem'
  | 'lucroH'
  | 'anunciado';

type FiltroAnunciado = 'todos' | 'sim' | 'nao';

/**
 * Escolhe o canal entre marketplaces (Shopee × ML) com maior líquido por peça.
 * Site fica de fora porque não paga taxa e sempre venceria — não é decisão útil.
 */
function melhorCanalMarketplace(p: ProdutoComPricing): MelhorCanal {
  const shopee: MelhorCanal = {
    canal: 'SHOPEE',
    liquidoCentavos: p.pricing.liquidoShopeeCentavos,
    margem: p.pricing.margemShopee,
    lucroPorHoraCentavos: p.pricing.lucroPorHoraShopeeCentavos,
  };
  const ml: MelhorCanal = {
    canal: 'ML',
    liquidoCentavos: p.pricing.liquidoMlCentavos,
    margem: p.pricing.margemMl,
    lucroPorHoraCentavos: p.pricing.lucroPorHoraMlCentavos,
  };
  return shopee.liquidoCentavos >= ml.liquidoCentavos ? shopee : ml;
}

export default function ProdutosPage() {
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => apiFetch<ProdutoComPricing[]>('/produtos'),
  });

  const { data: filamentos } = useQuery({
    queryKey: ['filamentos'],
    queryFn: () => apiFetch<Filamento[]>('/filamentos'),
  });

  const [filtroFilamento, setFiltroFilamento] = useState(TODOS);
  const [filtroCanal, setFiltroCanal] = useState(TODOS);
  const [filtroImpressora, setFiltroImpressora] = useState(TODOS);
  const [filtroAnunciado, setFiltroAnunciado] = useState<FiltroAnunciado>('todos');

  const sort = useTableSort<ProdutoComPricing, ColunaSort>({
    nome: (p) => p.nome,
    pesoG: (p) => p.pesoG,
    tempoH: (p) => p.tempoH,
    custoTotal: (p) => p.pricing.custoTotalProducaoCentavos,
    preco: (p) => p.precoCentavos,
    imposto: (p) => p.pricing.impostoCentavos,
    liquido: (p) => melhorCanalMarketplace(p).liquidoCentavos,
    margem: (p) => melhorCanalMarketplace(p).margem,
    lucroH: (p) => melhorCanalMarketplace(p).lucroPorHoraCentavos,
    anunciado: (p) => (p.anunciado ? 1 : 0),
  });

  const filtrados = useMemo(() => {
    if (!data) return [];
    const f = data.filter((p) => {
      if (filtroFilamento !== TODOS && p.filamentoId !== filtroFilamento) return false;
      if (filtroCanal !== TODOS && p.canalPrincipal !== filtroCanal) return false;
      if (filtroImpressora !== TODOS && p.impressora !== filtroImpressora) return false;
      if (filtroAnunciado === 'sim' && !p.anunciado) return false;
      if (filtroAnunciado === 'nao' && p.anunciado) return false;
      return true;
    });
    return sort.ordenar(f);
  }, [data, filtroFilamento, filtroCanal, filtroImpressora, filtroAnunciado, sort]);

  const idsVisiveis = useMemo(() => filtrados.map((p) => p.id), [filtrados]);
  const sel = useTableSelection(idsVisiveis);

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch<{ count: number }>('/produtos/bulk-delete', { method: 'POST', json: { ids } }),
    onSuccess: (resp) => {
      qc.invalidateQueries({ queryKey: ['produtos'] });
      sel.acoes.limpar();
      toast.success(`${resp.count} ${resp.count === 1 ? 'produto excluído' : 'produtos excluídos'}`);
    },
  });

  const bulkAnunciar = useMutation({
    mutationFn: (vars: { ids: string[]; anunciado: boolean }) =>
      apiFetch<{ count: number }>('/produtos/bulk-anunciar', {
        method: 'POST',
        json: vars,
      }),
    onSuccess: (resp, vars) => {
      qc.invalidateQueries({ queryKey: ['produtos'] });
      sel.acoes.limpar();
      const verbo = vars.anunciado ? 'anunciados' : 'pendentes';
      toast.success(`${resp.count} produto(s) marcado(s) como ${verbo}`);
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            {filtrados.length} de {data?.length ?? 0} itens · clique numa linha pra ver detalhes
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sel.modoSelecao ? (
            <Button variant="outline" onClick={sel.acoes.sairModo}>
              <X className="h-4 w-4" /> Sair da seleção
            </Button>
          ) : (
            <Button variant="outline" onClick={sel.acoes.entrarModo}>
              <CheckSquare className="h-4 w-4" /> Selecionar
            </Button>
          )}
          <Button asChild>
            <Link href="/produtos/novo">
              <Plus className="h-4 w-4" /> Novo produto
            </Link>
          </Button>
        </div>
      </header>

      <FiltrosBar
        filamentos={filamentos ?? []}
        filtroFilamento={filtroFilamento}
        setFiltroFilamento={setFiltroFilamento}
        filtroCanal={filtroCanal}
        setFiltroCanal={setFiltroCanal}
        filtroImpressora={filtroImpressora}
        setFiltroImpressora={setFiltroImpressora}
        filtroAnunciado={filtroAnunciado}
        setFiltroAnunciado={setFiltroAnunciado}
      />

      <SelectionToolbar
        count={sel.count}
        itemLabel="produto"
        excluindo={bulkDelete.isPending}
        onLimpar={sel.acoes.limpar}
        onExcluir={() => bulkDelete.mutateAsync([...sel.selecionados])}
        acoesExtras={
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                bulkAnunciar.mutate({ ids: [...sel.selecionados], anunciado: true })
              }
              disabled={bulkAnunciar.isPending}
            >
              <Check className="h-3.5 w-3.5" /> Marcar anunciados
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                bulkAnunciar.mutate({ ids: [...sel.selecionados], anunciado: false })
              }
              disabled={bulkAnunciar.isPending}
            >
              <Circle className="h-3.5 w-3.5" /> Marcar pendentes
            </Button>
          </>
        }
      />

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

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
                <SortableHead chave="nome" estado={sort.estado} onClick={sort.alternar}>
                  Nome
                </SortableHead>
                <SortableHead
                  chave="pesoG"
                  estado={sort.estado}
                  onClick={sort.alternar}
                  align="right"
                  className="text-right"
                >
                  Peso
                </SortableHead>
                <SortableHead
                  chave="tempoH"
                  estado={sort.estado}
                  onClick={sort.alternar}
                  align="right"
                  className="text-right"
                >
                  Tempo
                </SortableHead>
                <SortableHead
                  chave="custoTotal"
                  estado={sort.estado}
                  onClick={sort.alternar}
                  align="right"
                  className="text-right"
                >
                  Custo total
                </SortableHead>
                <SortableHead
                  chave="preco"
                  estado={sort.estado}
                  onClick={sort.alternar}
                  align="right"
                  className="text-right"
                >
                  Preço
                </SortableHead>
                <SortableHead
                  chave="imposto"
                  estado={sort.estado}
                  onClick={sort.alternar}
                  align="right"
                  className="text-right"
                >
                  Imposto
                </SortableHead>
                <SortableHead
                  chave="liquido"
                  estado={sort.estado}
                  onClick={sort.alternar}
                  align="right"
                  className="text-right"
                >
                  Líquido
                </SortableHead>
                <SortableHead
                  chave="margem"
                  estado={sort.estado}
                  onClick={sort.alternar}
                  align="right"
                  className="text-right"
                >
                  Margem
                </SortableHead>
                <SortableHead
                  chave="lucroH"
                  estado={sort.estado}
                  onClick={sort.alternar}
                  align="right"
                  className="text-right"
                >
                  Lucro/h
                </SortableHead>
                <SortableHead chave="anunciado" estado={sort.estado} onClick={sort.alternar}>
                  Status
                </SortableHead>
                <TableHead className="w-36 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtrados.map((p) => {
                const melhor = melhorCanalMarketplace(p);
                const marcado = sel.selecionados.has(p.id);
                return (
                  <TableRow
                    key={p.id}
                    onClick={() => router.push(`/produtos/${p.id}`)}
                    className="cursor-pointer"
                  >
                    {sel.modoSelecao && (
                      <TableCell
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={marcado}
                          onCheckedChange={() => sel.acoes.toggle(p.id)}
                          aria-label={`Selecionar ${p.nome}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-medium">
                      <span className="block truncate max-w-[260px]" title={p.nome}>
                        {p.nome}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.pesoG}g</TableCell>
                    <TableCell className="text-right tabular-nums">{p.tempoH}h</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {centavosParaReais(p.pricing.custoTotalProducaoCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {centavosParaReais(p.precoCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {centavosParaReais(p.pricing.impostoCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {centavosParaReais(melhor.liquidoCentavos)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MargemBadge valor={melhor.margem} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {centavosParaReais(melhor.lucroPorHoraCentavos)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.anunciado ? 'success' : 'default'} className="font-normal">
                        {p.anunciado ? 'Anunciado' : 'Pendente'}
                      </Badge>
                    </TableCell>
                    <TableCell
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <IconeLink url={p.inspiracao} icon={ExternalLink} label="Abrir inspiração" />
                        <IconeLink url={p.modelo3dUrl} icon={Box} label="Abrir modelo 3D" />
                        <BotaoEditar produtoId={p.id} />
                        <BotaoExcluir produtoId={p.id} produtoNome={p.nome} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtrados.length === 0 && data.length > 0 && (
                <TableRow>
                  <TableCell
                    colSpan={sel.modoSelecao ? 12 : 11}
                    className="text-center text-sm text-muted-foreground"
                  >
                    Nenhum produto bate com os filtros atuais.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function FiltrosBar({
  filamentos,
  filtroFilamento,
  setFiltroFilamento,
  filtroCanal,
  setFiltroCanal,
  filtroImpressora,
  setFiltroImpressora,
  filtroAnunciado,
  setFiltroAnunciado,
}: {
  filamentos: Filamento[];
  filtroFilamento: string;
  setFiltroFilamento: (v: string) => void;
  filtroCanal: string;
  setFiltroCanal: (v: string) => void;
  filtroImpressora: string;
  setFiltroImpressora: (v: string) => void;
  filtroAnunciado: FiltroAnunciado;
  setFiltroAnunciado: (v: FiltroAnunciado) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase text-muted-foreground">Filamento</Label>
        <Select value={filtroFilamento} onValueChange={setFiltroFilamento}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os filamentos</SelectItem>
            {filamentos.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase text-muted-foreground">Canal principal</Label>
        <Select value={filtroCanal} onValueChange={setFiltroCanal}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os canais</SelectItem>
            <SelectItem value="SHOPEE">Shopee</SelectItem>
            <SelectItem value="ML">Mercado Livre</SelectItem>
            <SelectItem value="SITE">Site próprio</SelectItem>
            <SelectItem value="TIKTOK">TikTok Shop</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase text-muted-foreground">Impressora</Label>
        <Select value={filtroImpressora} onValueChange={setFiltroImpressora}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas as impressoras</SelectItem>
            <SelectItem value="A1">A1</SelectItem>
            <SelectItem value="H2C">H2C</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs uppercase text-muted-foreground">Anunciado</Label>
        <Select
          value={filtroAnunciado}
          onValueChange={(v) => setFiltroAnunciado(v as FiltroAnunciado)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="nao">Pendentes</SelectItem>
            <SelectItem value="sim">Anunciados</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function MargemBadge({ valor }: { valor: number }) {
  const variant = valor >= 0.3 ? 'success' : valor >= 0.15 ? 'warning' : 'danger';
  return (
    <Badge variant={variant} className="font-normal">
      {pct(valor)}
    </Badge>
  );
}

function BotaoEditar({ produtoId }: { produtoId: string }) {
  return (
    <Link
      href={`/produtos/${produtoId}/editar`}
      title="Editar produto"
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Pencil className="h-3.5 w-3.5" />
    </Link>
  );
}

function BotaoExcluir({ produtoId, produtoNome }: { produtoId: string; produtoNome: string }) {
  const [aberto, setAberto] = useState(false);
  const qc = useQueryClient();
  const excluir = useMutation({
    mutationFn: () => apiFetch(`/produtos/${produtoId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['produtos'] });
      setAberto(false);
      toast.success(`Produto "${produtoNome}" excluído`);
    },
  });

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Excluir produto"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir produto</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir <strong>{produtoNome}</strong>? Esta ação pode ser
            revertida apenas via banco de dados.
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

function IconeLink({
  url,
  icon: Icon,
  label,
}: {
  url: string | null;
  icon: typeof ExternalLink;
  label: string;
}) {
  if (!isUrl(url)) {
    return (
      <span
        title={url ? `Sem URL: "${url}"` : 'Sem link cadastrado'}
        className="inline-flex h-7 w-7 cursor-default items-center justify-center text-muted-foreground/30"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <a
      href={url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      title={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
    </a>
  );
}
