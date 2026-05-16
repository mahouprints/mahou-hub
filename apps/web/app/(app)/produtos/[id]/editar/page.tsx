'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Produto } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { ProdutoForm } from '@/components/produto-form';

export default function ProdutoEditarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: ['produto', id],
    queryFn: () => apiFetch<Produto>(`/produtos/${id}`),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Editar produto</h1>
        <p className="text-sm text-muted-foreground">{data?.nome ?? '…'}</p>
      </header>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
      {data && <ProdutoForm produto={data} />}
    </div>
  );
}
