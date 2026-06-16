'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { JobCreate, Produto } from '@mahou-hub/contracts';
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

type Impressora = 'A1' | 'H2C';
type Origem = 'SHOPEE' | 'ML' | 'SITE' | 'ESTOQUE';

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

  const [produtoId, setProdutoId] = useState('');
  const [qtd, setQtd] = useState('1');
  const [impressora, setImpressora] = useState<Impressora>('A1');
  const [origem, setOrigem] = useState<Origem>('SHOPEE');
  const [observacao, setObservacao] = useState('');

  // Ao escolher o produto, sugere a impressora padrão dele.
  useEffect(() => {
    if (!produtoId) return;
    const p = produtos?.find((x) => x.id === produtoId);
    if (p) setImpressora(p.impressora as Impressora);
  }, [produtoId, produtos]);

  function reset() {
    setProdutoId('');
    setQtd('1');
    setImpressora('A1');
    setOrigem('SHOPEE');
    setObservacao('');
  }

  const salvar = useMutation({
    mutationFn: (data: JobCreate) => apiFetch('/producao', { method: 'POST', json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['producao'] });
      toast.success('Job criado na fila');
      reset();
      onOpenChange(false);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = Number(qtd);
    if (!produtoId || !Number.isInteger(q) || q <= 0) {
      toast.error('Escolha o produto e a quantidade');
      return;
    }
    salvar.mutate({
      dataInicio: new Date().toISOString(),
      origem,
      produtoId,
      qtd: q,
      prioridade: 0,
      impressora,
      observacao: observacao.trim() || null,
    });
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
            Entra na coluna &quot;Fila&quot;. Ao mover pra &quot;Impresso&quot;, o filamento baixa
            sozinho.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Produto</Label>
            <Select value={produtoId} onValueChange={setProdutoId}>
              <SelectTrigger>
                <SelectValue placeholder="— selecione —" />
              </SelectTrigger>
              <SelectContent>
                {produtos?.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qtd">Quantidade</Label>
              <Input
                id="qtd"
                type="number"
                min={1}
                step={1}
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Impressora</Label>
              <Select value={impressora} onValueChange={(v) => setImpressora(v as Impressora)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A1">A1</SelectItem>
                  <SelectItem value="H2C">H2C</SelectItem>
                </SelectContent>
              </Select>
            </div>
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

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={salvar.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Criando…' : 'Criar job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
