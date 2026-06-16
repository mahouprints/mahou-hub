'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Filamento, ProdutoVariacao } from '@mahou-hub/contracts';
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

// Radix Select não aceita value vazio: sentinela pra "herdar a cor do produto".
const HERDA = '__herda__';

function sugerirSku(produtoNome: string, variacaoNome: string): string {
  const parte = (s: string) =>
    normalizarBusca(s)
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  return [parte(produtoNome), parte(variacaoNome)].filter(Boolean).join('-').toUpperCase();
}

interface Props {
  produtoId: string;
  produtoNome: string;
  variacao?: ProdutoVariacao | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function VariacaoDialog({ produtoId, produtoNome, variacao, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const editando = !!variacao;
  const { data: filamentos } = useQuery({
    queryKey: ['filamentos'],
    queryFn: () => apiFetch<Filamento[]>('/filamentos'),
  });

  const [nome, setNome] = useState('');
  const [sku, setSku] = useState('');
  const [skuEditado, setSkuEditado] = useState(false);
  const [filamentoId, setFilamentoId] = useState<string>(HERDA);
  const [precoReais, setPrecoReais] = useState('');
  const [estoqueMinimo, setEstoqueMinimo] = useState('0');

  // Carrega campos ao abrir (edição) ou limpa (criação).
  useEffect(() => {
    if (!open) return;
    setNome(variacao?.nome ?? '');
    setSku(variacao?.sku ?? '');
    setSkuEditado(!!variacao);
    setFilamentoId(variacao?.filamentoId ?? HERDA);
    setPrecoReais(variacao?.precoCentavos != null ? String(variacao.precoCentavos / 100) : '');
    setEstoqueMinimo(String(variacao?.estoqueMinimo ?? 0));
  }, [open, variacao]);

  // Na criação, sugere o SKU a partir do nome até o usuário editar o campo.
  useEffect(() => {
    if (editando || skuEditado) return;
    setSku(nome ? sugerirSku(produtoNome, nome) : '');
  }, [nome, editando, skuEditado, produtoNome]);

  const filamentosAtivos = (filamentos ?? []).filter((f) => f.ativo);

  const salvar = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      editando
        ? apiFetch(`/variacoes/${variacao!.id}`, { method: 'PATCH', json: body })
        : apiFetch('/variacoes', { method: 'POST', json: { produtoId, ...body } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['variacoes', produtoId] });
      qc.invalidateQueries({ queryKey: ['variacoes'] });
      toast.success(editando ? 'Variação atualizada' : 'Variação criada');
      onOpenChange(false);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim() || !sku.trim()) {
      toast.error('Nome e SKU são obrigatórios');
      return;
    }
    const preco = precoReais.trim() ? Math.round(Number(precoReais) * 100) : null;
    if (preco != null && (!Number.isFinite(preco) || preco < 0)) {
      toast.error('Preço inválido');
      return;
    }
    salvar.mutate({
      nome: nome.trim(),
      sku: sku.trim(),
      filamentoId: filamentoId === HERDA ? null : filamentoId,
      precoCentavos: preco,
      estoqueMinimo: Math.max(0, Math.trunc(Number(estoqueMinimo) || 0)),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar variação' : 'Nova variação'}</DialogTitle>
          <DialogDescription>
            Variação de {produtoNome}. O SKU é único e casa o pedido do marketplace com a cor certa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-nome">Nome (cor)</Label>
              <Input
                id="v-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Rosa"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-sku">SKU</Label>
              <Input
                id="v-sku"
                value={sku}
                onChange={(e) => {
                  setSku(e.target.value);
                  setSkuEditado(true);
                }}
                placeholder="SUPORTE-MOBILE-ROSA"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cor (filamento)</Label>
            <Select value={filamentoId} onValueChange={setFilamentoId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={HERDA}>Herdar do produto</SelectItem>
                {filamentosAtivos.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="v-preco">Preço R$ (opcional)</Label>
              <Input
                id="v-preco"
                type="number"
                min={0}
                step="0.01"
                value={precoReais}
                onChange={(e) => setPrecoReais(e.target.value)}
                placeholder="herda do produto"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="v-min">Estoque mínimo</Label>
              <Input
                id="v-min"
                type="number"
                min={0}
                step={1}
                value={estoqueMinimo}
                onChange={(e) => setEstoqueMinimo(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={salvar.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : editando ? 'Salvar' : 'Criar variação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
