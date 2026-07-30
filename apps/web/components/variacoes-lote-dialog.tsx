'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AlertTriangle, Search } from 'lucide-react';
import type { Filamento, Produto, VariacoesEmLoteResultado } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { normalizarBusca } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Cria a combinação produto × cor de uma vez.
 *
 * Parte do ESTOQUE de filamento, não do catálogo de cores: cor que acabou não vira
 * variação, senão o Gabriel anuncia o que não consegue imprimir. As com saldo vêm
 * marcadas por padrão.
 */
export function VariacoesLoteDialog({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [cores, setCores] = useState<Set<string>>(new Set());
  const [produtos, setProdutos] = useState<Set<string>>(new Set());
  const [tocouNasCores, setTocouNasCores] = useState(false);

  const { data: filamentos } = useQuery({
    queryKey: ['filamentos'],
    queryFn: () => apiFetch<Filamento[]>('/filamentos'),
    enabled: open,
  });
  const { data: catalogo } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => apiFetch<Produto[]>('/produtos'),
    enabled: open,
  });

  const comEstoque = useMemo(
    () =>
      (filamentos ?? [])
        .filter((f) => f.ativo)
        .sort((a, b) => b.estoqueGramas - a.estoqueGramas),
    [filamentos],
  );

  // Pré-marca quem tem rolo em casa — é o palpite certo na maioria das vezes.
  const coresEfetivas = useMemo(() => {
    if (tocouNasCores) return cores;
    return new Set(comEstoque.filter((f) => f.estoqueGramas > 0 && f.siglaCor).map((f) => f.id));
  }, [tocouNasCores, cores, comEstoque]);

  const produtosFiltrados = useMemo(() => {
    const alvo = normalizarBusca(busca);
    return (catalogo ?? [])
      .filter((p) => p.ativo)
      .filter((p) => !alvo || normalizarBusca(p.nome).includes(alvo));
  }, [catalogo, busca]);

  const semSigla = comEstoque.filter((f) => coresEfetivas.has(f.id) && !f.siglaCor);
  const total = coresEfetivas.size * produtos.size;

  const criar = useMutation({
    mutationFn: () =>
      apiFetch<VariacoesEmLoteResultado>('/variacoes/lote', {
        method: 'POST',
        json: { produtoIds: [...produtos], filamentoIds: [...coresEfetivas] },
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['variacoes'] });
      qc.invalidateQueries({ queryKey: ['produtos'] });
      const pulou = r.puladas > 0 ? ` · ${r.puladas} já existiam` : '';
      toast.success(`${r.criadas} variação(ões) criada(s)${pulou}`);
      setProdutos(new Set());
      onOpenChange(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Erro ao criar'),
  });

  function alternar(set: Set<string>, id: string, aplicar: (s: Set<string>) => void) {
    const novo = new Set(set);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    aplicar(novo);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar variações em lote</DialogTitle>
          <DialogDescription>
            Escolha as cores que você tem e os produtos. Cada combinação vira uma variação com
            SKU pronto. O que já existe é pulado, então dá pra rodar de novo sem medo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">
              Cores <span className="font-normal text-muted-foreground">(pelo estoque)</span>
            </p>
            <div className="grid max-h-52 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border p-2">
              {comEstoque.map((f) => (
                <label
                  key={f.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={coresEfetivas.has(f.id)}
                    onCheckedChange={() => {
                      setTocouNasCores(true);
                      alternar(coresEfetivas, f.id, setCores);
                    }}
                  />
                  <span className="truncate">{f.nome}</span>
                  {f.siglaCor ? (
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {f.siglaCor}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="shrink-0 text-[10px] text-amber-600">
                      sem sigla
                    </Badge>
                  )}
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {Math.round(f.estoqueGramas)}g
                  </span>
                </label>
              ))}
            </div>
          </div>

          {semSigla.length > 0 && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">
                  {semSigla.map((f) => f.nome).join(', ')}
                </span>{' '}
                {semSigla.length === 1 ? 'não tem' : 'não têm'} sigla de cor. Cadastre a sigla no
                filamento (Estoque → Custos) antes, senão o SKU sai sem a cor.
              </p>
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Produtos</p>
              <div className="relative w-56">
                <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar…"
                  className="h-8 pl-7 text-sm"
                />
              </div>
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto rounded-md border border-border p-2">
              {produtosFiltrados.map((p) => (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent"
                >
                  <Checkbox
                    checked={produtos.has(p.id)}
                    onCheckedChange={() => alternar(produtos, p.id, setProdutos)}
                  />
                  <span className="truncate">{p.nome}</span>
                </label>
              ))}
              {produtosFiltrados.length === 0 && (
                <p className="px-2 py-3 text-sm text-muted-foreground">Nenhum produto encontrado.</p>
              )}
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setProdutos(new Set(produtosFiltrados.map((p) => p.id)))}
              >
                Marcar os {produtosFiltrados.length} visíveis
              </Button>
              {produtos.size > 0 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setProdutos(new Set())}>
                  Limpar
                </Button>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="items-center gap-3">
          <p className="mr-auto text-sm text-muted-foreground">
            {total === 0
              ? 'Escolha ao menos uma cor e um produto'
              : `${produtos.size} produto(s) × ${coresEfetivas.size} cor(es) = até ${total} variações`}
          </p>
          <DialogClose asChild>
            <Button variant="outline" disabled={criar.isPending}>
              Cancelar
            </Button>
          </DialogClose>
          <Button
            onClick={() => criar.mutate()}
            disabled={criar.isPending || total === 0 || semSigla.length > 0}
          >
            {criar.isPending ? 'Criando…' : 'Criar variações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
