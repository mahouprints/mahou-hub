'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Box,
  Calendar,
  ExternalLink,
  Factory,
  Pencil,
  Receipt,
  ShoppingBag,
  Star,
} from 'lucide-react';
import type {
  CalcularOutput,
  EstatisticasProduto,
  Parametro,
  Produto,
} from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, isUrl, pct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

type ProdutoComFilamento = Produto & {
  filamento: { id: string; nome: string };
  insumos: Array<{
    id: string;
    insumoId: string;
    qtd: number | string;
    insumo: { id: string; nome: string; unidade: string; custoUnitarioCentavos: number };
  }>;
};
type Canal = 'SHOPEE' | 'ML' | 'SITE';
const CANAL_LABEL: Record<Canal, string> = {
  SHOPEE: 'Shopee',
  ML: 'Mercado Livre',
  SITE: 'Site próprio',
};

export default function ProdutoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const { data: produto, isLoading } = useQuery({
    queryKey: ['produto', id],
    queryFn: () => apiFetch<ProdutoComFilamento>(`/produtos/${id}`),
  });

  const custoInsumosCentavos =
    produto?.insumos.reduce(
      (acc, pi) => acc + Math.round(Number(pi.qtd) * pi.insumo.custoUnitarioCentavos),
      0,
    ) ?? 0;

  const { data: pricing } = useQuery({
    queryKey: ['produto-pricing', id, custoInsumosCentavos],
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
          custoInsumosCentavos,
          precoCentavos: produto!.precoCentavos,
        },
      }),
  });

  const { data: parametros } = useQuery({
    queryKey: ['parametros'],
    queryFn: () => apiFetch<Parametro>('/parametros'),
  });

  const { data: stats } = useQuery({
    queryKey: ['produto-estatisticas', id],
    queryFn: () => apiFetch<EstatisticasProduto>(`/produtos/${id}/estatisticas`),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!produto) return <p className="text-sm text-muted-foreground">Produto não encontrado.</p>;

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
            <Badge variant="default">{CANAL_LABEL[produto.canalPrincipal]}</Badge>
          </div>
        </div>
        <Button asChild>
          <Link href={`/produtos/${id}/editar`}>
            <Pencil className="h-4 w-4" /> Editar
          </Link>
        </Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <EspecificacoesCard produto={produto} />
        <EstatisticasCard stats={stats} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Custo unitário e comparação entre canais</CardDescription>
        </CardHeader>
        <CardContent>
          {pricing ? (
            <PricingBreakdown
              pricing={pricing}
              canal={produto.canalPrincipal}
              precoCentavos={produto.precoCentavos}
              embalagemCentavos={produto.embalagemCentavos}
              insumos={produto.insumos}
              thresholdVerde={Number(parametros?.margemThresholdVerde ?? 0.3)}
              thresholdAmarelo={Number(parametros?.margemThresholdAmarelo ?? 0.15)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Calculando…</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function EspecificacoesCard({ produto }: { produto: ProdutoComFilamento }) {
  return (
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
          <Linha rotulo="Canal principal" valor={CANAL_LABEL[produto.canalPrincipal]} />
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
  );
}

function EstatisticasCard({ stats }: { stats: EstatisticasProduto | undefined }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico</CardTitle>
        <CardDescription>Vendas e produção deste produto</CardDescription>
      </CardHeader>
      <CardContent>
        {!stats ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <StatBox
                icon={ShoppingBag}
                rotulo="Vendidos"
                valor={String(stats.vendidos)}
                sub={`em ${stats.qtdVendas} ${stats.qtdVendas === 1 ? 'venda' : 'vendas'}`}
              />
              <StatBox
                icon={Receipt}
                rotulo="Faturamento"
                valor={centavosParaReais(stats.faturamentoCentavos)}
                sub="acumulado"
              />
              <StatBox
                icon={Factory}
                rotulo="Produzidos"
                valor={String(stats.produzidos)}
                sub="concluídos/embalados/enviados"
              />
              <StatBox
                icon={Factory}
                rotulo="Em produção"
                valor={String(stats.emProducao)}
                sub="fila + imprimindo"
              />
            </div>
            <div className="flex items-center gap-2 border-t border-border pt-3 text-sm">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Última venda:</span>
              <span className="font-medium">
                {stats.ultimaVendaEm
                  ? new Date(stats.ultimaVendaEm).toLocaleDateString('pt-BR')
                  : '—'}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({
  icon: Icon,
  rotulo,
  valor,
  sub,
}: {
  icon: typeof ShoppingBag;
  rotulo: string;
  valor: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card/50 p-3">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {rotulo}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{valor}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function PricingBreakdown({
  pricing,
  canal,
  precoCentavos,
  embalagemCentavos,
  insumos,
  thresholdVerde,
  thresholdAmarelo,
}: {
  pricing: CalcularOutput;
  canal: Canal;
  precoCentavos: number;
  embalagemCentavos: number;
  insumos: ProdutoComFilamento['insumos'];
  thresholdVerde: number;
  thresholdAmarelo: number;
}) {
  const margemPrincipal =
    canal === 'SHOPEE'
      ? pricing.margemShopee
      : canal === 'ML'
        ? pricing.margemMl
        : pricing.margemSite;
  const veredito = vereditoDe(margemPrincipal, thresholdVerde, thresholdAmarelo);
  const insumosTotalCentavos = insumos.reduce(
    (acc, pi) => acc + Math.round(Number(pi.qtd) * pi.insumo.custoUnitarioCentavos),
    0,
  );

  const canais: CanalInfo[] = [
    {
      key: 'SHOPEE',
      liquidoCentavos: pricing.liquidoShopeeCentavos,
      margem: pricing.margemShopee,
      lucroHCentavos: pricing.lucroPorHoraShopeeCentavos,
      taxaCentavos: pricing.taxaShopeeCentavos,
    },
    {
      key: 'ML',
      liquidoCentavos: pricing.liquidoMlCentavos,
      margem: pricing.margemMl,
      lucroHCentavos: pricing.lucroPorHoraMlCentavos,
      taxaCentavos: pricing.taxaMlCentavos,
    },
    {
      key: 'SITE',
      liquidoCentavos: pricing.liquidoSiteCentavos,
      margem: pricing.margemSite,
      lucroHCentavos: null, // pricing não expõe lucro/h pro site (sem taxa)
      taxaCentavos: 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant={veredito.variant} className="text-sm">
          {veredito.label}
        </Badge>
        <p className="text-sm text-muted-foreground">
          Margem do canal principal ({CANAL_LABEL[canal]}):{' '}
          <span className="font-semibold text-foreground">{pct(margemPrincipal)}</span>
        </p>
      </div>

      {/* Custos: bloco único, fácil de bater de olho. */}
      <section>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Custos por unidade
        </h3>
        <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Item rotulo="Filamento" valor={centavosParaReais(pricing.custoFilamentoCentavos)} />
          <Item rotulo="Energia" valor={centavosParaReais(pricing.custoEnergiaCentavos)} />
          <Item rotulo="Embalagem" valor={centavosParaReais(embalagemCentavos)} />
          <Item rotulo="Insumos" valor={centavosParaReais(insumosTotalCentavos)} />
          <Item rotulo="Imposto" valor={centavosParaReais(pricing.impostoCentavos)} />
          <Item
            rotulo="Custo total"
            valor={centavosParaReais(pricing.custoTotalProducaoCentavos)}
            destaque
          />
        </div>
      </section>

      {/* Detalhamento dos insumos consumidos — só aparece se houver. */}
      {insumos.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Detalhamento dos insumos
          </h3>
          <div className="rounded-md border border-border">
            {insumos.map((pi, idx) => {
              const linhaTotal = Math.round(Number(pi.qtd) * pi.insumo.custoUnitarioCentavos);
              return (
                <div
                  key={pi.id}
                  className={cn(
                    'grid grid-cols-[1fr_auto_auto] items-center gap-4 px-3 py-2 text-sm',
                    idx > 0 && 'border-t border-border',
                  )}
                >
                  <span className="font-medium">{pi.insumo.nome}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {Number(pi.qtd).toString().replace('.', ',')} {pi.insumo.unidade} ×{' '}
                    {centavosParaReais(pi.insumo.custoUnitarioCentavos)}
                  </span>
                  <span className="font-medium tabular-nums">{centavosParaReais(linhaTotal)}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Comparação visual entre canais. Principal recebe destaque. */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Por canal
          </h3>
          <span className="text-xs text-muted-foreground">
            Preço de venda: {centavosParaReais(precoCentavos)}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {canais.map((c) => (
            <CanalCard
              key={c.key}
              info={c}
              principal={c.key === canal}
              thresholdVerde={thresholdVerde}
              thresholdAmarelo={thresholdAmarelo}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

interface CanalInfo {
  key: Canal;
  liquidoCentavos: number;
  margem: number;
  lucroHCentavos: number | null;
  taxaCentavos: number;
}

function CanalCard({
  info,
  principal,
  thresholdVerde,
  thresholdAmarelo,
}: {
  info: CanalInfo;
  principal: boolean;
  thresholdVerde: number;
  thresholdAmarelo: number;
}) {
  const v = vereditoDe(info.margem, thresholdVerde, thresholdAmarelo);
  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        principal ? 'border-primary/60 bg-primary/5' : 'border-border bg-card/50',
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className={cn('text-sm font-medium', principal && 'text-primary-foreground')}>
          {CANAL_LABEL[info.key]}
        </span>
        {principal && (
          <span className="inline-flex items-center gap-1 text-xs text-primary-foreground">
            <Star className="h-3 w-3 fill-current" /> principal
          </span>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Líquido</div>
          <div className="text-xl font-semibold tabular-nums">
            {centavosParaReais(info.liquidoCentavos)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Margem</div>
            <Badge variant={v.variant} className="font-normal">
              {pct(info.margem)}
            </Badge>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Lucro/h</div>
            <div className="tabular-nums">
              {info.lucroHCentavos != null ? centavosParaReais(info.lucroHCentavos) : '—'}
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-2 text-xs text-muted-foreground">
          Taxa do canal:{' '}
          <span className="tabular-nums text-foreground">
            {info.taxaCentavos > 0 ? centavosParaReais(info.taxaCentavos) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

function vereditoDe(
  margem: number,
  verde: number,
  amarelo: number,
): { variant: 'success' | 'warning' | 'danger'; label: string } {
  if (margem >= verde) return { variant: 'success', label: 'Vale a pena' };
  if (margem >= amarelo) return { variant: 'warning', label: 'Atenção' };
  return { variant: 'danger', label: 'Não compensa' };
}

function formatarDimensoes(p: {
  larguraCm: number | null;
  alturaCm: number | null;
  profundidadeCm: number | null;
}): string {
  const dims = [p.larguraCm, p.profundidadeCm, p.alturaCm];
  if (!dims.every((d) => d != null)) return '—';
  // Apresentação L × P × A (altura por último) pra bater com a ordem do form.
  return `${formatarCm(p.larguraCm!)} × ${formatarCm(p.profundidadeCm!)} × ${formatarCm(p.alturaCm!)} cm`;
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

function Item({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3',
        destaque && 'border-t border-border pt-2 font-semibold',
      )}
    >
      <span className={destaque ? 'text-foreground' : 'text-muted-foreground'}>{rotulo}</span>
      <span className="tabular-nums">{valor}</span>
    </div>
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
