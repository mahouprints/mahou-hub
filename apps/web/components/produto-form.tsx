'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import type {
  CalcularOutput,
  Filamento,
  Insumo,
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
import { UploadDropzone } from '@/components/upload-dropzone';
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

/** GET /produtos/:id devolve insumos populados; declaramos local pra não poluir contracts. */
type ProdutoComInsumos = Produto & {
  insumos?: Array<{ insumoId: string; qtd: number | string }>;
};

interface Props {
  produto?: ProdutoComInsumos | null;
  inicial?: Partial<FormState>;
}

interface InsumoLinha {
  insumoId: string;
  qtdStr: string; // string pro input controlled
}

interface FormState {
  nome: string;
  inspiracao: string;
  modelo3dUrl: string;
  larguraCm: string;
  alturaCm: string;
  profundidadeCm: string;
  filamentoId: string;
  pesoG: string;
  tempoH: string;
  impressora: 'A1' | 'H2C';
  embalagemReais: string;
  precoReais: string;
  canalPrincipal: 'SHOPEE' | 'ML' | 'SITE' | 'TIKTOK';
  insumos: InsumoLinha[];
}

const VAZIO: FormState = {
  nome: '',
  inspiracao: '',
  modelo3dUrl: '',
  larguraCm: '',
  alturaCm: '',
  profundidadeCm: '',
  filamentoId: '',
  pesoG: '',
  tempoH: '',
  impressora: 'A1',
  // Embalagem default 0: custos pequenos sem rastreio individual ficam nos
  // Insumos cadastrados; quem não usa o campo deixa zerado.
  embalagemReais: '0,00',
  precoReais: '',
  canalPrincipal: 'SHOPEE',
  insumos: [],
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
        larguraCm: produto.larguraCm != null ? String(produto.larguraCm).replace('.', ',') : '',
        alturaCm: produto.alturaCm != null ? String(produto.alturaCm).replace('.', ',') : '',
        profundidadeCm:
          produto.profundidadeCm != null ? String(produto.profundidadeCm).replace('.', ',') : '',
        filamentoId: produto.filamentoId,
        pesoG: String(produto.pesoG).replace('.', ','),
        tempoH: String(produto.tempoH).replace('.', ','),
        impressora: produto.impressora,
        embalagemReais: (produto.embalagemCentavos / 100).toFixed(2).replace('.', ','),
        precoReais: (produto.precoCentavos / 100).toFixed(2).replace('.', ','),
        canalPrincipal: produto.canalPrincipal,
        insumos: (produto.insumos ?? []).map((pi) => ({
          insumoId: pi.insumoId,
          qtdStr: String(pi.qtd).replace('.', ','),
        })),
      };
    }
    return { ...VAZIO, ...inicial };
  });

  const [preview, setPreview] = useState<CalcularOutput | null>(null);
  const [salvando, setSalvando] = useState(false);
  // Buffer de imagens selecionadas no form (só usado em modo criar).
  // No fluxo de edição, o user gerencia as imagens direto no detail.
  const [imagensPendentes, setImagensPendentes] = useState<File[]>([]);
  const [origemImagens, setOrigemImagens] = useState<'INSPIRACAO' | 'MODELO_3D' | 'OUTRA'>(
    'INSPIRACAO',
  );

  const { data: filamentos } = useQuery({
    queryKey: ['filamentos'],
    queryFn: () => apiFetch<Filamento[]>('/filamentos'),
  });

  const { data: parametros } = useQuery({
    queryKey: ['parametros'],
    queryFn: () => apiFetch<Parametro>('/parametros'),
  });

  const { data: insumosDisponiveis } = useQuery({
    queryKey: ['insumos'],
    queryFn: () => apiFetch<Insumo[]>('/insumos'),
  });

  /**
   * Soma o custo dos insumos selecionados no form (em centavos). Usado tanto pro
   * preview ao vivo quanto pra exibir o subtotal abaixo da lista de linhas.
   */
  const custoInsumosCentavos = form.insumos.reduce((acc, linha) => {
    const insumo = insumosDisponiveis?.find((i) => i.id === linha.insumoId);
    if (!insumo) return acc;
    const qtd = parseDecimalBr(linha.qtdStr);
    if (!Number.isFinite(qtd)) return acc;
    return acc + Math.round(qtd * insumo.custoUnitarioCentavos);
  }, 0);

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
          custoInsumosCentavos,
          precoCentavos: preco,
        },
      })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 300);
    return () => clearTimeout(t);
  }, [form, custoInsumosCentavos]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const payload: ProdutoCreate = {
        nome: form.nome.trim(),
        inspiracao: form.inspiracao.trim() || null,
        modelo3dUrl: form.modelo3dUrl.trim() || null,
        larguraCm: parseDimensaoCm(form.larguraCm),
        alturaCm: parseDimensaoCm(form.alturaCm),
        profundidadeCm: parseDimensaoCm(form.profundidadeCm),
        filamentoId: form.filamentoId,
        pesoG: parseDecimalBr(form.pesoG),
        tempoH: parseDecimalBr(form.tempoH),
        impressora: form.impressora,
        embalagemCentavos: (() => {
          const v = parseDecimalParaCentavos(form.embalagemReais);
          return Number.isFinite(v) ? v : 0; // vazio/inválido vira 0
        })(),
        precoCentavos: parseDecimalParaCentavos(form.precoReais),
        canalPrincipal: form.canalPrincipal,
        ativo: true,
        anunciado: produto?.anunciado ?? false,
        insumos: form.insumos
          .filter((l) => l.insumoId && Number.isFinite(parseDecimalBr(l.qtdStr)) && parseDecimalBr(l.qtdStr) > 0)
          .map((l) => ({ insumoId: l.insumoId, qtd: parseDecimalBr(l.qtdStr) })),
      };
      if (produto) {
        await apiFetch(`/produtos/${produto.id}`, { method: 'PATCH', json: payload });
        toast.success('Produto atualizado');
      } else {
        const criado = await apiFetch<{ id: string }>('/produtos', {
          method: 'POST',
          json: payload,
        });
        // Upload das imagens pendentes depois que o produto existe (precisa do ID).
        // Falhas no upload viram aviso, mas o produto fica criado normalmente —
        // user pode subir manualmente na tela de detalhe depois.
        if (imagensPendentes.length > 0) {
          try {
            const fd = new FormData();
            imagensPendentes.forEach((f) => fd.append('arquivos', f));
            const res = await fetch(
              `/api/produtos/${criado.id}/imagens?origem=${origemImagens}`,
              { method: 'POST', body: fd, credentials: 'include' },
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            toast.success(`Produto criado com ${imagensPendentes.length} imagem(ns)`);
          } catch {
            toast.error('Produto criado, mas falha ao subir imagens. Tente pela tela de detalhe.');
          }
        } else {
          toast.success('Produto criado');
        }
      }
      await qc.invalidateQueries({ queryKey: ['produtos'] });
      router.push('/produtos');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar produto');
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
              <Label>Dimensões (cm)</Label>
              {/* Ordem: largura, profundidade, altura — espelha a apresentação L×P×A. */}
              <div className="grid grid-cols-3 gap-2">
                <InputDecimal
                  value={form.larguraCm}
                  onChange={(s) => setForm({ ...form, larguraCm: s })}
                  decimals={1}
                  placeholder="largura"
                />
                <InputDecimal
                  value={form.profundidadeCm}
                  onChange={(s) => setForm({ ...form, profundidadeCm: s })}
                  decimals={1}
                  placeholder="profundidade"
                />
                <InputDecimal
                  value={form.alturaCm}
                  onChange={(s) => setForm({ ...form, alturaCm: s })}
                  decimals={1}
                  placeholder="altura"
                />
              </div>
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

            <InsumosSecao
              linhas={form.insumos}
              onChange={(insumos) => setForm({ ...form, insumos })}
              insumosDisponiveis={insumosDisponiveis ?? []}
              subtotalCentavos={custoInsumosCentavos}
            />

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
                    <SelectItem value="TIKTOK">TikTok Shop</SelectItem>
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

            {!editando && (
              <ImagensInicialSecao
                arquivos={imagensPendentes}
                onArquivos={setImagensPendentes}
                origem={origemImagens}
                onOrigemChange={setOrigemImagens}
                desabilitado={salvando}
              />
            )}

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
  canal: 'SHOPEE' | 'ML' | 'SITE' | 'TIKTOK';
}) {
  const margemPrincipal =
    canal === 'SHOPEE'
      ? preview.margemShopee
      : canal === 'ML'
        ? preview.margemMl
        : canal === 'TIKTOK'
          ? preview.margemTikTok
          : preview.margemSite;
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
        <Linha rotulo="Taxa TikTok" valor={centavosParaReais(preview.taxaTikTokCentavos)} />
        <Linha rotulo="Liq. Shopee" valor={centavosParaReais(preview.liquidoShopeeCentavos)} destaque={canal === 'SHOPEE'} />
        <Linha rotulo="Liq. ML" valor={centavosParaReais(preview.liquidoMlCentavos)} destaque={canal === 'ML'} />
        <Linha rotulo="Liq. Site" valor={centavosParaReais(preview.liquidoSiteCentavos)} destaque={canal === 'SITE'} />
        <Linha rotulo="Liq. TikTok" valor={centavosParaReais(preview.liquidoTikTokCentavos)} destaque={canal === 'TIKTOK'} />
        <Linha rotulo="Margem Shopee" valor={pct(preview.margemShopee)} />
        <Linha rotulo="Margem ML" valor={pct(preview.margemMl)} />
        <Linha rotulo="Margem TikTok" valor={pct(preview.margemTikTok)} />
        <Linha rotulo="Lucro/h Shopee" valor={centavosParaReais(preview.lucroPorHoraShopeeCentavos)} />
        <Linha rotulo="Lucro/h ML" valor={centavosParaReais(preview.lucroPorHoraMlCentavos)} />
        <Linha rotulo="Lucro/h TikTok" valor={centavosParaReais(preview.lucroPorHoraTikTokCentavos)} />
      </dl>
    </div>
  );
}

