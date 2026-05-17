'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProdutoForm } from '@/components/produto-form';

export default function ProdutoNovoPage() {
  return (
    <Suspense>
      <ProdutoNovoContent />
    </Suspense>
  );
}

function ProdutoNovoContent() {
  const searchParams = useSearchParams();

  const inicial = {
    filamentoId: searchParams.get('filamentoId') ?? '',
    pesoG: searchParams.get('pesoG') ?? '',
    tempoH: searchParams.get('tempoH') ?? '',
    impressora: (searchParams.get('impressora') as 'A1' | 'H2C') ?? 'A1',
    embalagemReais: searchParams.get('embalagemCentavos')
      ? (Number(searchParams.get('embalagemCentavos')) / 100).toFixed(2).replace('.', ',')
      : '',
    precoReais: searchParams.get('precoCentavos')
      ? (Number(searchParams.get('precoCentavos')) / 100).toFixed(2).replace('.', ',')
      : '',
    canalPrincipal: (searchParams.get('canalPrincipal') as 'SHOPEE' | 'ML' | 'SITE') ?? 'SHOPEE',
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Novo produto</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os dados e veja o cálculo ao vivo no painel à direita.
        </p>
      </header>
      <ProdutoForm inicial={inicial} />
    </div>
  );
}
