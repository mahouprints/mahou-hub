'use client';

import { useCallback, useMemo, useState } from 'react';

export type DirecaoSort = 'asc' | 'desc';
type Comparavel = string | number | Date | null | undefined;

/**
 * Ordenação clicável de tabela. Ciclo: idle → asc → desc → idle.
 * Acessores devolvem valor comparável; null/undefined vão pro fim independente
 * da direção (evita "vencedor de empate" virar lixo no topo quando desc).
 *
 * @example
 * const sort = useTableSort<Produto, 'nome' | 'preco'>({
 *   nome: (p) => p.nome,
 *   preco: (p) => p.precoCentavos,
 * });
 * const visivel = sort.ordenar(produtos);
 * <SortableHead chave="nome" sort={sort}>Nome</SortableHead>
 */
export function useTableSort<T, K extends string>(
  acessores: Record<K, (item: T) => Comparavel>,
  inicial?: { chave: K; direcao: DirecaoSort },
) {
  const [estado, setEstado] = useState<{ chave: K; direcao: DirecaoSort } | null>(
    inicial ?? null,
  );

  const ordenar = useCallback(
    (items: T[]): T[] => {
      if (!estado) return items;
      const acessor = acessores[estado.chave];
      const sinal = estado.direcao === 'asc' ? 1 : -1;
      return [...items].sort((a, b) => sinal * comparar(acessor(a), acessor(b)));
    },
    [estado, acessores],
  );

  const alternar = useCallback((chave: K) => {
    setEstado((prev) => {
      if (prev?.chave !== chave) return { chave, direcao: 'asc' };
      if (prev.direcao === 'asc') return { chave, direcao: 'desc' };
      return null;
    });
  }, []);

  return useMemo(() => ({ estado, ordenar, alternar }), [estado, ordenar, alternar]);
}

function comparar(a: Comparavel, b: Comparavel): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
}

export type UseTableSort<K extends string> = ReturnType<typeof useTableSort<unknown, K>>;
