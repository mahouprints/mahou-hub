'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * Gerencia seleção de N itens em uma tabela. Use o `selecionados` (Set) pra
 * checkar se uma linha está marcada, e `acoes` pra disparar mudanças.
 *
 * @example
 * const { selecionados, acoes, count } = useTableSelection(produtos.map(p => p.id));
 * <Checkbox checked={selecionados.has(p.id)} onCheckedChange={() => acoes.toggle(p.id)} />
 */
export function useTableSelection(idsVisiveis: string[]) {
  const [set, setSet] = useState<Set<string>>(new Set());

  const acoes = useMemo(
    () => ({
      toggle(id: string) {
        setSet((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      },
      toggleTodos() {
        setSet((prev) => {
          const todosSelecionados = idsVisiveis.length > 0 && idsVisiveis.every((id) => prev.has(id));
          if (todosSelecionados) {
            // Limpa só os visíveis — preserva seleções de outras páginas/filtros.
            const next = new Set(prev);
            idsVisiveis.forEach((id) => next.delete(id));
            return next;
          }
          const next = new Set(prev);
          idsVisiveis.forEach((id) => next.add(id));
          return next;
        });
      },
      limpar() {
        setSet(new Set());
      },
      definir(ids: string[]) {
        setSet(new Set(ids));
      },
    }),
    [idsVisiveis],
  );

  const todosVisiveisMarcados = useCallback(
    () => idsVisiveis.length > 0 && idsVisiveis.every((id) => set.has(id)),
    [idsVisiveis, set],
  )();

  const algumVisivelMarcado = useCallback(
    () => idsVisiveis.some((id) => set.has(id)),
    [idsVisiveis, set],
  )();

  return {
    selecionados: set,
    count: set.size,
    todosVisiveisMarcados,
    algumVisivelMarcado,
    acoes,
  };
}
