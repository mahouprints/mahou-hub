'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { Produto } from '@mahou-hub/contracts';
import { apiFetch } from '../../../lib/api-client';
import { centavosParaReais } from '../../../lib/format';

type ProdutoComFilamento = Produto & { filamento: { nome: string } };

export default function ProdutosPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['produtos'],
    queryFn: () => apiFetch<ProdutoComFilamento[]>('/produtos'),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Produtos</h1>
          <p className="text-sm text-mahou-mute">{data?.length ?? 0} itens cadastrados</p>
        </div>
        <Link
          href="/produtos/novo"
          className="rounded-md bg-mahou-accent px-4 py-2 text-sm text-white"
        >
          Novo produto
        </Link>
      </header>

      {isLoading && <p className="text-sm text-mahou-mute">Carregando…</p>}
      {error && <p className="text-sm text-red-600">{(error as Error).message}</p>}

      {data && (
        <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-mahou-line text-left text-mahou-mute">
              <tr>
                <Th>Nome</Th>
                <Th>Filamento</Th>
                <Th>Peso</Th>
                <Th>Tempo</Th>
                <Th>Preço</Th>
                <Th>Canal</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.id} className="border-b border-mahou-line/50 last:border-0">
                  <Td>{p.nome}</Td>
                  <Td>{p.filamento.nome}</Td>
                  <Td>{Number(p.pesoG).toFixed(0)}g</Td>
                  <Td>{Number(p.tempoH).toFixed(1)}h</Td>
                  <Td>{centavosParaReais(p.precoCentavos)}</Td>
                  <Td>{p.canalPrincipal}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}
