'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CalcularOutput,
  Filamento,
  Parametro,
  Produto,
  ProdutoCreate,
} from '@mahou-hub/contracts';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, pct } from '@/lib/format';
import { parseDecimalBr, parseDecimalParaCentavos } from '@/lib/parsing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputDecimal } from '@/components/ui/input-decimal';
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

interface Props {
  produto?: Produto | null;
  inicial?: Partial<FormState>;
}

interface FormState {
  nome: string;
  inspiracao: string;
  modelo3dUrl: string;
  dimensoes: string;
  filamentoId: string;
  pesoG: string;
  tempoH: string;
  impressora: 'A1' | 'H2C';
  embalagemReais: string;
  precoReais: string;
  canalPrincipal: 'SHOPEE' | 'ML' | 'SITE';
}

const VAZIO: FormState = {
  nome: '',
  inspiracao: '',
  modelo3dUrl: '',
  dimensoes: '',
  filamentoId: '',
  pesoG: '',
  tempoH: '',
  impressora: 'A1',
  embalagemReais: '',
  precoReais: '',
  canalPrincipal: 'SHOPEE',
};

export function ProdutoForm({ produto, inicial }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const editando = !!produto;

  const [form, setForm] = useState<FormState>(() => {
    if (produto) {
      return {
        nome: produto.nome,
        inspiracao: produto.inspiracao ?? '',
        modelo3dUrl: produto.modelo3dUrl ?? '',
        dimensoes: produto.dimensoes ?? '',
        filamentoId: produto.filamentoId,
        pesoG: String(produto.pesoG).replace('.', ','),
        tempoH: String(produto.tempoH).replace('.', ','),
        impressora: produto.impressora,
        embalagemReais: (produto.embalagemCentavos / 100).toFixed(2).replace('.', ','),
        precoReais: (produto.precoCentavos / 100).toFixed(2).replace('.', ','),
        canalPrincipal: produto.canalPrincipal,
      };
    }
    return { ...VAZIO, ...inicial };
  });

  const [preview, setPreview] = useState<CalcularOutput | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data: filamentos } = useQuery({
    queryKey: ['filamentos'],
    queryFn: () => apiFetch<Filamento[]>('/filamentos'),
  });

  const { data: parametros } = useQuery({
    queryKey: ['parametros'],
    queryFn: () => apiFetch<Parametro>('/parametros'),
  });

  useEffect(() => {
    const peso = parseDecimalBr(form.pesoG);
    const tempo = parseDecimalBr(form.tempoH);
    const embalagem = parseDecimalParaCentavos(form.embalagemReais);
    const preco = parseDecimalParaCentavos(form.precoReais);
    if (!form.filamentoId || !Number.isFinite(peso) || !Number.isFinite(tempo) || !Number.isFinite(preco) || preco <= 0) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      apiFetch<CalcularOutput>('/pricing/calcular', {
        method: 'POST',
        json: {
          filamentoId: form.filamentoId,
          pesoG: peso,
          tempoH: tempo,
          impressora: form.impressora,
          embalagemCentavos: Number.isFinite(embalagem) ? embalagem : 0,
          precoCentavos: preco,
        },
      })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(t);
  }, [form]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSalvando(true);
    try {
      const payload: ProdutoCreate = {
        nome: form.nome.trim(),
        inspiracao: form.inspiracao.trim() || null,
        modelo3dUrl: form.modelo3dUrl.trim() || null,
        dimensoes: form.dimensoes.trim() || null,
        filamentoId: form.filamentoId,
        pesoG: parseDecimalBr(form.pesoG),
        tempoH: parseDecimalBr(form.tempoH),
        impressora: form.impressora,
        embalagemCentavos: parseDecimalParaCentavos(form.embalagemReais),
        precoCentavos: parseDecimalParaCentavos(form.precoReais),
        canalPrincipal: form.canalPrincipal,
        ativo: true,
      };
      if (produto) {
        await apiFetch(`/produtos/${produto.id}`, { method: 'PATCH', json: payload });
      } else {
        await apiFetch('/produtos', { method: 'POST', json: payload });
      }
      await qc.invalidateQueries({ queryKey: ['produtos'] });
      router.push('/produtos');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSalvando(false);
    }
  }

  const thresholdVerde = Number(parametros?.margemThresholdVerde ?? 0.3);
  const thresholdAmarelo = Number(parametros?.margemThresholdAmarelo ?? 0.15);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{editando ? 'Editar produto' : 'Novo produto'}</CardTitle>
          <CardDescription>Dados que vão para o catálogo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome</Label>
              <Input
                id="nome"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="inspiracao">Inspiração (URL)</Label>
                <Input
                  id="inspiracao"
                  value={form.inspiracao}
                  onChange={(e) => setForm({ ...form, inspiracao: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="modelo3d">Modelo 3D (URL)</Label>
                <Input
                  id="modelo3d"
                  value={form.modelo3dUrl}
                  onChange={(e) => setForm({ ...form, modelo3dUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="dimensoes">Dimensões</Label>
              <Input
                id="dimensoes"
                value={form.dimensoes}
                onChange={(e) => setForm({ ...form, dimensoes: e.target.value })}
                placeholder="ex: 10x5x3 cm"
              />
            </div>

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
                <Label>Canal principal</Label>
                <Select
                  value={form.canalPrincipal}
                  onValueChange={(v) => setForm({ ...form, canalPrincipal: v as FormState['canalPrincipal'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHOPEE">Shopee</SelectItem>
                    <SelectItem value="ML">Mercado Livre</SelectItem>
                    <SelectItem value="SITE">Site próprio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Embalagem (R$)</Label>
                <InputDecimal
                  value={form.embalagemReais}
                  onChange={(s) => setForm({ ...form, embalagemReais: s })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preço (R$)</Label>
                <InputDecimal
                  value={form.precoReais}
                  onChange={(s) => setForm({ ...form, precoReais: s })}
                />
              </div>
            </div>

            {erro && <p className="text-sm text-destructive">{erro}</p>}

            <div className="flex gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => router.push('/produtos')}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando} className="flex-1">
                {salvando ? 'Salvando…' : editando ? 'Salvar' : 'Criar produto'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preview de preço</CardTitle>
          <CardDescription>Recalculado ao vivo enquanto você digita</CardDescription>
        </CardHeader>
        <CardContent>
          {preview ? (
            <Preview preview={preview} thresholdVerde={thresholdVerde} thresholdAmarelo={thresholdAmarelo} canal={form.canalPrincipal} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Preencha filamento, peso, tempo e preço para ver o cálculo.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Preview({
  preview,
  thresholdVerde,
  thresholdAmarelo,
  canal,
}: {
  preview: CalcularOutput;
  thresholdVerde: number;
  thresholdAmarelo: number;
  canal: 'SHOPEE' | 'ML' | 'SITE';
}) {
  const margemPrincipal =
    canal === 'SHOPEE' ? preview.margemShopee : canal === 'ML' ? preview.margemMl : preview.margemSite;
  const variant: 'success' | 'warning' | 'danger' =
    margemPrincipal >= thresholdVerde ? 'success' : margemPrincipal >= thresholdAmarelo ? 'warning' : 'danger';
  const label =
    margemPrincipal >= thresholdVerde
      ? 'Vale a pena'
      : margemPrincipal >= thresholdAmarelo
        ? 'Atenção'
        : 'Não compensa';

  return (
    <div className="space-y-4">
      <Badge variant={variant} className="text-sm">{label}</Badge>
      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <Linha rotulo="Custo filamento" valor={centavosParaReais(preview.custoFilamentoCentavos)} />
        <Linha rotulo="Custo energia" valor={centavosParaReais(preview.custoEnergiaCentavos)} />
        <Linha rotulo="Custo produção" valor={centavosParaReais(preview.custoTotalProducaoCentavos)} />
        <Linha rotulo="Imposto" valor={centavosParaReais(preview.impostoCentavos)} />
        <Linha rotulo="Taxa Shopee" valor={centavosParaReais(preview.taxaShopeeCentavos)} />
        <Linha rotulo="Taxa ML" valor={centavosParaReais(preview.taxaMlCentavos)} />
        <Linha rotulo="Liq. Shopee" valor={centavosParaReais(preview.liquidoShopeeCentavos)} destaque={canal === 'SHOPEE'} />
        <Linha rotulo="Liq. ML" valor={centavosParaReais(preview.liquidoMlCentavos)} destaque={canal === 'ML'} />
        <Linha rotulo="Liq. Site" valor={centavosParaReais(preview.liquidoSiteCentavos)} destaque={canal === 'SITE'} />
        <Linha rotulo="Margem Shopee" valor={pct(preview.margemShopee)} />
        <Linha rotulo="Margem ML" valor={pct(preview.margemMl)} />
        <Linha rotulo="Lucro/h Shopee" valor={centavosParaReais(preview.lucroPorHoraShopeeCentavos)} />
        <Linha rotulo="Lucro/h ML" valor={centavosParaReais(preview.lucroPorHoraMlCentavos)} />
      </dl>
    </div>
  );
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <>
      <dt className={destaque ? 'text-foreground font-medium' : 'text-muted-foreground'}>{rotulo}</dt>
      <dd className={destaque ? 'text-right font-semibold' : 'text-right tabular-nums'}>{valor}</dd>
    </>
  );
}
