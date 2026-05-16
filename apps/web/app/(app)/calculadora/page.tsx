'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CalcularInput, CalcularOutput, Filamento, Parametro } from '@mahou-hub/contracts';
import { apiFetch } from '../../../lib/api-client';
import { centavosParaReais, pct } from '../../../lib/format';

interface FormState {
  filamentoId: string;
  pesoG: string;
  tempoH: string;
  impressora: 'A1' | 'H2C';
  embalagemReais: string;
  precoReais: string;
}

const ESTADO_INICIAL: FormState = {
  filamentoId: '',
  pesoG: '50',
  tempoH: '2',
  impressora: 'A1',
  embalagemReais: '1.50',
  precoReais: '35.00',
};

function reaisStrParaCentavos(s: string): number {
  return Math.round(Number(s.replace(',', '.')) * 100);
}

export default function CalculadoraPage() {
  const [form, setForm] = useState<FormState>(ESTADO_INICIAL);
  const [resultado, setResultado] = useState<CalculoOutputComCanal | null>(null);
  const [canal, setCanal] = useState<'SHOPEE' | 'ML' | 'SITE'>('SHOPEE');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const { data: filamentos } = useQuery({
    queryKey: ['filamentos'],
    queryFn: () => apiFetch<Filamento[]>('/filamentos'),
  });

  const { data: parametros } = useQuery({
    queryKey: ['parametros'],
    queryFn: () => apiFetch<Parametro>('/parametros'),
  });

  async function calcular() {
    setErro(null);
    setCarregando(true);
    try {
      const input: CalcularInput = {
        filamentoId: form.filamentoId || undefined,
        pesoG: Number(form.pesoG),
        tempoH: Number(form.tempoH),
        impressora: form.impressora,
        embalagemCentavos: reaisStrParaCentavos(form.embalagemReais),
        precoCentavos: reaisStrParaCentavos(form.precoReais),
      };
      const r = await apiFetch<CalcularOutput>('/pricing/calcular', { method: 'POST', json: input });
      setResultado(r);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setCarregando(false);
    }
  }

  function salvarComoProduto() {
    const params = new URLSearchParams({
      filamentoId: form.filamentoId,
      pesoG: form.pesoG,
      tempoH: form.tempoH,
      impressora: form.impressora,
      embalagemCentavos: String(reaisStrParaCentavos(form.embalagemReais)),
      precoCentavos: String(reaisStrParaCentavos(form.precoReais)),
      canalPrincipal: canal,
    });
    window.location.href = `/produtos/novo?${params.toString()}`;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Calculadora de viabilidade</h1>
        <p className="text-sm text-mahou-mute">
          Tira-teima antes de cadastrar um produto. Nada é salvo no banco.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl bg-white p-6 shadow-sm space-y-4">
          <Field label="Filamento">
            <select
              value={form.filamentoId}
              onChange={(e) => setForm({ ...form, filamentoId: e.target.value })}
              className="w-full rounded-md border border-mahou-line px-3 py-2"
            >
              <option value="">— selecione —</option>
              {filamentos?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} ({centavosParaReais(f.custoKgCentavos)}/kg)
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Peso (g)">
              <input
                type="number"
                step="0.1"
                value={form.pesoG}
                onChange={(e) => setForm({ ...form, pesoG: e.target.value })}
                className="w-full rounded-md border border-mahou-line px-3 py-2"
              />
            </Field>
            <Field label="Tempo (h)">
              <input
                type="number"
                step="0.1"
                value={form.tempoH}
                onChange={(e) => setForm({ ...form, tempoH: e.target.value })}
                className="w-full rounded-md border border-mahou-line px-3 py-2"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Impressora">
              <select
                value={form.impressora}
                onChange={(e) =>
                  setForm({ ...form, impressora: e.target.value as 'A1' | 'H2C' })
                }
                className="w-full rounded-md border border-mahou-line px-3 py-2"
              >
                <option value="A1">A1</option>
                <option value="H2C">H2C</option>
              </select>
            </Field>
            <Field label="Embalagem (R$)">
              <input
                type="number"
                step="0.01"
                value={form.embalagemReais}
                onChange={(e) => setForm({ ...form, embalagemReais: e.target.value })}
                className="w-full rounded-md border border-mahou-line px-3 py-2"
              />
            </Field>
          </div>

          <Field label="Preço de venda (R$)">
            <input
              type="number"
              step="0.01"
              value={form.precoReais}
              onChange={(e) => setForm({ ...form, precoReais: e.target.value })}
              className="w-full rounded-md border border-mahou-line px-3 py-2"
            />
          </Field>

          <button
            onClick={calcular}
            disabled={carregando}
            className="w-full rounded-md bg-mahou-accent px-4 py-2 text-white disabled:opacity-60"
          >
            {carregando ? 'Calculando...' : 'Calcular'}
          </button>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
        </section>

        <section className="rounded-xl bg-white p-6 shadow-sm">
          {resultado ? (
            <Resultado
              resultado={resultado}
              canal={canal}
              onCanalChange={setCanal}
              thresholds={{
                verde: Number(parametros?.margemThresholdVerde ?? 0.3),
                amarelo: Number(parametros?.margemThresholdAmarelo ?? 0.15),
              }}
              onSalvar={salvarComoProduto}
            />
          ) : (
            <p className="text-sm text-mahou-mute">Preencha o formulário e clique em Calcular.</p>
          )}
        </section>
      </div>
    </div>
  );
}

