'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Search, X } from 'lucide-react';
import type { JobCreate, Produto } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { normalizarBusca } from '@/lib/utils';
import { Button } from '@/components/ui/button';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Impressora = 'A1' | 'H2C';
type Origem = 'SHOPEE' | 'ML' | 'SITE' | 'ESTOQUE';

// Variação vinda da listagem global /variacoes (só os campos que o diálogo usa).
type VariacaoEstoque = { id: string; produtoId: string; nome: string; estoqueAtual: number };

// Estado agrupado por produto: cada produto tem uma impressora e 1+ linhas (variação + qtd).
// Produto sem variação → 1 linha com variacaoId null.
type LinhaSel = { variacaoId: string | null; qtd: string };
type ProdutoSel = { produtoId: string; impressora: Impressora; linhas: LinhaSel[] };

const ORIGENS: [Origem, string][] = [
  ['SHOPEE', 'Shopee'],
  ['ML', 'Mercado Livre'],
  ['SITE', 'Site'],
  ['ESTOQUE', 'Pra estoque'],
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function JobDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { data: produtos } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => apiFetch<Produto[]>('/produtos'),
  });
  const { data: variacoes } = useQuery({
    queryKey: ['variacoes'],
    queryFn: () => apiFetch<VariacaoEstoque[]>('/variacoes'),
  });

  const [busca, setBusca] = useState('');
  const [selecionados, setSelecionados] = useState<ProdutoSel[]>([]);
  const [origem, setOrigem] = useState<Origem>('SHOPEE');
  const [observacao, setObservacao] = useState('');

  const variacoesPorProduto = useMemo(() => {
    const m = new Map<string, VariacaoEstoque[]>();
    for (const v of variacoes ?? []) m.set(v.produtoId, [...(m.get(v.produtoId) ?? []), v]);
    return m;
  }, [variacoes]);

  const produtoPorId = useMemo(() => {
    const m = new Map<string, Produto>();
    for (const p of produtos ?? []) m.set(p.id, p);
    return m;
  }, [produtos]);

  const filtrados = useMemo(() => {
    const q = normalizarBusca(busca.trim());
    const lista = produtos ?? [];
    if (!q) return lista;
    return lista.filter((p) => normalizarBusca(p.nome).includes(q));
  }, [produtos, busca]);

  function reset() {
    setBusca('');
    setSelecionados([]);
    setOrigem('SHOPEE');
    setObservacao('');
  }

  function alternarProduto(p: Produto) {
    setSelecionados((prev) => {
      if (prev.some((s) => s.produtoId === p.id)) return prev.filter((s) => s.produtoId !== p.id);
      const vs = variacoesPorProduto.get(p.id) ?? [];
      const linhas: LinhaSel[] = vs.length
        ? vs.map((v) => ({ variacaoId: v.id, qtd: '0' }))
        : [{ variacaoId: null, qtd: '1' }];
      return [...prev, { produtoId: p.id, impressora: p.impressora as Impressora, linhas }];
    });
  }

  function removerProduto(produtoId: string) {
    setSelecionados((prev) => prev.filter((s) => s.produtoId !== produtoId));
  }

  function setImpressora(produtoId: string, impressora: Impressora) {
    setSelecionados((prev) =>
      prev.map((s) => (s.produtoId === produtoId ? { ...s, impressora } : s)),
    );
  }

  function setQtd(produtoId: string, variacaoId: string | null, qtd: string) {
    setSelecionados((prev) =>
      prev.map((s) =>
        s.produtoId === produtoId
          ? { ...s, linhas: s.linhas.map((l) => (l.variacaoId === variacaoId ? { ...l, qtd } : l)) }
          : s,
      ),
    );
  }

  const totalCards = selecionados
    .flatMap((s) => s.linhas)
    .filter((l) => Number(l.qtd) > 0).length;

  const salvar = useMutation({
    mutationFn: (itens: JobCreate[]) =>
      apiFetch<{ count: number }>('/producao/bulk', { method: 'POST', json: { itens } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['producao'] });
      toast.success(res.count === 1 ? 'Job criado na fila' : `${res.count} cards criados`);
      reset();
      onOpenChange(false);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const itens: JobCreate[] = [];
    for (const sel of selecionados) {
      for (const linha of sel.linhas) {
        const q = Number(linha.qtd);
        if (!Number.isInteger(q) || q <= 0) continue;
        itens.push({
          dataInicio: new Date().toISOString(),
          origem,
          produtoId: sel.produtoId,
          variacaoId: linha.variacaoId,
          qtd: q,
          prioridade: 0,
          impressora: sel.impressora,
          observacao: observacao.trim() || null,
        });
      }
    }
    if (itens.length === 0) {
      toast.error('Defina a quantidade de pelo menos um produto/variação');
      return;
    }
    salvar.mutate(itens);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo job de produção</DialogTitle>
          <DialogDescription>
            Busque e clique nos produtos. Em produtos com variação (cor), defina quantos de cada. O
            que já houver em estoque de prontos pula a impressão automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Produtos</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar produto…"
                className="pl-8"
              />
            </div>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border">
              {filtrados.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </p>
              ) : (
                filtrados.map((p) => {
                  const selecionado = selecionados.some((s) => s.produtoId === p.id);
                  const temVariacao = (variacoesPorProduto.get(p.id) ?? []).length > 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => alternarProduto(p)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className={selecionado ? 'font-medium' : ''}>
                        {p.nome}
                        {temVariacao && (
                          <span className="ml-1.5 text-xs text-muted-foreground">com variações</span>
                        )}
                      </span>
                      {selecionado && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {selecionados.length > 0 && (
            <div className="space-y-2">
              <Label>Selecionados</Label>
              {selecionados.map((sel) => {
                const produto = produtoPorId.get(sel.produtoId);
                const vs = variacoesPorProduto.get(sel.produtoId) ?? [];
                return (
                  <div key={sel.produtoId} className="space-y-2 rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{produto?.nome ?? '—'}</span>
                      <div className="flex items-center gap-2">
                        <Select
                          value={sel.impressora}
                          onValueChange={(v) => setImpressora(sel.produtoId, v as Impressora)}
                        >
                          <SelectTrigger className="h-8 w-[4.5rem]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A1">A1</SelectItem>
                            <SelectItem value="H2C">H2C</SelectItem>
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={() => removerProduto(sel.produtoId)}
                          title="Tirar da leva"
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {sel.linhas.map((linha) => {
                      const v = vs.find((x) => x.id === linha.variacaoId);
                      return (
                        <div
                          key={linha.variacaoId ?? 'sem-variacao'}
                          className="flex items-center justify-between gap-2 pl-1"
                        >
                          <span className="text-sm text-muted-foreground">
                            {v ? v.nome : 'Quantidade'}
                            {v && (
                              <span className="ml-1.5 text-xs">
                                ({v.estoqueAtual} {v.estoqueAtual === 1 ? 'pronto' : 'prontos'})
                              </span>
                            )}
                          </span>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            value={linha.qtd}
                            onChange={(e) => setQtd(sel.produtoId, linha.variacaoId, e.target.value)}
                            className="h-8 w-20"
                            aria-label={v ? `Quantidade ${v.nome}` : 'Quantidade'}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Origem</Label>
              <Select value={origem} onValueChange={(v) => setOrigem(v as Origem)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORIGENS.map(([v, label]) => (
                    <SelectItem key={v} value={v}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="obs">Observação</Label>
              <Input
                id="obs"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="opcional (ex: nº do pedido)"
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={salvar.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={salvar.isPending || totalCards === 0}>
              {salvar.isPending
                ? 'Criando…'
                : totalCards > 1
                  ? `Criar ${totalCards} cards`
                  : 'Criar job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
