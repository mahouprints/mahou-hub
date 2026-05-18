'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Insumo, InsumoCreate } from '@mahou-hub/contracts';
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

/** Sugestões pra dropdown de unidade; o usuário ainda pode digitar livre. */
const UNIDADES_SUGERIDAS = ['un', 'm', 'cm', 'kg', 'g', 'ml', 'L', 'pç'];

interface Props {
  insumo?: Insumo;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function InsumoDialog({ insumo, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const editando = !!insumo;

  const [nome, setNome] = useState(insumo?.nome ?? '');
  const [unidade, setUnidade] = useState(insumo?.unidade ?? 'un');
  const [valorReais, setValorReais] = useState(
    insumo ? (insumo.custoUnitarioCentavos / 100).toFixed(2).replace('.', ',') : '',
  );
  const [observacao, setObservacao] = useState(insumo?.observacao ?? '');

  const salvar = useMutation({
    mutationFn: (data: InsumoCreate) =>
      editando
        ? apiFetch(`/insumos/${insumo!.id}`, { method: 'PATCH', json: data })
        : apiFetch('/insumos', { method: 'POST', json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['insumos'] });
      toast.success(editando ? 'Insumo atualizado' : 'Insumo cadastrado');
      onOpenChange(false);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const custoUnitarioCentavos = parseDecimalParaCentavos(valorReais);
    if (!nome.trim() || !unidade.trim() || !Number.isFinite(custoUnitarioCentavos) || custoUnitarioCentavos <= 0) {
      toast.error('Preencha nome, unidade e custo unitário');
      return;
    }
    salvar.mutate({
      nome: nome.trim(),
      unidade: unidade.trim(),
      custoUnitarioCentavos,
      observacao: observacao.trim() || null,
      ativo: insumo?.ativo ?? true,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar insumo' : 'Novo insumo'}</DialogTitle>
          <DialogDescription>
            Cadastre um item reutilizável (caixa, fita, etiqueta). Produtos referenciam o insumo
            com a quantidade consumida.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ex: Caixa P 10x10"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={unidade} onValueChange={setUnidade}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIDADES_SUGERIDAS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Custo por unidade (R$)</Label>
              <InputDecimal value={valorReais} onChange={(s) => setValorReais(s)} />
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
              {salvar.isPending ? 'Salvando…' : editando ? 'Salvar' : 'Cadastrar insumo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
