'use client';

import { useEffect, useRef, useState } from 'react';
import type { Parametro, PlanoAdsOutput, PlanoAdsParams } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { parseDecimalBr, parseDecimalParaCentavos } from '@/lib/parsing';
import { Label } from '@/components/ui/label';
import { InputDecimal } from '@/components/ui/input-decimal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlanoAdsPaineis } from '@/components/plano-ads-paineis';

interface ParamsForm {
  cpcReais: string;
  retornoPct: string;
  janelaDias: string;
  confianca: '95' | '99';
  fatorEscala: string;
  passoPct: string;
  cadenciaDias: string;
  nDegraus: string;
  /** Override opcional da margem de contribuição (R$). Vazio = usa o líquido do canal. */
  margemManualReais: string;
}

/**
 * Seção "ROAS de Anúncios" da Calculadora — stateless, não toca em produtos.
 * Consome o líquido do canal já calculado (ou um override manual de margem) + os
 * parâmetros de anúncio editáveis, e chama POST /pricing/plano-ads.
 */
export function RoasCalculadora({
  precoCentavos,
  liquidoCentavos,
  canalLabel,
  defaults,
}: {
  precoCentavos: number | null;
  liquidoCentavos: number | null;
  canalLabel: string;
  defaults: Parametro | undefined;
}) {
  const [params, setParams] = useState<ParamsForm>(() => paramsIniciais(defaults));
  const [plano, setPlano] = useState<PlanoAdsOutput | null>(null);
  const [carregando, setCarregando] = useState(false);
  const seeded = useRef(false);

  // Semeia os parâmetros com os defaults globais quando chegam (uma vez, sem sobrescrever edição).
  useEffect(() => {
    if (defaults && !seeded.current) {
      seeded.current = true;
      setParams(paramsIniciais(defaults));
    }
  }, [defaults]);

  useEffect(() => {
    const override = params.margemManualReais.trim()
      ? parseDecimalParaCentavos(params.margemManualReais)
      : null;
    const margem = override != null && Number.isFinite(override) ? override : liquidoCentavos;

    if (!precoCentavos || precoCentavos <= 0 || margem == null) {
      setPlano(null);
      return;
    }

    setCarregando(true);
    const t = setTimeout(() => {
      apiFetch<PlanoAdsOutput>('/pricing/plano-ads', {
        method: 'POST',
        json: { precoCentavos, margemContribuicaoCentavos: margem, params: paramsParaApi(params) },
      })
        .then(setPlano)
        .catch(() => setPlano(null))
        .finally(() => setCarregando(false));
    }, 300);
    return () => clearTimeout(t);
  }, [precoCentavos, liquidoCentavos, params]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Baseado no líquido de <span className="font-medium text-foreground">{canalLabel}</span>.
        Nada é salvo — ajuste os parâmetros para simular.
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Campo label="CPC médio (R$)">
          <InputDecimal
            value={params.cpcReais}
            onChange={(s) => setParams({ ...params, cpcReais: s })}
          />
        </Campo>
        <Campo label="Taxa de retorno (%)">
          <InputDecimal
            value={params.retornoPct}
            onChange={(s) => setParams({ ...params, retornoPct: s })}
          />
        </Campo>
        <Campo label="Janela de teste (dias)">
          <InputDecimal
            value={params.janelaDias}
            decimals={0}
            onChange={(s) => setParams({ ...params, janelaDias: s })}
          />
        </Campo>
        <Campo label="Confiança">
          <Select
            value={params.confianca}
            onValueChange={(v) => setParams({ ...params, confianca: v as '95' | '99' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="95">95%</SelectItem>
              <SelectItem value="99">99%</SelectItem>
            </SelectContent>
          </Select>
        </Campo>
        <Campo label="Fator margem (escala)">
          <InputDecimal
            value={params.fatorEscala}
            onChange={(s) => setParams({ ...params, fatorEscala: s })}
          />
        </Campo>
        <Campo label="Passo da escala (%)">
          <InputDecimal
            value={params.passoPct}
            onChange={(s) => setParams({ ...params, passoPct: s })}
          />
        </Campo>
        <Campo label="Cadência (dias)">
          <InputDecimal
            value={params.cadenciaDias}
            decimals={0}
            onChange={(s) => setParams({ ...params, cadenciaDias: s })}
          />
        </Campo>
        <Campo label="Degraus da escala">
          <InputDecimal
            value={params.nDegraus}
            decimals={0}
            onChange={(s) => setParams({ ...params, nDegraus: s })}
          />
        </Campo>
        <Campo label="Margem manual (R$, opcional)">
          <InputDecimal
            value={params.margemManualReais}
            onChange={(s) => setParams({ ...params, margemManualReais: s })}
            placeholder="usa o líquido do canal"
          />
        </Campo>
      </div>

      <PlanoAdsPaineis
        plano={plano}
        nivelConfianca={params.confianca === '99' ? 99 : 95}
        carregando={carregando}
      />
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function paramsIniciais(p: Parametro | undefined): ParamsForm {
  return {
    cpcReais: reaisStr(p?.adsCpcMedioCentavos ?? 50),
    retornoPct: numStr(p?.adsTaxaRetornoPct ?? 8),
    janelaDias: String(p?.adsJanelaTesteDias ?? 5),
    confianca: Number(p?.adsNivelConfianca ?? 95) === 99 ? '99' : '95',
    fatorEscala: numStr(p?.adsFatorMargemEscala ?? 1.4),
    passoPct: numStr(p?.adsPassoIncrementoPct ?? 25),
    cadenciaDias: String(p?.adsCadenciaIncrementoDias ?? 3),
    nDegraus: String(p?.adsNDegraus ?? 5),
    margemManualReais: '',
  };
}

function paramsParaApi(f: ParamsForm): PlanoAdsParams {
  return {
    cpcMedioCentavos: parseDecimalParaCentavos(f.cpcReais),
    taxaRetornoPct: parseDecimalBr(f.retornoPct),
    janelaTesteDias: Math.round(parseDecimalBr(f.janelaDias)),
    nivelConfianca: f.confianca === '99' ? 99 : 95,
    fatorMargemEscala: parseDecimalBr(f.fatorEscala),
    passoIncrementoPct: parseDecimalBr(f.passoPct),
    cadenciaIncrementoDias: Math.round(parseDecimalBr(f.cadenciaDias)),
    nDegraus: Math.round(parseDecimalBr(f.nDegraus)),
  };
}

function reaisStr(centavos: number): string {
  return (centavos / 100).toFixed(2).replace('.', ',');
}

function numStr(v: number | string): string {
  return String(Number(v)).replace('.', ',');
}
