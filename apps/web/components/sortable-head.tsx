'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TableHead } from '@/components/ui/table';
import type { DirecaoSort } from '@/lib/use-table-sort';

interface Props<K extends string> {
  chave: K;
  estado: { chave: K; direcao: DirecaoSort } | null;
  onClick: (chave: K) => void;
  children: React.ReactNode;
  /** Alinha à direita (números). Default: esquerda. */
  align?: 'left' | 'right';
  className?: string;
}

/**
 * TableHead clicável que dispara ordenação no hook `useTableSort`.
 * Mostra ícone idle (ArrowUpDown), ascendente ou descendente conforme estado.
 */
export function SortableHead<K extends string>({
  chave,
  estado,
  onClick,
  children,
  align = 'left',
  className,
}: Props<K>) {
  const ativo = estado?.chave === chave;
  const Icon = !ativo ? ArrowUpDown : estado.direcao === 'asc' ? ArrowUp : ArrowDown;

  return (
    <TableHead className={className}>
      <button
        type="button"
        onClick={() => onClick(chave)}
        className={cn(
          'inline-flex items-center gap-1.5 select-none transition-colors',
          align === 'right' && 'flex-row-reverse',
          ativo ? 'text-foreground' : 'hover:text-foreground',
        )}
      >
        {children}
        <Icon
          className={cn(
            'h-3 w-3 transition-opacity',
            ativo ? 'opacity-100' : 'opacity-40',
          )}
        />
      </button>
    </TableHead>
  );
}
