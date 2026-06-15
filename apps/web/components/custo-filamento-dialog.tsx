'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Filamento } from '@mahou-hub/contracts';
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
import { InputDecimal } from '@/components/ui/input-decimal';
import { Label } from '@/components/ui/label';

interface Props {
  filamento: Filamento;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CustoFilamentoDialog({ filamento, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [valor, setValor] = useState(
    (filamento.custoKgCentavos / 100).toFixed(2).replace('.', ','),
  );

  const salvar = useMutation({
    mutationFn: (custoKgCentavos: number) =>
      apiFetch(`/filamentos/${filamento.id}`, { method: 'PATCH', json: { custoKgCentavos } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['filamentos'] });
      toast.success('Custo atualizado');
      onOpenChange(false);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const custo = parseDecimalParaCentavos(valor);
    if (!Number.isFinite(custo) || custo <= 0) {
      toast.error('Informe um custo por kg válido');
      return;
    }
    salvar.mutate(custo);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custo do filamento</DialogTitle>
          <DialogDescription>{filamento.nome} · preço por kg pago na compra</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Custo por kg (R$)</Label>
            <InputDecimal value={valor} onChange={setValor} />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={salvar.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={salvar.isPending}>
              {salvar.isPending ? 'Salvando…' : 'Salvar custo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
