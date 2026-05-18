'use client';

import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
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

interface Props {
  count: number;
  /** Texto descritivo no diálogo, ex: "produto(s)", "venda(s)". */
  itemLabel: string;
  onExcluir: () => Promise<unknown> | void;
  onLimpar: () => void;
  excluindo?: boolean;
}

/**
 * Aparece quando há itens selecionados na tabela. Mostra contagem +
 * botão de excluir em massa (com confirmação) + botão de limpar seleção.
 */
export function SelectionToolbar({ count, itemLabel, onExcluir, onLimpar, excluindo }: Props) {
  const [confirmando, setConfirmando] = useState(false);
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onLimpar}
          title="Limpar seleção"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <span>
          <strong className="tabular-nums">{count}</strong> {itemLabel}{' '}
          {count === 1 ? 'selecionado' : 'selecionados'}
        </span>
      </div>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => setConfirmando(true)}
        disabled={excluindo}
      >
        <Trash2 className="h-4 w-4" />
        Excluir selecionados
      </Button>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir {count} {count === 1 ? itemLabel : itemLabel + 's'}?</DialogTitle>
            <DialogDescription>
              Esta ação removerá os itens selecionados. {itemLabel === 'produto'
                ? 'Produtos ficam inativos (referenciados em vendas antigas continuam preservados).'
                : 'Itens deletados não podem ser recuperados pela UI.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={excluindo}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={excluindo}
              onClick={async () => {
                await onExcluir();
                setConfirmando(false);
              }}
            >
              {excluindo ? 'Excluindo…' : `Excluir ${count}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
