'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FaixaShopee } from '@mahou-hub/contracts';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputDecimal } from '@/components/ui/input-decimal';
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
  faixa?: FaixaShopee | null;
}

interface FormState {
  limInferiorReais: string;
  comissaoPct: string;
  fixaCnpjReais: string;
  fixaCpfBaixoReais: string;
  fixaCpfAltoReais: string;
}

const VAZIO: FormState = {
  limInferiorReais: '',
  comissaoPct: '',
  fixaCnpjReais: '',
  fixaCpfBaixoReais: '',
  fixaCpfAltoReais: '',
};

function centavosParaStr(c: number): string {
  return (c / 100).toFixed(2).replace('.', ',');
}

export function TaxaShopeeDialog({ open, onOpenChange, faixa }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (faixa) {
      setForm({
        limInferiorReais: centavosParaStr(faixa.limInferiorCentavos),
        comissaoPct: String(faixa.comissaoPct).replace('.', ','),
        fixaCnpjReais: centavosParaStr(faixa.fixaCnpjCentavos),
        fixaCpfBaixoReais: centavosParaStr(faixa.fixaCpfBaixoCentavos),
        fixaCpfAltoReais: centavosParaStr(faixa.fixaCpfAltoCentavos),
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
        limInferiorCentavos: parseDecimalParaCentavos(form.limInferiorReais),
        comissaoPct: parseDecimalBr(form.comissaoPct),
        fixaCnpjCentavos: parseDecimalParaCentavos(form.fixaCnpjReais),
        fixaCpfBaixoCentavos: parseDecimalParaCentavos(form.fixaCpfBaixoReais),
        fixaCpfAltoCentavos: parseDecimalParaCentavos(form.fixaCpfAltoReais),
      };
      if (faixa) {
        await apiFetch(`/parametros/taxas/shopee/${faixa.id}`, { method: 'PATCH', json: payload });
      } else {
        await apiFetch('/parametros/taxas/shopee', { method: 'POST', json: payload });
      }
      await qc.invalidateQueries({ queryKey: ['taxas-shopee'] });
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
          <DialogTitle>{faixa ? 'Editar faixa Shopee' : 'Nova faixa Shopee'}</DialogTitle>
          <DialogDescription>
            Comissão e tarifa fixa aplicadas a partir do limite inferior.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Limite inferior (R$)</Label>
              <InputDecimal value={form.limInferiorReais} onChange={(s) => setForm({ ...form, limInferiorReais: s })} />
            </div>
            <div className="space-y-1.5">
              <Label>Comissão (%)</Label>
              <InputDecimal value={form.comissaoPct} onChange={(s) => setForm({ ...form, comissaoPct: s })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fixa CNPJ (R$)</Label>
            <InputDecimal value={form.fixaCnpjReais} onChange={(s) => setForm({ ...form, fixaCnpjReais: s })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Fixa CPF baixo (R$)</Label>
              <InputDecimal value={form.fixaCpfBaixoReais} onChange={(s) => setForm({ ...form, fixaCpfBaixoReais: s })} />
            </div>
            <div className="space-y-1.5">
              <Label>Fixa CPF alto (R$)</Label>
              <InputDecimal value={form.fixaCpfAltoReais} onChange={(s) => setForm({ ...form, fixaCpfAltoReais: s })} />
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
