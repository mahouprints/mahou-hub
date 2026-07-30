'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Filamento, ProdutoVariacao } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
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

/** Campo numérico vazio vira null (= herda do produto), não zero. */
function numeroOuNulo(v: string): number | null {
  const n = Number(v.trim());
  return v.trim() && Number.isFinite(n) && n > 0 ? n : null;
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
  const [filamentoId, setFilamentoId] = useState<string>(HERDA);
  const [precoReais, setPrecoReais] = useState('');
  const [estoqueMinimo, setEstoqueMinimo] = useState('0');
  const [pesoG, setPesoG] = useState('');
  const [tempoH, setTempoH] = useState('');

  // Carrega campos ao abrir (edição) ou limpa (criação).
  useEffect(() => {
    if (!open) return;
    setNome(variacao?.nome ?? '');
    setSku(variacao?.sku ?? '');
    setFilamentoId(variacao?.filamentoId ?? HERDA);
    setPrecoReais(variacao?.precoCentavos != null ? String(variacao.precoCentavos / 100) : '');
    setEstoqueMinimo(String(variacao?.estoqueMinimo ?? 0));
    setPesoG(variacao?.pesoG != null ? String(variacao.pesoG) : '');
    setTempoH(variacao?.tempoH != null ? String(variacao.tempoH) : '');
  }, [open, variacao]);

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
    if (!nome.trim()) {
      toast.error('Informe o nome da variação');
      return;
    }
    const preco = precoReais.trim() ? Math.round(Number(precoReais) * 100) : null;
    if (preco != null && (!Number.isFinite(preco) || preco < 0)) {
      toast.error('Preço inválido');
      return;
    }
    salvar.mutate({
      nome: nome.trim(),
      // Vazio na criação = o backend gera a partir do nome do produto + sigla da cor.
      // Na edição mandamos sempre, porque apagar o campo não pode virar "gera outro".
      ...(sku.trim() || editando ? { sku: sku.trim() } : {}),
      filamentoId: filamentoId === HERDA ? null : filamentoId,
      precoCentavos: preco,
      pesoG: numeroOuNulo(pesoG),
      tempoH: numeroOuNulo(tempoH),
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
              <Label htmlFor="v-sku">SKU {!editando && <span className="text-muted-foreground">(opcional)</span>}</Label>
              <Input
                id="v-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                placeholder={editando ? '' : 'deixe vazio pra gerar'}
              />
            </div>
          </div>

          {!editando && !sku.trim() && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Sem SKU, eu gero a partir do nome do produto e da sigla da cor do filamento
              (ex: <code>SUPORTE-MOBILE-BERCO-AZ</code>).
            </p>
          )}

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

          <div className="rounded-md border border-border p-3">
            <p className="text-sm font-medium">Esta variação muda o que sai da impressora?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Preencha só em kit ou tamanho diferente. Variação de cor deixa vazio — mesmo molde,
              mesmo peso. Se ficar vazio, herda o peso e o tempo do produto.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="v-peso">Peso (g)</Label>
                <Input
                  id="v-peso"
                  type="number"
                  min={0}
                  step="0.01"
                  value={pesoG}
                  onChange={(e) => setPesoG(e.target.value)}
                  placeholder="herda do produto"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="v-tempo">Tempo (h)</Label>
                <Input
                  id="v-tempo"
                  type="number"
                  min={0}
                  step="0.01"
                  value={tempoH}
                  onChange={(e) => setTempoH(e.target.value)}
                  placeholder="herda do produto"
                />
              </div>
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
