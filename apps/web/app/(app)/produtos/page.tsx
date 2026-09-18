'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Layers, Pencil, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { Canal, Produto } from '@mahou-hub/contracts';
import type { CalculoSaida } from '@mahou-hub/pricing';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, pct } from '@/lib/format';
import { useTablePagination } from '@/lib/use-table-pagination';
import { useTableSort } from '@/lib/use-table-sort';
import { CanaisAnunciadosDialog } from '@/components/canais-anunciados-dialog';
import { Pagination } from '@/components/pagination';
import { SortableHead } from '@/components/sortable-head';
import { VariacoesLoteDialog } from '@/components/variacoes-lote-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

interface ProdutoCatalogo extends Produto {
  custoInsumosCentavos: number;
  pricing: CalculoSaida;
}

const CANAL_ROTULO: Record<Canal, string> = {
  SHOPEE: 'Shopee',
  ML: 'Mercado Livre',
  SITE: 'Site próprio',
  TIKTOK: 'TikTok Shop',
};

function margemPrincipal(produto: ProdutoCatalogo) {
  const margens = {
    SHOPEE: produto.pricing.margemShopee,
    ML: produto.pricing.margemMl,
    SITE: produto.pricing.margemSite,
    TIKTOK: produto.pricing.margemTikTok,
  };
  return margens[produto.canalPrincipal];
}

