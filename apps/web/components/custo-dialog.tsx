'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CategoriaCusto, Custo, CustoCreate } from '@mahou-hub/contracts';
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
import { MonthPicker } from '@/components/ui/month-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIAS: { value: CategoriaCusto; label: string }[] = [
  { value: 'ALUGUEL', label: 'Aluguel' },
  { value: 'ENERGIA', label: 'Energia' },
  { value: 'INTERNET', label: 'Internet' },
  { value: 'SOFTWARE', label: 'Software' },
  { value: 'ASSINATURA', label: 'Assinatura' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'INSUMOS', label: 'Insumos' },
  { value: 'IMPOSTOS', label: 'Impostos' },
  { value: 'OUTROS', label: 'Outros' },
];

interface Props {
  custo?: Custo;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function CustoDialog({ custo, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const editando = !!custo;

  const [descricao, setDescricao] = useState(custo?.descricao ?? '');
  const [categoria, setCategoria] = useState<CategoriaCusto>(custo?.categoria ?? 'OUTROS');
  const [valorReais, setValorReais] = useState(
    custo ? (custo.valorCentavos / 100).toFixed(2).replace('.', ',') : '',
  );
  const [mes, setMes] = useState(
    custo ? toMonthInput(new Date(custo.dataCompetencia)) : toMonthInput(new Date()),
  );
  // Recorrente só faz sentido na criação — após gerado, é só editar/deletar.
  const [recorrente, setRecorrente] = useState(false);
  const [mesesRecorrencia, setMesesRecorrencia] = useState('12');
  const [observacao, setObservacao] = useState(custo?.observacao ?? '');

  const salvar = useMutation({
    mutationFn: (data: CustoCreate) =>
      editando
        ? apiFetch(`/custos/${custo!.id}`, { method: 'PATCH', json: data })
        : apiFetch('/custos', { method: 'POST', json: data }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['custos'] });
      qc.invalidateQueries({ queryKey: ['financeiro-resumo'] });
      const n = Number(mesesRecorrencia);
      toast.success(
        editando
          ? 'Custo atualizado'
          : recorrente
            ? `Custo + ${n} cópia${n === 1 ? '' : 's'} futura${n === 1 ? '' : 's'} criada${n === 1 ? '' : 's'}`
            : 'Custo registrado',
      );
      onOpenChange(false);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const valorCentavos = parseDecimalParaCentavos(valorReais);
    if (!descricao.trim() || !Number.isFinite(valorCentavos) || valorCentavos <= 0 || !mes) {
      toast.error('Preencha descrição, valor e mês competência');
      return;
    }
    const n = Number(mesesRecorrencia);
    if (recorrente && (!Number.isInteger(n) || n < 1 || n > 60)) {
      toast.error('Recorrência: informe um número inteiro entre 1 e 60 meses');
      return;
    }
    salvar.mutate({
      descricao: descricao.trim(),
      categoria,
      valorCentavos,
      dataCompetencia: monthToDate(mes),
      recorrente: editando ? false : recorrente,
      mesesRecorrencia: !editando && recorrente ? n : undefined,
      observacao: observacao.trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editando ? 'Editar custo' : 'Novo custo'}</DialogTitle>
          <DialogDescription>
            {editando
              ? 'Mudanças afetam apenas este registro — cópias geradas anteriormente não são alteradas.'
              : 'Mês competência agrupa o custo no relatório financeiro.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="ex: Aluguel maio"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as CategoriaCusto)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <InputDecimal value={valorReais} onChange={(s) => setValorReais(s)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mês competência</Label>
            <MonthPicker value={mes} onChange={setMes} placeholder="Selecionar mês" />
          </div>

          {!editando && (
            <div className="space-y-3 rounded-md border border-border bg-card p-3">
              <label className="flex cursor-pointer items-start gap-2">
                <input
                  type="checkbox"
                  checked={recorrente}
                  onChange={(e) => setRecorrente(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span className="text-sm">
                  Recorrente mensal
                  <span className="block text-xs text-muted-foreground">
                    Gera cópias nos meses seguintes — cada uma pode ser editada ou removida
                    individualmente.
                  </span>
                </span>
              </label>
              {recorrente && (
                <div className="flex items-center gap-2 pl-6">
                  <Label htmlFor="meses" className="text-xs">
                    Repetir por
                  </Label>
                  <Input
                    id="meses"
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    value={mesesRecorrencia}
                    onChange={(e) => setMesesRecorrencia(e.target.value)}
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">meses (1 a 60)</span>
                </div>
              )}
            </div>
          )}

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
              {salvar.isPending ? 'Salvando…' : editando ? 'Salvar' : 'Registrar custo'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toMonthInput(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Converte 'YYYY-MM' (UI) pro Date do dia 1 do mês em UTC. */
function monthToDate(mes: string): Date {
  const partes = mes.split('-').map(Number);
  const ano = partes[0] ?? 0;
  const mm = partes[1] ?? 1;
  return new Date(Date.UTC(ano, mm - 1, 1));
}
