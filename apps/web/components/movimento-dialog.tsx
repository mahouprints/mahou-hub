'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { MovimentoCreate, MotivoMovimento, TipoItemEstoque } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { parseDecimalBr } from '@/lib/parsing';
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

type Direcao = 'entrada' | 'saida';

const MOTIVOS_ENTRADA: { value: MotivoMovimento; label: string }[] = [
  { value: 'COMPRA', label: 'Compra' },
  { value: 'ESTOQUE_INICIAL', label: 'Estoque inicial' },
  { value: 'PRODUCAO', label: 'Produção (entrou pronto)' },
  { value: 'AJUSTE', label: 'Ajuste (acerto de inventário)' },
];
const MOTIVOS_SAIDA: { value: MotivoMovimento; label: string }[] = [
  { value: 'VENDA', label: 'Venda' },
  { value: 'PRODUCAO', label: 'Produção (consumo)' },
  { value: 'PERDA', label: 'Perda / refugo' },
  { value: 'AJUSTE', label: 'Ajuste (acerto de inventário)' },
];

interface Props {
  tipoItem: TipoItemEstoque;
  itemId: string;
  itemNome: string;
  unidade: string;
  saldoAtual: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Query keys a invalidar quando o saldo muda. */
  invalidar: unknown[][];
}

export function MovimentoDialog({
  tipoItem,
  itemId,
  itemNome,
  unidade,
  saldoAtual,
  open,
  onOpenChange,
  invalidar,
}: Props) {
  const qc = useQueryClient();
  const [direcao, setDirecao] = useState<Direcao>('entrada');
  const [quantidade, setQuantidade] = useState('');
  const [motivo, setMotivo] = useState<MotivoMovimento>('COMPRA');
  const [observacao, setObservacao] = useState('');

  const motivos = direcao === 'entrada' ? MOTIVOS_ENTRADA : MOTIVOS_SAIDA;

  function resetar() {
    setDirecao('entrada');
    setQuantidade('');
    setMotivo('COMPRA');
    setObservacao('');
  }

  const registrar = useMutation({
    mutationFn: (data: MovimentoCreate) =>
      apiFetch('/estoque/movimentos', { method: 'POST', json: data }),
    onSuccess: () => {
      invalidar.forEach((queryKey) => qc.invalidateQueries({ queryKey }));
      toast.success('Estoque atualizado');
      resetar();
      onOpenChange(false);
    },
  });

  const qtdNum = parseDecimalBr(quantidade);
  const novoSaldo = Number.isFinite(qtdNum)
    ? saldoAtual + (direcao === 'entrada' ? qtdNum : -qtdNum)
    : null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(qtdNum) || qtdNum <= 0) {
      toast.error('Informe uma quantidade maior que zero');
      return;
    }
    if (tipoItem === 'PRODUTO' && !Number.isInteger(qtdNum)) {
      toast.error('Produto pronto é contado em unidades inteiras');
      return;
    }
    if (direcao === 'saida' && saldoAtual - qtdNum < 0) {
      toast.error(`Saldo insuficiente: você tem ${saldoAtual} ${unidade}`);
      return;
    }
    registrar.mutate({
      tipoItem,
      quantidade: direcao === 'entrada' ? qtdNum : -qtdNum,
      motivo,
      observacao: observacao.trim() || null,
      ...(tipoItem === 'PRODUTO' ? { variacaoId: itemId } : {}),
      ...(tipoItem === 'FILAMENTO' ? { filamentoId: itemId } : {}),
      ...(tipoItem === 'INSUMO' ? { insumoId: itemId } : {}),
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) resetar();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Movimentar estoque</DialogTitle>
          <DialogDescription>
            {itemNome} · saldo atual{' '}
            <strong>
              {saldoAtual} {unidade}
            </strong>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={direcao === 'entrada' ? 'default' : 'outline'}
              onClick={() => {
                setDirecao('entrada');
                setMotivo('COMPRA');
              }}
            >
              Entrada (+)
            </Button>
            <Button
              type="button"
              variant={direcao === 'saida' ? 'default' : 'outline'}
              onClick={() => {
                setDirecao('saida');
                setMotivo('AJUSTE');
              }}
            >
              Baixa (−)
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="qtd">Quantidade ({unidade})</Label>
              <Input
                id="qtd"
                inputMode="decimal"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="ex: 1000"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select value={motivo} onValueChange={(v) => setMotivo(v as MotivoMovimento)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {motivos.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
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
              placeholder="opcional (ex: nota da compra, lote)"
            />
          </div>

          {novoSaldo !== null && (
            <p className="text-sm text-muted-foreground">
              Novo saldo:{' '}
              <strong className={novoSaldo < 0 ? 'text-destructive' : 'text-foreground'}>
                {novoSaldo} {unidade}
              </strong>
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={registrar.isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={registrar.isPending}>
              {registrar.isPending ? 'Salvando…' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
