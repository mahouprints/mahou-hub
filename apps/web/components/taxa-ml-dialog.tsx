'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FaixaMercadoLivre } from '@mahou-hub/contracts';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputDecimal } from '@/components/ui/input-decimal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api-client';
import { parseDecimalBr, parseDecimalParaCentavos } from '@/lib/parsing';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  faixa?: FaixaMercadoLivre | null;
}

interface FormState {
  faixa: 'A' | 'B' | 'C' | 'D' | 'E';
  limInferiorReais: string;
  custoFixoReais: string;
  pctAlternativo: string;
  comissaoCategoriaPct: string;
}

const VAZIO: FormState = {
  faixa: 'A',
  limInferiorReais: '',
  custoFixoReais: '',
  pctAlternativo: '',
  comissaoCategoriaPct: '',
};

function centavosParaStr(c: number): string {
  return (c / 100).toFixed(2).replace('.', ',');
}

export function TaxaMlDialog({ open, onOpenChange, faixa }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (faixa) {
      setForm({
        faixa: faixa.faixa,
        limInferiorReais: centavosParaStr(faixa.limInferiorCentavos),
        custoFixoReais: centavosParaStr(faixa.custoFixoCentavos),
        pctAlternativo: String(faixa.pctAlternativo).replace('.', ','),
        comissaoCategoriaPct: String(faixa.comissaoCategoriaPct).replace('.', ','),
      });
    } else {
      setForm(VAZIO);
    }
    setErro(null);
  }, [open, faixa]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const payload = {
        faixa: form.faixa,
        limInferiorCentavos: parseDecimalParaCentavos(form.limInferiorReais),
        custoFixoCentavos: parseDecimalParaCentavos(form.custoFixoReais),
        pctAlternativo: parseDecimalBr(form.pctAlternativo),
        comissaoCategoriaPct: parseDecimalBr(form.comissaoCategoriaPct),
      };
      if (faixa) {
        await apiFetch(`/parametros/taxas/ml/${faixa.id}`, { method: 'PATCH', json: payload });
      } else {
        await apiFetch('/parametros/taxas/ml', { method: 'POST', json: payload });
      }
      await qc.invalidateQueries({ queryKey: ['taxas-ml'] });
      await qc.invalidateQueries({ queryKey: ['produtos'] });
      onOpenChange(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{faixa ? 'Editar faixa Mercado Livre' : 'Nova faixa Mercado Livre'}</DialogTitle>
          <DialogDescription>Custo fixo, alternativo % e comissão por categoria.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Faixa</Label>
              <Select value={form.faixa} onValueChange={(v) => setForm({ ...form, faixa: v as FormState['faixa'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['A', 'B', 'C', 'D', 'E'] as const).map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Limite inferior (R$)</Label>
              <InputDecimal value={form.limInferiorReais} onChange={(s) => setForm({ ...form, limInferiorReais: s })} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Custo fixo (R$)</Label>
              <InputDecimal value={form.custoFixoReais} onChange={(s) => setForm({ ...form, custoFixoReais: s })} />
            </div>
            <div className="space-y-1.5">
              <Label>% alternativo</Label>
              <InputDecimal value={form.pctAlternativo} onChange={(s) => setForm({ ...form, pctAlternativo: s })} />
            </div>
            <div className="space-y-1.5">
              <Label>Comissão (%)</Label>
              <InputDecimal value={form.comissaoCategoriaPct} onChange={(s) => setForm({ ...form, comissaoCategoriaPct: s })} />
            </div>
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : faixa ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
