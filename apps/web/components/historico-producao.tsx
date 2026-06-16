'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { HistoricoPeriodo, ProducaoHistoricoBucket } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

const PERIODOS: [HistoricoPeriodo, string][] = [
  ['diario', 'Diário'],
  ['semanal', 'Semanal'],
  ['mensal', 'Mensal'],
  ['anual', 'Anual'],
];

// Buckets vêm em UTC (date_trunc no backend); formata em UTC pra não dar -1 dia por fuso.
function rotuloEixo(iso: string, periodo: HistoricoPeriodo): string {
  const d = new Date(iso);
  if (periodo === 'anual') return String(d.getUTCFullYear());
  if (periodo === 'mensal') return d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' });
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
}

function rotuloCompleto(iso: string, periodo: HistoricoPeriodo): string {
  const d = new Date(iso);
  if (periodo === 'anual') return String(d.getUTCFullYear());
  if (periodo === 'mensal')
    return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const dia = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' });
  return periodo === 'semanal' ? `Semana de ${dia}` : `${dia}`;
}

/** Histórico de produção (peças impressas) com gráfico de barras e janela diária/semanal/mensal/anual. */
export function HistoricoProducao() {
  const [periodo, setPeriodo] = useState<HistoricoPeriodo>('mensal');
  const { data } = useQuery({
    queryKey: ['producao', 'historico', periodo],
    queryFn: () => apiFetch<ProducaoHistoricoBucket[]>(`/producao/historico?periodo=${periodo}`),
  });

  const buckets = data ?? [];
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const total = buckets.reduce((s, b) => s + b.total, 0);
  const passoRotulo = Math.max(1, Math.ceil(buckets.length / 10));

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico de produção
          </h2>
          <p className="text-xs text-muted-foreground">
            Peças impressas no período · <span className="font-medium text-foreground">{total}</span>{' '}
            no total
          </p>
        </div>
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {PERIODOS.map(([p, label]) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriodo(p)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                periodo === p
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Card className="p-4">
        {buckets.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Sem produção no período.</p>
        ) : (
          <>
            <div className="flex h-40 items-stretch gap-1">
              {buckets.map((b) => (
                <div
                  key={b.inicio}
                  className="group flex flex-1 flex-col justify-end"
                  title={`${rotuloCompleto(b.inicio, periodo)}: ${b.total} ${b.total === 1 ? 'peça' : 'peças'}`}
                >
                  <span className="mb-0.5 text-center text-[10px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    {b.total}
                  </span>
                  <div
                    className="w-full rounded-t bg-primary/80 transition-colors group-hover:bg-primary"
                    style={{ height: b.total === 0 ? '0%' : `${Math.max(4, (b.total / max) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-1">
              {buckets.map((b, i) => (
                <span
                  key={b.inicio}
                  className="flex-1 truncate text-center text-[10px] leading-tight text-muted-foreground"
                >
                  {i % passoRotulo === 0 ? rotuloEixo(b.inicio, periodo) : ''}
                </span>
              ))}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
