'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Parametro, VendedorShopee } from '@mahou-hub/contracts';
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
  parametros: Parametro | null;
}

interface FormState {
  tarifaKwhReais: string;
  vendedorShopee: VendedorShopee;
  emCampanhaShopee: boolean;
  adicionalCampanhaPct: string;
  comissaoMlPct: string;
  impostoAtivo: boolean;
  impostoPct: string;
  margemThresholdVerdePct: string;
  margemThresholdAmareloPct: string;
}

function paraStr(n: number, casas = 2): string {
  return n.toFixed(casas).replace('.', ',');
}

export function ParametrosDialog({ open, onOpenChange, parametros }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open || !parametros) return;
    setForm({
      tarifaKwhReais: paraStr(parametros.tarifaKwhCentavos / 100),
      vendedorShopee: parametros.vendedorShopee,
      emCampanhaShopee: parametros.emCampanhaShopee,
      adicionalCampanhaPct: paraStr(Number(parametros.adicionalCampanhaPct), 2),
      comissaoMlPct: paraStr(Number(parametros.comissaoMlPct), 2),
      impostoAtivo: parametros.impostoAtivo,
      impostoPct: paraStr(Number(parametros.impostoPct), 2),
      margemThresholdVerdePct: paraStr(Number(parametros.margemThresholdVerde) * 100, 0),
      margemThresholdAmareloPct: paraStr(Number(parametros.margemThresholdAmarelo) * 100, 0),
    });
    setErro(null);
  }, [open, parametros]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setErro(null);
    setSalvando(true);
    try {
      const payload = {
        tarifaKwhCentavos: parseDecimalParaCentavos(form.tarifaKwhReais),
        vendedorShopee: form.vendedorShopee,
        emCampanhaShopee: form.emCampanhaShopee,
        adicionalCampanhaPct: parseDecimalBr(form.adicionalCampanhaPct),
        comissaoMlPct: parseDecimalBr(form.comissaoMlPct),
        impostoAtivo: form.impostoAtivo,
        impostoPct: parseDecimalBr(form.impostoPct),
        margemThresholdVerde: parseDecimalBr(form.margemThresholdVerdePct) / 100,
        margemThresholdAmarelo: parseDecimalBr(form.margemThresholdAmareloPct) / 100,
      };
      await apiFetch('/parametros', { method: 'PATCH', json: payload });
      await qc.invalidateQueries({ queryKey: ['parametros'] });
      await qc.invalidateQueries({ queryKey: ['produtos'] });
      onOpenChange(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSalvando(false);
    }
  }

  if (!form) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar parâmetros globais</DialogTitle>
          <DialogDescription>
            Aplica em todos os cálculos de produtos, calculadora e simulador.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tarifa kWh (R$)</Label>
              <InputDecimal
                value={form.tarifaKwhReais}
                onChange={(s) => setForm({ ...form, tarifaKwhReais: s })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vendedor Shopee</Label>
              <Select
                value={form.vendedorShopee}
                onValueChange={(v) => setForm({ ...form, vendedorShopee: v as VendedorShopee })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CNPJ">CNPJ</SelectItem>
                  <SelectItem value="CPF_BAIXO">CPF baixo</SelectItem>
                  <SelectItem value="CPF_ALTO">CPF alto (&gt;450/90d)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Em campanha Shopee</Label>
              <Select
                value={form.emCampanhaShopee ? 'sim' : 'nao'}
                onValueChange={(v) => setForm({ ...form, emCampanhaShopee: v === 'sim' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não</SelectItem>
                  <SelectItem value="sim">Sim</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Adicional campanha (%)</Label>
              <InputDecimal
                value={form.adicionalCampanhaPct}
                onChange={(s) => setForm({ ...form, adicionalCampanhaPct: s })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Comissão ML categoria (%)</Label>
            <InputDecimal
              value={form.comissaoMlPct}
              onChange={(s) => setForm({ ...form, comissaoMlPct: s })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Imposto ativo</Label>
              <Select
                value={form.impostoAtivo ? 'sim' : 'nao'}
                onValueChange={(v) => setForm({ ...form, impostoAtivo: v === 'sim' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não</SelectItem>
                  <SelectItem value="sim">Sim</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Imposto (%)</Label>
              <InputDecimal
                value={form.impostoPct}
                onChange={(s) => setForm({ ...form, impostoPct: s })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label>Margem verde (%)</Label>
              <InputDecimal
                value={form.margemThresholdVerdePct}
                onChange={(s) => setForm({ ...form, margemThresholdVerdePct: s })}
                decimals={0}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Margem amarela (%)</Label>
              <InputDecimal
                value={form.margemThresholdAmareloPct}
                onChange={(s) => setForm({ ...form, margemThresholdAmareloPct: s })}
                decimals={0}
              />
            </div>
          </div>

          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
