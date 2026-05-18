'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Produto, Venda, VendaCreate } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { parseDecimalParaCentavos } from '@/lib/parsing';
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
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { InputDecimal } from '@/components/ui/input-decimal';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  /** Venda em edição, ou undefined pra criar nova. */
  venda?: Venda;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function VendaDialog({ venda, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const editando = !!venda;

  const { data: produtos } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => apiFetch<Produto[]>('/produtos'),
  });

  const [produtoId, setProdutoId] = useState(venda?.produtoId ?? '');
  const [qtd, setQtd] = useState(String(venda?.qtd ?? 1));
  const [precoReais, setPrecoReais] = useState(
    venda ? (venda.precoUnitarioCentavos / 100).toFixed(2).replace('.', ',') : '',
  );
  const [canal, setCanal] = useState<'SHOPEE' | 'ML' | 'SITE' | 'TIKTOK'>(
    venda?.canal ?? 'SHOPEE',
  );
  const [dataVenda, setDataVenda] = useState<Date | undefined>(
    venda ? new Date(venda.dataVenda) : new Date(),
  );
  const [observacao, setObservacao] = useState(venda?.observacao ?? '');

  // Quando o usuário escolhe o produto numa criação, sugere preço e canal padrão.
  useEffect(() => {
    if (editando || !produtoId) return;
    const p = produtos?.find((x) => x.id === produtoId);
    if (!p) return;
    setPrecoReais((p.precoCentavos / 100).toFixed(2).replace('.', ','));
    setCanal(p.canalPrincipal);
  }, [produtoId, produtos, editando]);

  const salvar = useMutation({
    mutationFn: (data: VendaCreate) =>
      editando
        ? apiFetch(`/vendas/${venda!.id}`, { method: 'PATCH', json: data })
        : apiFetch('/vendas', { method: 'POST', json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendas'] });
      qc.invalidateQueries({ queryKey: ['financeiro-resumo'] });
      toast.success(editando ? 'Venda atualizada' : 'Venda registrada');
      onOpenChange(false);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const precoCentavos = parseDecimalParaCentavos(precoReais);
    const qtdNum = Number(qtd);
    if (
      !produtoId ||
      !Number.isFinite(qtdNum) ||
      qtdNum <= 0 ||
      !Number.isFinite(precoCentavos) ||
      precoCentavos <= 0 ||
      !dataVenda
    ) {
      toast.error('Preencha produto, quantidade, preço e data válidos');
      return;
    }
    salvar.mutate({
      produtoId,
      qtd: qtdNum,
      precoUnitarioCentavos: precoCentavos,
      canal,
      dataVenda,
      observacao: observacao.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar venda' : 'Nova venda'}</DialogTitle>
          <DialogDescription>
            O preço unitário usado aqui pode diferir do preço de tabela do produto.
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

          <div className="grid grid-cols-2 gap-3">
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
              <Label>Preço unitário (R$)</Label>
              <InputDecimal value={precoReais} onChange={(s) => setPrecoReais(s)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Canal</Label>
              <Select value={canal} onValueChange={(v) => setCanal(v as typeof canal)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SHOPEE">Shopee</SelectItem>
                  <SelectItem value="ML">Mercado Livre</SelectItem>
                  <SelectItem value="SITE">Site próprio</SelectItem>
                  <SelectItem value="TIKTOK">TikTok Shop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Data da venda</Label>
              <DatePicker value={dataVenda} onChange={setDataVenda} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observação</Label>
            <Input
              id="obs"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="opcional"
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={salvar.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : editando ? 'Salvar' : 'Registrar venda'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

