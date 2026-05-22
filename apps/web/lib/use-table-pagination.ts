'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Estado de paginação clicável de tabela. Volta pra página 1 sempre que `resetKey` muda
 * — passa filtros/search nesse campo pra resetar quando o universo de dados mudar.
 *
 * Use `paginar(items)` pra recortar arrays client-side, ou leia `page`/`pageSize`
 * direto pra mandar pra API quando a paginação é server-side.
 *
 * @example
 * const pag = useTablePagination({ resetKey: filtros });
 * const visivel = pag.paginar(items);
 * <Pagination page={pag.page} pageSize={pag.pageSize} total={items.length} onPageChange={pag.setPage} />
 */
export function useTablePagination(opts?: { pageSize?: number; resetKey?: unknown }) {
  const pageSize = opts?.pageSize ?? 50;
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [opts?.resetKey]);

  const paginar = useCallback(
    <T>(items: T[]): T[] => items.slice((page - 1) * pageSize, page * pageSize),
    [page, pageSize],
  );

  return useMemo(() => ({ page, pageSize, setPage, paginar }), [page, pageSize, paginar]);
}

export type UseTablePagination = ReturnType<typeof useTablePagination>;
