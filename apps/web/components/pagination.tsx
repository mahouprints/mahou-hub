'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

/// Footer de paginação alinhado com `useTablePagination`. Some quando `total <= pageSize`
/// (tudo cabe numa página) — evita poluição visual em tabelas pequenas.
export function Pagination({ page, pageSize, total, onPageChange }: Props) {
  if (total <= pageSize) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const inicio = (page - 1) * pageSize + 1;
  const fim = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-sm">
      <div className="text-muted-foreground">
        Mostrando <span className="font-medium text-foreground">{inicio}</span>–
        <span className="font-medium text-foreground">{fim}</span> de{' '}
        <span className="font-medium text-foreground">{total.toLocaleString('pt-BR')}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-3 w-3" />
          Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Página <span className="font-medium text-foreground">{page}</span> de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Próxima
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