/** Catálogo único de peças manuais e importadas. Ex.: /produtos, inclusive sem anúncios. */
export default function ProdutosPage() {
  const qc = useQueryClient();
  const [ativo, setAtivo] = useState(true);
  const [busca, setBusca] = useState('');
  const [loteAberto, setLoteAberto] = useState(false);
  const [editandoCanais, setEditandoCanais] = useState<ProdutoCatalogo | null>(null);
  const {
    data: produtos = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['produtos', { ativo }],
    queryFn: () =>
      apiFetch<ProdutoCatalogo[]>(`/produtos?ativo=${ativo}&sortBy=criadoEm&sortDir=desc`),
  });
  const sort = useTableSort<ProdutoCatalogo, 'nome' | 'preco' | 'custo' | 'margem'>({
    nome: (produto) => produto.nome,
    preco: (produto) => produto.precoCentavos,
    custo: (produto) => produto.pricing.custoTotalProducaoCentavos,
    margem: margemPrincipal,
  });
  const pag = useTablePagination({
    pageSize: 25,
    resetKey: `${ativo}:${busca}:${produtos.length}`,
  });
  const filtrados = sort.ordenar(
    produtos.filter((produto) =>
      produto.nome.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')),
    ),
  );

  async function atualizarCatalogo(produtoId: string) {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['produtos'] }),
      qc.invalidateQueries({ queryKey: ['produto', produtoId] }),
      qc.invalidateQueries({ queryKey: ['variacoes'] }),
      qc.invalidateQueries({ queryKey: ['estoque'] }),
      qc.invalidateQueries({ queryKey: ['makerworld'] }),
      qc.invalidateQueries({ queryKey: ['makerworld-resumo'] }),
    ]);
  }

  const mudarAtivo = useMutation({
    mutationFn: (produto: ProdutoCatalogo) =>
      produto.ativo
        ? apiFetch(`/produtos/${produto.id}`, { method: 'DELETE' })
        : apiFetch(`/produtos/${produto.id}`, { method: 'PATCH', json: { ativo: true } }),
    onSuccess: async (_resultado, produto) => {
      await atualizarCatalogo(produto.id);
      toast.success(
        produto.ativo ? 'Produto arquivado. O histórico foi preservado.' : 'Produto restaurado',
      );
    },
  });

  const salvarCanais = useMutation({
    mutationFn: ({ id, canais }: { id: string; canais: Canal[] }) =>
      apiFetch(`/produtos/${id}/canais-anunciados`, { method: 'PUT', json: { canais } }),
    onSuccess: async (_resultado, { id }) => {
      await atualizarCatalogo(id);
      setEditandoCanais(null);
      toast.success('Canais atualizados');
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            Peças avulsas, autorais e importadas em um só catálogo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLoteAberto(true)}>
            <Layers className="size-4" /> Criar variações em lote
          </Button>
          <Button asChild>
            <Link href="/produtos/novo">
              <Plus className="size-4" /> Novo produto
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-2" aria-label="Situação dos produtos">
          <Button
            variant={ativo ? 'default' : 'outline'}
            aria-pressed={ativo}
            onClick={() => setAtivo(true)}
          >
            Ativos
          </Button>
          <Button
            variant={!ativo ? 'default' : 'outline'}
            aria-pressed={!ativo}
            onClick={() => setAtivo(false)}
          >
            Arquivados
          </Button>
        </div>
        <div className="min-w-48 flex-1 space-y-1.5">
          <Label htmlFor="busca-produtos">Buscar produto</Label>
          <Input
            id="busca-produtos"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Nome do produto"
          />
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {ativo
          ? 'Custos por unidade incluem filamento, energia, embalagem e insumos. A margem considera o canal principal.'
          : 'Produtos arquivados ficam fora dos novos lançamentos. Vendas e registros anteriores são preservados.'}
      </p>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando produtos…</p>}
      {error && (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">
          Não foi possível carregar os produtos.
          <Button variant="outline" onClick={() => void refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}
      {!isLoading && !error && filtrados.length === 0 && (
        <Card className="space-y-3 p-10 text-center">
          <p className="font-medium">
            {busca
              ? 'Nenhum produto encontrado'
              : ativo
                ? 'Seu catálogo está pronto para novos produtos'
                : 'Nenhum produto arquivado'}
          </p>
          <p className="text-sm text-muted-foreground">
            {busca
              ? 'Tente buscar por outro nome.'
              : ativo
                ? 'Cadastre uma peça avulsa com seus materiais e custos por unidade.'
                : 'Produtos arquivados aparecerão aqui para consulta ou restauração.'}
          </p>
          {ativo && !busca && (
            <Button asChild>
              <Link href="/produtos/novo">Cadastrar primeiro produto</Link>
            </Button>
          )}
        </Card>
      )}
      {!isLoading && !error && filtrados.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead chave="nome" estado={sort.estado} onClick={sort.alternar}>
                  Produto
                </SortableHead>
                <SortableHead chave="preco" estado={sort.estado} onClick={sort.alternar}>
                  Preço
                </SortableHead>
                <SortableHead chave="custo" estado={sort.estado} onClick={sort.alternar}>
                  Custo / un.
                </SortableHead>
                <TableHead>Insumos / un.</TableHead>
                <SortableHead chave="margem" estado={sort.estado} onClick={sort.alternar}>
                  Margem
                </SortableHead>
                <TableHead>Anúncios</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pag.paginar(filtrados).map((produto) => (
                <TableRow key={produto.id}>
                  <TableCell>
                    <Link href={`/produtos/${produto.id}`} className="font-medium hover:underline">
                      {produto.nome}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {CANAL_ROTULO[produto.canalPrincipal]}
                    </p>
                    {produto.rascunho && <Badge variant="warning">Completar cadastro</Badge>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {centavosParaReais(produto.precoCentavos)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {centavosParaReais(produto.pricing.custoTotalProducaoCentavos)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {centavosParaReais(produto.custoInsumosCentavos)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={margemPrincipal(produto) >= 0 ? 'secondary' : 'danger'}>
                      {pct(margemPrincipal(produto))}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!produto.ativo}
                      onClick={() => setEditandoCanais(produto)}
                    >
                      {(produto.canaisAnunciados ?? [])
                        .map((canal) => CANAL_ROTULO[canal])
                        .join(', ') || (produto.anunciado ? 'Informar canais' : 'Sem anúncio')}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/produtos/${produto.id}/editar`}
                          aria-label={`Editar ${produto.nome}`}
                        >
                          <Pencil className="size-4" />{' '}
                          {produto.rascunho ? 'Completar cadastro' : 'Editar'}
                        </Link>
                      </Button>
                      {(!produto.rascunho || produto.ativo) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={mudarAtivo.isPending}
                          onClick={() => mudarAtivo.mutate(produto)}
                          aria-label={`${produto.ativo ? 'Arquivar' : 'Restaurar'} ${produto.nome}`}
                        >
                          {produto.ativo ? (
                            <Archive className="size-4" />
                          ) : (
                            <RotateCcw className="size-4" />
                          )}
                          {produto.ativo ? 'Arquivar' : 'Restaurar'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pagination
            page={pag.page}
            pageSize={pag.pageSize}
            total={filtrados.length}
            onPageChange={pag.setPage}
          />
        </Card>
      )}

      <VariacoesLoteDialog open={loteAberto} onOpenChange={setLoteAberto} />
      {editandoCanais && (
        <CanaisAnunciadosDialog
          open
          onOpenChange={(aberto) => {
            if (!aberto) setEditandoCanais(null);
          }}
          canaisIniciais={editandoCanais.canaisAnunciados ?? []}
          nomeProduto={editandoCanais.nome}
          salvando={salvarCanais.isPending}
          onConfirmar={(canais) => salvarCanais.mutate({ id: editandoCanais.id, canais })}
        />
      )}
    </div>
  );
}