function InsumosSecao({
  linhas,
  onChange,
  insumosDisponiveis,
  subtotalCentavos,
}: {
  linhas: InsumoLinha[];
  onChange: (l: InsumoLinha[]) => void;
  insumosDisponiveis: Insumo[];
  subtotalCentavos: number;
}) {
  function adicionar() {
    onChange([...linhas, { insumoId: '', qtdStr: '' }]);
  }
  function remover(idx: number) {
    onChange(linhas.filter((_, i) => i !== idx));
  }
  function alterar(idx: number, patch: Partial<InsumoLinha>) {
    onChange(linhas.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  // Insumos já escolhidos em outras linhas (pra esconder das opções)
  const idsEmUso = new Set(linhas.map((l) => l.insumoId).filter(Boolean));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Insumos consumidos</Label>
        {subtotalCentavos > 0 && (
          <span className="text-xs text-muted-foreground">
            subtotal{' '}
            <span className="font-medium text-foreground tabular-nums">
              {centavosParaReais(subtotalCentavos)}
            </span>
          </span>
        )}
      </div>

      {linhas.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          Nenhum insumo. Adicione caixa, fita, etiqueta etc. que esse produto consome.
        </p>
      )}

      {linhas.map((linha, idx) => {
        const insumo = insumosDisponiveis.find((i) => i.id === linha.insumoId);
        const opcoes = insumosDisponiveis.filter(
          (i) => i.id === linha.insumoId || !idsEmUso.has(i.id),
        );
        return (
          <div key={idx} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
            <Select
              value={linha.insumoId}
              onValueChange={(v) => alterar(idx, { insumoId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="— selecione um insumo —" />
              </SelectTrigger>
              <SelectContent>
                {opcoes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome} ({centavosParaReais(i.custoUnitarioCentavos)}/{i.unidade})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <InputDecimal
              value={linha.qtdStr}
              onChange={(s) => alterar(idx, { qtdStr: s })}
              decimals={3}
              placeholder={insumo ? `qtd em ${insumo.unidade}` : 'qtd'}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remover(idx)}
              title="Remover linha"
              className="h-9 w-9 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        );
      })}

      <Button type="button" variant="outline" size="sm" onClick={adicionar}>
        + Adicionar insumo
      </Button>
    </div>
  );
}

/** Parse pra centímetros: aceita "10,5" ou "10.5"; vazio/inválido vira null. */
/**
 * Buffer de imagens selecionadas antes de criar o produto. Não envia nada —
 * só acumula File[]; o submit do form faz upload depois que tem o ID do produto.
 * Renderizada apenas em modo criar (em editar, user usa a seção do detail).
 */
function ImagensInicialSecao({
  arquivos,
  onArquivos,
  origem,
  onOrigemChange,
  desabilitado,
}: {
  arquivos: File[];
  onArquivos: (a: File[]) => void;
  origem: 'INSPIRACAO' | 'MODELO_3D' | 'OUTRA';
  onOrigemChange: (o: 'INSPIRACAO' | 'MODELO_3D' | 'OUTRA') => void;
  desabilitado: boolean;
}) {
  function remover(idx: number) {
    onArquivos(arquivos.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-card/30 p-4">
      <div className="flex items-baseline justify-between">
        <div>
          <Label className="text-sm font-medium">Imagens</Label>
          <p className="text-xs text-muted-foreground">
            Opcional · enviadas após criar o produto
          </p>
        </div>
        {arquivos.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {arquivos.length} {arquivos.length === 1 ? 'arquivo selecionado' : 'arquivos selecionados'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs">
        <span className="uppercase tracking-wide text-muted-foreground">Origem</span>
        <Select
          value={origem}
          onValueChange={(v) => onOrigemChange(v as 'INSPIRACAO' | 'MODELO_3D' | 'OUTRA')}
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="INSPIRACAO">Inspiração</SelectItem>
            <SelectItem value="MODELO_3D">Modelo 3D</SelectItem>
            <SelectItem value="OUTRA">Outra</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <UploadDropzone
        onArquivos={(novos) => onArquivos([...arquivos, ...novos])}
        disabled={desabilitado}
        label="Arraste imagens aqui ou clique pra selecionar"
      />

      {arquivos.length > 0 && (
        <PreviewArquivos arquivos={arquivos} onRemover={remover} />
      )}
    </div>
  );
}

/**
 * Preview dos arquivos selecionados com thumb da imagem (via URL.createObjectURL).
 * Revoga as object-URLs no unmount/mudança pra não vazar memória.
 */
function PreviewArquivos({
  arquivos,
  onRemover,
}: {
  arquivos: File[];
  onRemover: (idx: number) => void;
}) {
  const [urls, setUrls] = useState<string[]>([]);

  useEffect(() => {
    const novas = arquivos.map((f) => URL.createObjectURL(f));
    setUrls(novas);
    return () => novas.forEach((u) => URL.revokeObjectURL(u));
  }, [arquivos]);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {arquivos.map((f, i) => (
        <div
          key={`${f.name}-${i}`}
          className="group relative aspect-square overflow-hidden rounded-md border border-border bg-muted"
        >
          {urls[i] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={urls[i]} alt={f.name} className="h-full w-full object-cover" />
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
            <p className="truncate text-[10px] text-white">{f.name}</p>
            <p className="text-[10px] text-white/70 tabular-nums">
              {(f.size / 1024).toFixed(0)} KB
            </p>
          </div>
          <button
            type="button"
            onClick={() => onRemover(i)}
            title="Remover"
            className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-destructive-foreground group-hover:opacity-100"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function parseDimensaoCm(s: string): number | null {
  const n = parseDecimalBr(s);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <>
      <dt className={destaque ? 'text-foreground font-medium' : 'text-muted-foreground'}>{rotulo}</dt>
      <dd className={destaque ? 'text-right font-semibold' : 'text-right tabular-nums'}>{valor}</dd>
    </>
  );
}
