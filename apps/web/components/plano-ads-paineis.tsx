'use client';

import type { PlanoAdsOutput } from '@mahou-hub/contracts';
import { centavosParaReais, pct } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** ROAS como múltiplo: 2.29 → "2,29×". */
function roas(valor: number): string {
  return `${valor.toFixed(2).replace('.', ',')}×`;
}

/**
 * Renderiza o plano de anúncios (Teste | Escalonamento) já calculado.
 * Read-only e compartilhado entre a Calculadora (hipotético) e a página do Produto.
 */
export function PlanoAdsPaineis({
  plano,
  nivelConfianca,
  carregando,
}: {
  plano: PlanoAdsOutput | null | undefined;
  nivelConfianca: number;
  carregando?: boolean;
}) {
  if (!plano) {
    return (
      <p className="text-sm text-muted-foreground">
        {carregando ? 'Calculando…' : 'Defina preço e economia para ver o plano de anúncios.'}
      </p>
    );
  }

  if (plano.inviavel) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <Badge variant="danger">Inviável</Badge>
        <p className="text-muted-foreground">{plano.avisoInviavel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <PainelTeste plano={plano} nivelConfianca={nivelConfianca} />
        <PainelEscala plano={plano} />
      </div>
      {plano.avisos.length > 0 && (
        <ul className="space-y-1.5">
          {plano.avisos.map((aviso) => (
            <li
              key={aviso}
              className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
            >
              <span aria-hidden>⚠</span>
              {aviso}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PainelTeste({ plano, nivelConfianca }: { plano: PlanoAdsOutput; nivelConfianca: number }) {
  return (
    <section className="rounded-lg border border-border bg-card/50 p-4">
      <Cabecalho titulo="Teste" rotuloAlvo="ROAS-alvo" valorAlvo={roas(plano.roasAlvoTeste)} />
      <p className="mb-3 text-xs text-muted-foreground">
        Mira o break-even: o objetivo é comprar dados, não lucro.
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
        <Stat
          rotulo="Investimento/dia"
          valor={centavosParaReais(plano.investimentoDiarioTesteCentavos)}
          destaque
        />
        <Stat
          rotulo="Orçamento total"
          valor={centavosParaReais(plano.orcamentoTesteTotalCentavos)}
        />
        <Stat rotulo="Cliques estimados" valor={String(plano.cliquesEstimadosTeste)} />
        <Stat rotulo="Vendas esperadas" valor={String(plano.vendasEsperadas)} />
        <Stat rotulo="CPA máx. (break-even)" valor={centavosParaReais(plano.cpaAlvoCentavos)} />
        <Stat rotulo="Margem líq. devoluções" valor={pct(plano.mcLiquidaPct, 2)} />
      </div>
      <ReguaDecisao plano={plano} nivelConfianca={nivelConfianca} />
    </section>
  );
}

function PainelEscala({ plano }: { plano: PlanoAdsOutput }) {
  return (
    <section className="rounded-lg border border-primary/50 bg-primary/5 p-4">
      <Cabecalho
        titulo="Escalonamento"
        rotuloAlvo="ROAS-alvo"
        valorAlvo={roas(plano.roasAlvoEscala)}
      />
      <p className="mb-3 text-xs text-muted-foreground">
        Validado o teste, suba o orçamento por degraus enquanto o ROAS observado ≥ alvo.
      </p>
      <div className="overflow-hidden rounded-md border border-border">
        <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 bg-muted/40 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Degrau</span>
          <span>Dias</span>
          <span className="text-right">R$/dia</span>
        </div>
        {plano.escada.map((degrau, idx) => (
          <div
            key={degrau.degrau}
            className={cn(
              'grid grid-cols-[auto_1fr_auto] items-center gap-x-4 px-3 py-1.5 text-sm tabular-nums',
              idx > 0 && 'border-t border-border',
            )}
          >
            <span className="font-medium">{degrau.degrau + 1}</span>
            <span className="text-muted-foreground">
              {degrau.diaInicio}–{degrau.diaFim}
            </span>
            <span className="text-right font-medium">
              {centavosParaReais(degrau.budgetDiarioCentavos)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Régua de decisão: o que fazer ao fim do teste conforme o nº de vendas. */
function ReguaDecisao({
  plano,
  nivelConfianca,
}: {
  plano: PlanoAdsOutput;
  nivelConfianca: number;
}) {
  const meta = plano.vendasEsperadas;
  return (
    <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
      <p className="font-medium uppercase tracking-wide text-muted-foreground">Régua de decisão</p>
      <Regra cor="danger" titulo="0 vendas">
        matar ou reformular (confiança {nivelConfianca}%)
      </Regra>
      <Regra cor="success" titulo={`≥ ${meta} vendas`}>
        validar e escalar — alvo passa a {roas(plano.roasAlvoEscala)}
      </Regra>
      <Regra cor="warning" titulo={`1–${Math.max(meta - 1, 1)} vendas`}>
        zona ambígua: diagnostique o funil (CTR = capa/preço; CR = página) ou estenda
      </Regra>
    </div>
  );
}

function Regra({
  cor,
  titulo,
  children,
}: {
  cor: 'danger' | 'success' | 'warning';
  titulo: string;
  children: React.ReactNode;
}) {
  const ponto =
    cor === 'danger' ? 'bg-destructive' : cor === 'success' ? 'bg-emerald-500' : 'bg-amber-500';
  return (
    <p className="flex gap-2 text-muted-foreground">
      <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', ponto)} />
      <span>
        <span className="font-medium text-foreground">{titulo}:</span> {children}
      </span>
    </p>
  );
}

function Cabecalho({
  titulo,
  rotuloAlvo,
  valorAlvo,
}: {
  titulo: string;
  rotuloAlvo: string;
  valorAlvo: string;
}) {
  return (
    <div className="mb-1 flex items-center justify-between">
      <h4 className="text-sm font-semibold">{titulo}</h4>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {rotuloAlvo}
        </span>
        <Badge variant="outline" className="font-mono text-sm tabular-nums">
          {valorAlvo}
        </Badge>
      </div>
    </div>
  );
}

function Stat({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{rotulo}</div>
      <div className={cn('tabular-nums', destaque ? 'text-base font-semibold' : 'font-medium')}>
        {valor}
      </div>
    </div>
  );
}
