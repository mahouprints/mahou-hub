'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Boxes, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import type { ResumoFinanceiro } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, pct } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MonthPicker } from '@/components/ui/month-picker';

export default function FinanceiroPage() {
  const [mes, setMes] = useState(mesAtual());
  const { data, isLoading } = useQuery({
    queryKey: ['financeiro-resumo', mes],
    queryFn: () => apiFetch<ResumoFinanceiro>(`/financeiro/resumo?mes=${mes}`),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="text-sm text-muted-foreground">
            Faturamento, custos e lucro do mês selecionado.
          </p>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs uppercase text-muted-foreground">Mês competência</label>
          <MonthPicker value={mes} onChange={setMes} className="w-56" />
        </div>
      </header>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {data && <KpiGrid resumo={data} />}
      {data && <CanaisCard resumo={data} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <AcessoRapido
          href="/financeiro/vendas"
          titulo="Vendas"
          descricao="Lançar e revisar vendas do período"
        />
        <AcessoRapido
          href="/financeiro/custos"
          titulo="Custos gerais"
          descricao="Aluguel, internet, software e outros fixos"
        />
      </div>
    </div>
  );
}

function KpiGrid({ resumo }: { resumo: ResumoFinanceiro }) {
  const positivo = resumo.lucroLiquidoCentavos >= 0;
  const margemVariant: 'success' | 'warning' | 'danger' =
    resumo.margem >= 0.2 ? 'success' : resumo.margem >= 0.1 ? 'warning' : 'danger';

  // 4 cards: separamos "Custos gerais" (lançamentos manuais) de "Custos com
  // insumos" (consumo derivado das vendas). Margem vira sublinha do Lucro.
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        icon={Wallet}
        rotulo="Faturamento"
        valor={centavosParaReais(resumo.faturamentoCentavos)}
        sublinha={`${resumo.qtdVendas} vendas · ${resumo.qtdItensVendidos} itens`}
      />
      <KpiCard
        icon={Receipt}
        rotulo="Custos gerais"
        valor={centavosParaReais(resumo.custosGeraisCentavos)}
        sublinha="aluguel, internet, software"
      />
      <KpiCard
        icon={Boxes}
        rotulo="Custos com insumos"
        valor={centavosParaReais(resumo.custosInsumosCentavos)}
        sublinha="consumo nas vendas do mês"
      />
      <KpiCard
        icon={positivo ? TrendingUp : TrendingDown}
        rotulo="Lucro líquido"
        valor={centavosParaReais(resumo.lucroLiquidoCentavos)}
        sublinhaNode={
          <span className="inline-flex items-center gap-1.5">
            margem{' '}
            <Badge variant={margemVariant} className="font-normal">
              {pct(resumo.margem)}
            </Badge>
          </span>
        }
        destaque={positivo ? 'success' : 'danger'}
      />
    </div>
  );
}

function CanaisCard({ resumo }: { resumo: ResumoFinanceiro }) {
  const total = resumo.faturamentoCentavos || 1;
  const canais: Array<{ nome: string; key: keyof ResumoFinanceiro['porCanal'] }> = [
    { nome: 'Shopee', key: 'SHOPEE' },
    { nome: 'Mercado Livre', key: 'ML' },
    { nome: 'TikTok Shop', key: 'TIKTOK' },
    { nome: 'Site próprio', key: 'SITE' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Faturamento por canal</CardTitle>
        <CardDescription>Distribuição da receita do mês</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {canais.map((c) => {
          const valor = resumo.porCanal[c.key];
          const fatia = valor / total;
          return (
            <div key={c.key} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{c.nome}</span>
                <span className="tabular-nums">
                  {centavosParaReais(valor)} <span className="text-muted-foreground">({pct(fatia)})</span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, fatia * 100))}%` }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function KpiCard({
  icon: Icon,
  rotulo,
  valor,
  sublinha,
  sublinhaNode,
  destaque,
}: {
  icon: typeof Wallet;
  rotulo: string;
  valor: string;
  sublinha?: string;
  sublinhaNode?: React.ReactNode;
  destaque?: 'success' | 'warning' | 'danger';
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold tabular-nums">
          {destaque ? <Badge variant={destaque}>{valor}</Badge> : valor}
        </div>
        {sublinhaNode ? (
          <p className="text-xs text-muted-foreground">{sublinhaNode}</p>
        ) : sublinha ? (
          <p className="text-xs text-muted-foreground">{sublinha}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AcessoRapido({
  href,
  titulo,
  descricao,
}: {
  href: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent"
    >
      <div>
        <p className="font-medium">{titulo}</p>
        <p className="text-sm text-muted-foreground">{descricao}</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
