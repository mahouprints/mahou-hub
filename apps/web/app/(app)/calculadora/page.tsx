'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CalcularInput, CalcularOutput, Filamento, Parametro } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, pct } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
  const [resultado, setResultado] = useState<CalcularOutput | null>(null);
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
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Calculadora de viabilidade</h1>
        <p className="text-sm text-muted-foreground">
          Tira-teima antes de cadastrar um produto. Nada é salvo no banco.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Entrada</CardTitle>
            <CardDescription>Configure o produto hipotético</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Filamento</Label>
              <Select
                value={form.filamentoId}
                onValueChange={(v) => setForm({ ...form, filamentoId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="— selecione —" />
                </SelectTrigger>
                <SelectContent>
                  {filamentos?.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome} ({centavosParaReais(f.custoKgCentavos)}/kg)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pesoG">Peso (g)</Label>
                <Input
                  id="pesoG"
                  type="number"
                  step="0.1"
                  value={form.pesoG}
                  onChange={(e) => setForm({ ...form, pesoG: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tempoH">Tempo (h)</Label>
                <Input
                  id="tempoH"
                  type="number"
                  step="0.1"
                  value={form.tempoH}
                  onChange={(e) => setForm({ ...form, tempoH: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Impressora</Label>
                <Select
                  value={form.impressora}
                  onValueChange={(v) => setForm({ ...form, impressora: v as 'A1' | 'H2C' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A1">A1</SelectItem>
                    <SelectItem value="H2C">H2C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="embalagem">Embalagem (R$)</Label>
                <Input
                  id="embalagem"
                  type="number"
                  step="0.01"
                  value={form.embalagemReais}
                  onChange={(e) => setForm({ ...form, embalagemReais: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="preco">Preço de venda (R$)</Label>
              <Input
                id="preco"
                type="number"
                step="0.01"
                value={form.precoReais}
                onChange={(e) => setForm({ ...form, precoReais: e.target.value })}
              />
            </div>

            <Button onClick={calcular} disabled={carregando || !form.filamentoId} className="w-full">
              {carregando ? 'Calculando…' : 'Calcular'}
            </Button>
            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>Custos, taxas e líquido por canal</CardDescription>
          </CardHeader>
          <CardContent>
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
              <p className="text-sm text-muted-foreground">
                Preencha o formulário e clique em Calcular.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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

  const variantBadge: 'success' | 'warning' | 'danger' =
    margem >= thresholds.verde ? 'success' : margem >= thresholds.amarelo ? 'warning' : 'danger';
  const label =
    margem >= thresholds.verde
      ? 'Vale a pena'
      : margem >= thresholds.amarelo
        ? 'Atenção'
        : 'Não compensa';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Badge variant={variantBadge} className="text-sm">
          {label}
        </Badge>
        <div className="flex gap-2">
          {(['SHOPEE', 'ML', 'SITE'] as const).map((c) => (
            <Button
              key={c}
              size="sm"
              variant={c === canal ? 'default' : 'outline'}
              onClick={() => onCanalChange(c)}
            >
              {c}
            </Button>
          ))}
        </div>
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

      <Button onClick={onSalvar} variant="outline" className="w-full">
        Salvar como produto
      </Button>
    </div>
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
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className={destaque ? 'text-right font-semibold' : 'text-right'}>{valor}</dd>
    </>
  );
}
