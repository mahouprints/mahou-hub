'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, PackageOpen } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, tempoRelativo } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type ItemVitrine = {
  id: string;
  nome: string;
  precoCentavos: number;
  canalPrincipal: 'SHOPEE' | 'ML' | 'SITE' | 'TIKTOK';
  imagemUrl: string | null;
  estoqueProntos: number;
  abaixoDoMinimo: boolean;
  unidadesVendidas: number;
  receitaCentavos: number;
  ultimaVenda: string | null;
};

const ROTULO_CANAL: Record<ItemVitrine['canalPrincipal'], string> = {
  SHOPEE: 'Shopee',
  ML: 'Mercado Livre',
  SITE: 'Site',
  TIKTOK: 'TikTok Shop',
};

export default function Vitrine() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['vitrine'],
    queryFn: () => apiFetch<ItemVitrine[]>('/produtos/vitrine'),
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Carregando…</p>;
  if (error) return <p className="p-6 text-sm text-destructive">Não foi possível carregar.</p>;

  const itens = data ?? [];
  const receita = itens.reduce((s, i) => s + i.receitaCentavos, 0);
  const unidades = itens.reduce((s, i) => s + i.unidadesVendidas, 0);

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Vitrine</h1>
        <p className="text-sm text-muted-foreground">
          O que está anunciado hoje, com venda e estoque de prontos.
        </p>
      </div>

      {itens.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 p-10 text-center">
          <PackageOpen className="size-8 text-muted-foreground" />
          <p className="text-sm font-medium">A vitrine está vazia</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Produto entra aqui quando você abre um modelo em{' '}
            <Link href="/makerworld" className="underline">
              MakerWorld
            </Link>{' '}
            e marca como anunciado. O catálogo antigo continua no banco, fora da vitrine.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Resumo rotulo="Produtos na vitrine" valor={String(itens.length)} />
            <Resumo rotulo="Unidades vendidas" valor={String(unidades)} />
            <Resumo rotulo="Receita acumulada" valor={centavosParaReais(receita)} />
          </div>

          <div className="flex flex-col gap-2">
            {itens.map((item) => (
              <LinhaProduto key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Resumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="text-lg font-semibold tabular-nums">{valor}</p>
    </Card>
  );
}

function LinhaProduto({ item }: { item: ItemVitrine }) {
  return (
    <Card className="flex flex-wrap items-center gap-4 p-3">
      {item.imagemUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imagemUrl}
          alt={item.nome}
          className="size-16 shrink-0 rounded-md border object-cover"
        />
      ) : (
        <div className="flex size-16 shrink-0 items-center justify-center rounded-md border bg-muted">
          <PackageOpen className="size-5 text-muted-foreground" />
        </div>
      )}

      <div className="min-w-48 flex-1">
        <Link href={`/produtos/${item.id}`} className="text-sm font-medium hover:underline">
          {item.nome}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {ROTULO_CANAL[item.canalPrincipal]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {centavosParaReais(item.precoCentavos)}
          </span>
        </div>
      </div>

      <Numero
        rotulo="Estoque"
        valor={String(item.estoqueProntos)}
        alerta={item.abaixoDoMinimo}
      />
      <Numero rotulo="Vendidos" valor={String(item.unidadesVendidas)} />
      <Numero rotulo="Receita" valor={centavosParaReais(item.receitaCentavos)} />
      <Numero
        rotulo="Última venda"
        valor={item.ultimaVenda ? tempoRelativo(item.ultimaVenda) : '—'}
      />
    </Card>
  );
}

function Numero({
  rotulo,
  valor,
  alerta = false,
}: {
  rotulo: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div className="min-w-24">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p
        className={`flex items-center gap-1 text-sm font-medium tabular-nums ${
          alerta ? 'text-amber-600 dark:text-amber-500' : ''
        }`}
      >
        {alerta && <AlertTriangle className="size-3.5" />}
        {valor}
      </p>
    </div>
  );
}
