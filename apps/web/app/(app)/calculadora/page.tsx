'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CalcularInput, CalcularOutput, Filamento, Parametro } from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, pct } from '@/lib/format';
import { parseDecimalBr, parseDecimalParaCentavos } from '@/lib/parsing';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { InputDecimal } from '@/components/ui/input-decimal';
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
  embalagemReais: '1,50',
  precoReais: '35,00',
};

export default function CalculadoraPage() {
  const [form, setForm] = useState<FormState>(ESTADO_INICIAL);
  const [resultado, setResultado] = useState<CalcularOutput | null>(null);
  const [canal, setCanal] = useState<'SHOPEE' | 'ML' | 'SITE' | 'TIKTOK'>('SHOPEE');
  const [erro, setErro] = useState<string | null>(null);

  const { data: filamentos } = useQuery({
    queryKey: ['filamentos'],
    queryFn: () => apiFetch<Filamento[]>('/filamentos'),
  });

  const { data: parametros } = useQuery({
    queryKey: ['parametros'],
    queryFn: () => apiFetch<Parametro>('/parametros'),
  });

  /** Recalcula em background (debounce 300ms) sempre que o form ficar válido. */
  useEffect(() => {
    const peso = parseDecimalBr(form.pesoG);
    const tempo = parseDecimalBr(form.tempoH);
    const preco = parseDecimalParaCentavos(form.precoReais);
    const embalagem = parseDecimalParaCentavos(form.embalagemReais);

    if (!form.filamentoId || !Number.isFinite(peso) || peso <= 0 || !Number.isFinite(tempo) || tempo <= 0 || !Number.isFinite(preco) || preco <= 0) {
      setResultado(null);
      setErro(null);
      return;
    }

    const input: CalcularInput = {
      filamentoId: form.filamentoId,
      pesoG: peso,
      tempoH: tempo,
      impressora: form.impressora,
      embalagemCentavos: Number.isFinite(embalagem) ? embalagem : 0,
      precoCentavos: preco,
    };

    const t = setTimeout(() => {
      apiFetch<CalcularOutput>('/pricing/calcular', { method: 'POST', json: input })
        .then((r) => {
          setResultado(r);
          setErro(null);
        })
        .catch((e) => setErro(e instanceof Error ? e.message : 'Erro inesperado'));
    }, 300);
    return () => clearTimeout(t);
  }, [form]);

  function salvarComoProduto() {
    const params = new URLSearchParams({
      filamentoId: form.filamentoId,
      pesoG: form.pesoG,
      tempoH: form.tempoH,
      impressora: form.impressora,
      embalagemCentavos: String(parseDecimalParaCentavos(form.embalagemReais)),
      precoCentavos: String(parseDecimalParaCentavos(form.precoReais)),
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
                <Label>Peso (g)</Label>
                <InputDecimal
                  value={form.pesoG}
                  onChange={(s) => setForm({ ...form, pesoG: s })}
                  decimals={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tempo (h)</Label>
                <InputDecimal
                  value={form.tempoH}
                  onChange={(s) => setForm({ ...form, tempoH: s })}
                  decimals={2}
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
                <Label>Embalagem (R$)</Label>
                <InputDecimal
                  value={form.embalagemReais}
                  onChange={(s) => setForm({ ...form, embalagemReais: s })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Preço de venda (R$)</Label>
              <InputDecimal
                value={form.precoReais}
                onChange={(s) => setForm({ ...form, precoReais: s })}
              />
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resultado</CardTitle>
            <CardDescription>Custos, taxas e líquido por canal</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

const VAZIO = '—';

function valorOuVazio(centavos: number | undefined): string {
  return centavos == null ? VAZIO : centavosParaReais(centavos);
}

function Resultado({
  resultado,
  canal,
  onCanalChange,
  thresholds,
  onSalvar,
}: {
  resultado: CalcularOutput | null;
  canal: 'SHOPEE' | 'ML' | 'SITE' | 'TIKTOK';
  onCanalChange: (c: 'SHOPEE' | 'ML' | 'SITE' | 'TIKTOK') => void;
  thresholds: { verde: number; amarelo: number };
  onSalvar: () => void;
}) {
  const liquido = !resultado
    ? undefined
    : canal === 'SHOPEE'
      ? resultado.liquidoShopeeCentavos
      : canal === 'ML'
        ? resultado.liquidoMlCentavos
        : canal === 'TIKTOK'
          ? resultado.liquidoTikTokCentavos
          : resultado.liquidoSiteCentavos;
  const margem = !resultado
    ? undefined
    : canal === 'SHOPEE'
      ? resultado.margemShopee
      : canal === 'ML'
        ? resultado.margemMl
        : canal === 'TIKTOK'
          ? resultado.margemTikTok
          : resultado.margemSite;
  const lucroHora = !resultado
    ? undefined
    : canal === 'SHOPEE'
      ? resultado.lucroPorHoraShopeeCentavos
      : canal === 'ML'
        ? resultado.lucroPorHoraMlCentavos
        : canal === 'TIKTOK'
          ? resultado.lucroPorHoraTikTokCentavos
          : resultado.lucroPorHoraSiteCentavos;

  const variantBadge: 'success' | 'warning' | 'danger' | 'outline' =
    margem == null
      ? 'outline'
      : margem >= thresholds.verde
        ? 'success'
        : margem >= thresholds.amarelo
          ? 'warning'
          : 'danger';
  const label =
    margem == null
      ? 'Aguardando dados'
      : margem >= thresholds.verde
        ? 'Vale a pena'
        : margem >= thresholds.amarelo
          ? 'Atenção'
          : 'Não compensa';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant={variantBadge} className="text-sm">
          {label}
        </Badge>
        <div className="flex flex-wrap gap-2">
          {(['SHOPEE', 'ML', 'SITE', 'TIKTOK'] as const).map((c) => (
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
        <Linha rotulo="Custo filamento" valor={valorOuVazio(resultado?.custoFilamentoCentavos)} />
        <Linha rotulo="Custo energia" valor={valorOuVazio(resultado?.custoEnergiaCentavos)} />
        <Linha rotulo="Custo produção" valor={valorOuVazio(resultado?.custoTotalProducaoCentavos)} />
        <Linha rotulo="Imposto" valor={valorOuVazio(resultado?.impostoCentavos)} />
        {canal === 'SHOPEE' && (
          <Linha rotulo="Taxa Shopee" valor={valorOuVazio(resultado?.taxaShopeeCentavos)} />
        )}
        {canal === 'ML' && (
          <Linha rotulo="Taxa ML" valor={valorOuVazio(resultado?.taxaMlCentavos)} />
        )}
        {canal === 'TIKTOK' && (
          <Linha rotulo="Taxa TikTok" valor={valorOuVazio(resultado?.taxaTikTokCentavos)} />
        )}
        <Linha rotulo="Líquido" valor={valorOuVazio(liquido)} destaque />
        <Linha rotulo="Margem" valor={margem == null ? VAZIO : pct(margem)} destaque />
        <Linha rotulo="Lucro/hora" valor={valorOuVazio(lucroHora)} />
      </dl>

      <Button onClick={onSalvar} variant="outline" className="w-full" disabled={!resultado}>
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
