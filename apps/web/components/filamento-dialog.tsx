'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Filamento } from '@mahou-hub/contracts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { parseDecimalParaCentavos } from '@/lib/parsing';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filamento?: Filamento | null;
}

interface FormState {
  nome: string;
  custoKgReais: string;
  potenciaA1W: string;
  potenciaH2cW: string;
  observacao: string;
}

const VAZIO: FormState = { nome: '', custoKgReais: '', potenciaA1W: '', potenciaH2cW: '', observacao: '' };

export function FilamentoDialog({ open, onOpenChange, filamento }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (filamento) {
      setForm({
        nome: filamento.nome,
        custoKgReais: (filamento.custoKgCentavos / 100).toFixed(2).replace('.', ','),
        potenciaA1W: String(filamento.potenciaA1W),
        potenciaH2cW: String(filamento.potenciaH2cW),
        observacao: filamento.observacao ?? '',
      });
    } else {
      setForm(VAZIO);
    }
    setErro(null);
  }, [open, filamento]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        custoKgCentavos: parseDecimalParaCentavos(form.custoKgReais),
        potenciaA1W: Number(form.potenciaA1W),
        potenciaH2cW: Number(form.potenciaH2cW),
        observacao: form.observacao.trim() || null,
      };
      if (filamento) {
        await apiFetch(`/filamentos/${filamento.id}`, { method: 'PATCH', json: payload });
      } else {
        await apiFetch('/filamentos', { method: 'POST', json: payload });
      }
      await qc.invalidateQueries({ queryKey: ['filamentos'] });
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
          <DialogTitle>{filamento ? 'Editar filamento' : 'Novo filamento'}</DialogTitle>
          <DialogDescription>Custo por kg e potência média por impressora.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fil-nome">Nome</Label>
            <Input
              id="fil-nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex.: PETG Preto"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fil-custo">Custo por kg (R$)</Label>
            <InputDecimal
              id="fil-custo"
              value={form.custoKgReais}
              onChange={(s) => setForm({ ...form, custoKgReais: s })}
              placeholder="70,00"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="fil-a1">Potência A1 (W)</Label>
              <Input
                id="fil-a1"
                type="number"
                value={form.potenciaA1W}
                onChange={(e) => setForm({ ...form, potenciaA1W: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fil-h2c">Potência H2C (W)</Label>
              <Input
                id="fil-h2c"
                type="number"
                value={form.potenciaH2cW}
                onChange={(e) => setForm({ ...form, potenciaH2cW: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fil-obs">Observação</Label>
            <Input
              id="fil-obs"
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          {erro && <p className="text-sm text-destructive">{erro}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : filamento ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
