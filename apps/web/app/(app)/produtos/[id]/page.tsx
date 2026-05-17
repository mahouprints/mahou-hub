'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Box, ExternalLink, Pencil } from 'lucide-react';
import type { CalcularOutput, Parametro, Produto } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, isUrl, pct } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type ProdutoComFilamento = Produto & { filamento: { id: string; nome: string } };

export default function ProdutoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: produto, isLoading } = useQuery({
    queryKey: ['produto', id],
    queryFn: () => apiFetch<ProdutoComFilamento>(`/produtos/${id}`),
  });

  const { data: pricing } = useQuery({
    queryKey: ['produto-pricing', id],
    enabled: !!produto,
    queryFn: () =>
      apiFetch<CalcularOutput>('/pricing/calcular', {
        method: 'POST',
        json: {
          filamentoId: produto!.filamentoId,
          pesoG: Number(produto!.pesoG),
          tempoH: Number(produto!.tempoH),
          impressora: produto!.impressora,
          embalagemCentavos: produto!.embalagemCentavos,
          precoCentavos: produto!.precoCentavos,
        },
      }),
  });

  const { data: parametros } = useQuery({
    queryKey: ['parametros'],
    queryFn: () => apiFetch<Parametro>('/parametros'),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!produto) return <p className="text-sm text-muted-foreground">Produto não encontrado.</p>;

  const canalLabel = { SHOPEE: 'Shopee', ML: 'Mercado Livre', SITE: 'Site próprio' }[
    produto.canalPrincipal
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 px-2 text-muted-foreground">
            <Link href="/produtos">
              <ArrowLeft className="h-4 w-4" /> Produtos
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{produto.nome}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">{produto.filamento.nome}</Badge>
            <Badge variant="default">{produto.impressora}</Badge>
            <Badge variant="default">{canalLabel}</Badge>
          </div>
        </div>
        <Button asChild>
          <Link href={`/produtos/${id}/editar`}>
            <Pencil className="h-4 w-4" /> Editar
          </Link>
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Especificações</CardTitle>
            <CardDescription>Dados cadastrados</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
              <Linha rotulo="Filamento" valor={produto.filamento.nome} />
              <Linha rotulo="Impressora" valor={produto.impressora} />
              <Linha rotulo="Peso" valor={`${Number(produto.pesoG)} g`} />
              <Linha rotulo="Tempo" valor={`${Number(produto.tempoH)} h`} />
              <Linha rotulo="Dimensões" valor={formatarDimensoes(produto)} />
              <Linha rotulo="Embalagem" valor={centavosParaReais(produto.embalagemCentavos)} />
              <Linha rotulo="Preço de venda" valor={centavosParaReais(produto.precoCentavos)} />
              <Linha rotulo="Canal principal" valor={canalLabel} />
              <Linha
                rotulo="Inspiração"
                valor={
                  isUrl(produto.inspiracao) ? (
                    <LinkExterno href={produto.inspiracao!} icon={ExternalLink} />
                  ) : (
                    produto.inspiracao || '—'
                  )
                }
              />
              <Linha
                rotulo="Modelo 3D"
                valor={
                  isUrl(produto.modelo3dUrl) ? (
                    <LinkExterno href={produto.modelo3dUrl!} icon={Box} />
                  ) : (
                    produto.modelo3dUrl || '—'
                  )
                }
              />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>Custo, taxas e margem calculados</CardDescription>
          </CardHeader>
          <CardContent>
            {pricing ? (
              <PricingBreakdown
                pricing={pricing}
                canal={produto.canalPrincipal}
                thresholdVerde={Number(parametros?.margemThresholdVerde ?? 0.3)}
                thresholdAmarelo={Number(parametros?.margemThresholdAmarelo ?? 0.15)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Calculando…</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * Mostra "L × A × P cm" se TODAS as 3 dimensões existem, senão um traço.
 * Optei por exigir as 3 — uma só fica estranho. Pra mostrar parcial,
 * mude o `every` por `some` e ajuste a formatação.
 */
function formatarDimensoes(p: { larguraCm: number | null; alturaCm: number | null; profundidadeCm: number | null }): string {
  const dims = [p.larguraCm, p.alturaCm, p.profundidadeCm];
  if (!dims.every((d) => d != null)) return '—';
  return `${formatarCm(p.larguraCm!)} × ${formatarCm(p.alturaCm!)} × ${formatarCm(p.profundidadeCm!)} cm`;
}

function formatarCm(n: number): string {
  return Number(n).toString().replace('.', ',');
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="text-foreground">{valor}</dd>
    </>
  );
}

function LinkExterno({ href, icon: Icon }: { href: string; icon: typeof ExternalLink }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-foreground underline-offset-2 hover:underline"
    >
      <Icon className="h-3.5 w-3.5" />
      Abrir
    </a>
  );
}

function PricingBreakdown({
  pricing,
  canal,
  thresholdVerde,
  thresholdAmarelo,
}: {
  pricing: CalcularOutput;
  canal: 'SHOPEE' | 'ML' | 'SITE';
  thresholdVerde: number;
  thresholdAmarelo: number;
}) {
  const margemPrincipal =
    canal === 'SHOPEE'
      ? pricing.margemShopee
      : canal === 'ML'
        ? pricing.margemMl
        : pricing.margemSite;
  const variant: 'success' | 'warning' | 'danger' =
    margemPrincipal >= thresholdVerde
      ? 'success'
      : margemPrincipal >= thresholdAmarelo
        ? 'warning'
        : 'danger';
  const label =
    margemPrincipal >= thresholdVerde
      ? 'Vale a pena'
      : margemPrincipal >= thresholdAmarelo
        ? 'Atenção'
        : 'Não compensa';

  return (
    <div className="space-y-4">
      <Badge variant={variant} className="text-sm">
        {label}
      </Badge>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <Linha rotulo="Custo filamento" valor={centavosParaReais(pricing.custoFilamentoCentavos)} />
        <Linha rotulo="Custo energia" valor={centavosParaReais(pricing.custoEnergiaCentavos)} />
        <Linha
          rotulo="Custo produção"
          valor={centavosParaReais(pricing.custoTotalProducaoCentavos)}
        />
        <Linha rotulo="Imposto" valor={centavosParaReais(pricing.impostoCentavos)} />
        <Linha rotulo="Taxa Shopee" valor={centavosParaReais(pricing.taxaShopeeCentavos)} />
        <Linha rotulo="Taxa Mercado Livre" valor={centavosParaReais(pricing.taxaMlCentavos)} />
        <Linha
          rotulo="Líquido Shopee"
          valor={
            <Destacado destacar={canal === 'SHOPEE'}>
              {centavosParaReais(pricing.liquidoShopeeCentavos)}
            </Destacado>
          }
        />
        <Linha
          rotulo="Líquido Mercado Livre"
          valor={
            <Destacado destacar={canal === 'ML'}>
              {centavosParaReais(pricing.liquidoMlCentavos)}
            </Destacado>
          }
        />
        <Linha
          rotulo="Líquido Site"
          valor={
            <Destacado destacar={canal === 'SITE'}>
              {centavosParaReais(pricing.liquidoSiteCentavos)}
            </Destacado>
          }
        />
        <Linha rotulo="Margem Shopee" valor={pct(pricing.margemShopee)} />
        <Linha rotulo="Margem ML" valor={pct(pricing.margemMl)} />
        <Linha
          rotulo="Lucro/h Shopee"
          valor={centavosParaReais(pricing.lucroPorHoraShopeeCentavos)}
        />
        <Linha rotulo="Lucro/h ML" valor={centavosParaReais(pricing.lucroPorHoraMlCentavos)} />
      </dl>
    </div>
  );
}

function Destacado({ destacar, children }: { destacar: boolean; children: React.ReactNode }) {
  return <span className={destacar ? 'font-semibold text-foreground' : ''}>{children}</span>;
}