type CalculoOutputComCanal = CalcularOutput;

function Resultado({
  resultado,
  canal,
  onCanalChange,
  thresholds,
  onSalvar,
}: {
  resultado: CalcularOutput;
  canal: 'SHOPEE' | 'ML' | 'SITE';
  onCanalChange: (c: 'SHOPEE' | 'ML' | 'SITE') => void;
  thresholds: { verde: number; amarelo: number };
  onSalvar: () => void;
}) {
  const liquido =
    canal === 'SHOPEE'
      ? resultado.liquidoShopeeCentavos
      : canal === 'ML'
        ? resultado.liquidoMlCentavos
        : resultado.liquidoSiteCentavos;
  const margem =
    canal === 'SHOPEE'
      ? resultado.margemShopee
      : canal === 'ML'
        ? resultado.margemMl
        : resultado.margemSite;

  const cor =
    margem >= thresholds.verde
      ? 'bg-green-500'
      : margem >= thresholds.amarelo
        ? 'bg-yellow-500'
        : 'bg-red-500';
  const label =
    margem >= thresholds.verde
      ? 'Vale a pena'
      : margem >= thresholds.amarelo
        ? 'Atenção'
        : 'Não compensa';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className={`inline-block w-3 h-3 rounded-full ${cor}`} aria-hidden />
        <h2 className="text-lg font-semibold">{label}</h2>
      </div>

      <div className="flex gap-2">
        {(['SHOPEE', 'ML', 'SITE'] as const).map((c) => (
          <button
            key={c}
            onClick={() => onCanalChange(c)}
            className={`px-3 py-1 rounded-md text-sm ${
              c === canal
                ? 'bg-mahou-ink text-white'
                : 'bg-mahou-bg text-mahou-mute hover:bg-mahou-line'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <Linha rotulo="Custo filamento" valor={centavosParaReais(resultado.custoFilamentoCentavos)} />
        <Linha rotulo="Custo energia" valor={centavosParaReais(resultado.custoEnergiaCentavos)} />
        <Linha rotulo="Custo produção" valor={centavosParaReais(resultado.custoTotalProducaoCentavos)} />
        <Linha rotulo="Imposto" valor={centavosParaReais(resultado.impostoCentavos)} />
        {canal === 'SHOPEE' && (
          <Linha rotulo="Taxa Shopee" valor={centavosParaReais(resultado.taxaShopeeCentavos)} />
        )}
        {canal === 'ML' && (
          <Linha rotulo="Taxa ML" valor={centavosParaReais(resultado.taxaMlCentavos)} />
        )}
        <Linha rotulo="Líquido" valor={centavosParaReais(liquido)} destaque />
        <Linha rotulo="Margem" valor={pct(margem)} destaque />
        <Linha
          rotulo="Lucro/hora"
          valor={
            canal === 'ML'
              ? centavosParaReais(resultado.lucroPorHoraMlCentavos)
              : canal === 'SHOPEE'
                ? centavosParaReais(resultado.lucroPorHoraShopeeCentavos)
                : '—'
          }
        />
      </dl>

      <button
        onClick={onSalvar}
        className="w-full rounded-md border border-mahou-accent px-4 py-2 text-mahou-accent hover:bg-mahou-accent/5"
      >
        Salvar como produto
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-mahou-mute">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Linha({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <>
      <dt className="text-mahou-mute">{rotulo}</dt>
      <dd className={destaque ? 'text-right font-semibold' : 'text-right'}>{valor}</dd>
    </>
  );
}
