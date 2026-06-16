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

// Cada produto escolhido carrega sua própria qtd e impressora; origem/obs são da leva inteira.
type ItemSelecionado = { produtoId: string; qtd: string; impressora: Impressora };

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

  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<ItemSelecionado[]>([]);
  const [origem, setOrigem] = useState<Origem>('SHOPEE');
  const [observacao, setObservacao] = useState('');

  const filtrados = useMemo(() => {
    const q = normalizarBusca(busca.trim());
    const lista = produtos ?? [];
    if (!q) return lista;
    return lista.filter((p) => normalizarBusca(p.nome).includes(q));
  }, [produtos, busca]);

  const nomePorId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of produtos ?? []) m.set(p.id, p.nome);
    return m;
  }, [produtos]);

  function reset() {
    setBusca('');
    setItens([]);
    setOrigem('SHOPEE');
    setObservacao('');
  }

  function alternarProduto(p: Produto) {
    setItens((prev) =>
      prev.some((i) => i.produtoId === p.id)
        ? prev.filter((i) => i.produtoId !== p.id)
        : [...prev, { produtoId: p.id, qtd: '1', impressora: p.impressora as Impressora }],
    );
  }

  function atualizarItem(produtoId: string, patch: Partial<ItemSelecionado>) {
    setItens((prev) => prev.map((i) => (i.produtoId === produtoId ? { ...i, ...patch } : i)));
  }

  const salvar = useMutation({
    mutationFn: (itensJob: JobCreate[]) =>
      apiFetch('/producao/bulk', { method: 'POST', json: { itens: itensJob } }),
    onSuccess: (_d, itensJob) => {
      qc.invalidateQueries({ queryKey: ['producao'] });
      toast.success(
        itensJob.length === 1 ? 'Job criado na fila' : `${itensJob.length} jobs criados na fila`,
      );
      reset();
      onOpenChange(false);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (itens.length === 0) {
      toast.error('Adicione pelo menos um produto');
      return;
    }
    const payload: JobCreate[] = [];
    for (const item of itens) {
      const q = Number(item.qtd);
      if (!Number.isInteger(q) || q <= 0) {
        toast.error(`Quantidade inválida em "${nomePorId.get(item.produtoId)}"`);
        return;
      }
      payload.push({
        dataInicio: new Date().toISOString(),
        origem,
        produtoId: item.produtoId,
        qtd: q,
        prioridade: 0,
        impressora: item.impressora,
        observacao: observacao.trim() || null,
      });
    }
    salvar.mutate(payload);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo job de produção</DialogTitle>
          <DialogDescription>
            Busque e clique nos produtos pra montar a leva. Cada um vira um card próprio na
            &quot;Fila&quot;. Ao mover pra &quot;Impresso&quot;, o filamento baixa sozinho.
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
            <div className="max-h-44 overflow-y-auto rounded-md border border-border">
              {filtrados.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  Nenhum produto encontrado.
                </p>
              ) : (
                filtrados.map((p) => {
                  const selecionado = itens.some((i) => i.produtoId === p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => alternarProduto(p)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <span className={selecionado ? 'font-medium' : ''}>{p.nome}</span>
                      {selecionado && <Check className="h-4 w-4 shrink-0 text-emerald-600" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {itens.length > 0 && (
            <div className="space-y-1.5">
              <Label>Selecionados ({itens.length})</Label>
              <div className="space-y-2">
                {itens.map((item) => (
                  <div key={item.produtoId} className="flex items-center gap-2">
                    <span className="flex-1 truncate text-sm">{nomePorId.get(item.produtoId)}</span>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      value={item.qtd}
                      onChange={(e) => atualizarItem(item.produtoId, { qtd: e.target.value })}
                      className="w-16"
                      aria-label="Quantidade"
                    />
                    <Select
                      value={item.impressora}
                      onValueChange={(v) =>
                        atualizarItem(item.produtoId, { impressora: v as Impressora })
                      }
                    >
                      <SelectTrigger className="w-[4.5rem]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A1">A1</SelectItem>
                        <SelectItem value="H2C">H2C</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      type="button"
                      onClick={() =>
                        setItens((prev) => prev.filter((i) => i.produtoId !== item.produtoId))
                      }
                      title="Remover da leva"
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
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
            <Button type="submit" disabled={salvar.isPending || itens.length === 0}>
              {salvar.isPending
                ? 'Criando…'
                : itens.length > 1
                  ? `Criar ${itens.length} jobs`
                  : 'Criar job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
