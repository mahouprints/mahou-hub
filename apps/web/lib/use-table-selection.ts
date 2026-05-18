'use client';

import { useCallback, useMemo, useState } from 'react';

/**
 * Gerencia seleção de N itens em uma tabela + modo de seleção (esconde/mostra
 * a coluna de checkboxes). Padrão: modo desligado — usuário clica "Selecionar"
 * pra ativar; sair limpa toda a seleção.
 *
 * @example
 * const sel = useTableSelection(produtos.map(p => p.id));
 * {sel.modoSelecao && <Checkbox checked={sel.selecionados.has(p.id)} ... />}
 */
export function useTableSelection(idsVisiveis: string[]) {
  const [set, setSet] = useState<Set<string>>(new Set());
  const [modoSelecao, setModoSelecao] = useState(false);

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
      entrarModo() {
        setModoSelecao(true);
      },
      sairModo() {
        // Sair do modo descarta a seleção — evita estado fantasma quando reabrir.
        setSet(new Set());
        setModoSelecao(false);
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
    modoSelecao,
    todosVisiveisMarcados,
    algumVisivelMarcado,
    acoes,
  };
}
