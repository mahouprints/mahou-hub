'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { CalcularOutput, Filamento, Insumo, Parametro } from '@mahou-hub/contracts';
import { apiFetch, apiUrl, fetchComRetry } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { parseDecimalBr, parseDecimalParaCentavos } from '@/lib/parsing';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputDecimal } from '@/components/ui/input-decimal';
import { ProdutoPreview } from '@/components/produto-preview';
import { ProdutoInsumosSecao } from '@/components/produto-insumos-secao';
import { ProdutoImagensInicial } from '@/components/produto-imagens-inicial';
import {
  PRODUTO_FORM_VAZIO,
  converterProdutoForm,
  insumosDoFormulario,
  type FormState,
  type ProdutoComInsumos,
} from '@/lib/produto-form';
import { ImagensSection } from '@/components/imagens-section';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  produto?: ProdutoComInsumos | null;
  inicial?: Partial<FormState>;
}

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
        metodoImagem: produto.metodoImagem ?? '',
        insumos: (produto.insumos ?? []).map((pi) => ({
          insumoId: pi.insumoId,
          qtdStr: String(pi.qtd).replace('.', ','),
        })),
      };
    }
    return { ...PRODUTO_FORM_VAZIO, ...inicial };
  });

  const [preview, setPreview] = useState<CalcularOutput | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
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

  const { data: insumosAtivos } = useQuery({
    queryKey: ['insumos'],
    queryFn: () => apiFetch<Insumo[]>('/insumos'),
  });

  const insumosDisponiveis = insumosDoFormulario(insumosAtivos ?? [], produto);

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
    if (
      !form.filamentoId ||
      !Number.isFinite(peso) ||
      peso <= 0 ||
      !Number.isFinite(tempo) ||
      tempo <= 0 ||
      !Number.isFinite(preco) ||
      preco <= 0
    ) {
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
    if (salvando) return;
    setErroFormulario(null);
    setSalvando(true);
    try {
      const payload = converterProdutoForm(form, produto);
      let produtoId = produto?.id;
      if (produto) {
        await apiFetch(`/produtos/${produto.id}`, { method: 'PATCH', json: payload });
        toast.success('Produto atualizado');
      } else {
        const criado = await apiFetch<{ id: string }>('/produtos', {
          method: 'POST',
          json: payload,
        });
        produtoId = criado.id;
        // Upload das imagens pendentes depois que o produto existe (precisa do ID).
        // Falhas no upload viram aviso, mas o produto fica criado normalmente —
        // user pode subir manualmente na tela de detalhe depois.
        if (imagensPendentes.length > 0) {
          try {
            const fd = new FormData();
            imagensPendentes.forEach((f) => fd.append('arquivos', f));
            const res = await fetchComRetry(
              apiUrl(`/produtos/${criado.id}/imagens?origem=${origemImagens}`),
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
      await qc.invalidateQueries({ queryKey: ['produto', produtoId] });
      await qc.invalidateQueries({ queryKey: ['produto-pricing', produtoId] });
      router.push(`/produtos/${produtoId}`);
    } catch (e) {
      setErroFormulario(e instanceof Error ? e.message : 'Erro ao salvar produto');
    } finally {
      setSalvando(false);
    }
  }

  const thresholdVerde = Number(parametros?.margemThresholdVerde ?? 0.3);
  const thresholdAmarelo = Number(parametros?.margemThresholdAmarelo ?? 0.15);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Coluna esquerda: form principal */}
      <Card>
        <CardHeader>
          <CardTitle>{editando ? 'Editar produto' : 'Novo produto'}</CardTitle>
          <CardDescription>
            Custos e quantidades referentes a uma unidade do produto
          </CardDescription>
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
                <Label htmlFor="inspiracao">Inspiração (URL opcional)</Label>
                <Input
                  id="inspiracao"
                  value={form.inspiracao}
                  onChange={(e) => setForm({ ...form, inspiracao: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="modelo3d">Modelo 3D (URL opcional)</Label>
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
                  aria-label="Largura (cm)"
                  value={form.larguraCm}
                  onChange={(s) => setForm({ ...form, larguraCm: s })}
                  decimals={1}
                  placeholder="largura"
                />
                <InputDecimal
                  aria-label="Profundidade (cm)"
                  value={form.profundidadeCm}
                  onChange={(s) => setForm({ ...form, profundidadeCm: s })}
                  decimals={1}
                  placeholder="profundidade"
                />
                <InputDecimal
                  aria-label="Altura (cm)"
                  value={form.alturaCm}
                  onChange={(s) => setForm({ ...form, alturaCm: s })}
                  decimals={1}
                  placeholder="altura"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="filamento">Filamento</Label>
              <Select
                value={form.filamentoId}
                onValueChange={(v) => setForm({ ...form, filamentoId: v })}
              >
                <SelectTrigger id="filamento">
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

            <ProdutoInsumosSecao
              linhas={form.insumos}
              onChange={(insumos) => setForm({ ...form, insumos })}
              insumosDisponiveis={insumosDisponiveis ?? []}
              subtotalCentavos={custoInsumosCentavos}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="peso">Peso (g)</Label>
                <InputDecimal
                  id="peso"
                  value={form.pesoG}
                  onChange={(s) => setForm({ ...form, pesoG: s })}
                  decimals={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tempo">Tempo (h)</Label>
                <InputDecimal
                  id="tempo"
                  value={form.tempoH}
                  onChange={(s) => setForm({ ...form, tempoH: s })}
                  decimals={2}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="impressora">Impressora</Label>
                <Select
                  value={form.impressora}
                  onValueChange={(v) => setForm({ ...form, impressora: v as 'A1' | 'H2C' })}
                >
                  <SelectTrigger id="impressora">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A1">A1</SelectItem>
                    <SelectItem value="H2C">H2C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="canal">Canal principal</Label>
                <Select
                  value={form.canalPrincipal}
                  onValueChange={(v) =>
                    setForm({ ...form, canalPrincipal: v as FormState['canalPrincipal'] })
                  }
                >
                  <SelectTrigger id="canal">
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

            <div className="space-y-1.5">
              <Label htmlFor="metodo-imagem">Método da imagem final</Label>
              <Select
                value={form.metodoImagem === '' ? 'NULL' : form.metodoImagem}
                onValueChange={(v) =>
                  setForm({ ...form, metodoImagem: v === 'NULL' ? '' : (v as 'IA' | 'FOTO') })
                }
              >
                <SelectTrigger id="metodo-imagem">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NULL">— não decidido —</SelectItem>
                  <SelectItem value="IA">Gerar com IA</SelectItem>
                  <SelectItem value="FOTO">Fotografar (imprimir e tirar foto)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Escolha como será feita a imagem final do produto.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="embalagem">Embalagem (R$)</Label>
                <InputDecimal
                  id="embalagem"
                  value={form.embalagemReais}
                  onChange={(s) => setForm({ ...form, embalagemReais: s })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="preco">Preço (R$)</Label>
                <InputDecimal
                  id="preco"
                  value={form.precoReais}
                  onChange={(s) => setForm({ ...form, precoReais: s })}
                />
              </div>
            </div>

            {erroFormulario && (
              <p role="alert" className="text-sm text-destructive">
                {erroFormulario}
              </p>
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

      {/* Coluna direita: preview de preço em cima, imagens (só em criar) embaixo */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Preview de preço</CardTitle>
            <CardDescription>Recalculado ao vivo enquanto você digita</CardDescription>
          </CardHeader>
          <CardContent>
            {preview ? (
              <ProdutoPreview
                preview={preview}
                thresholdVerde={thresholdVerde}
                thresholdAmarelo={thresholdAmarelo}
                canal={form.canalPrincipal}
                embalagemCentavos={(() => {
                  const v = parseDecimalParaCentavos(form.embalagemReais);
                  return Number.isFinite(v) ? v : 0;
                })()}
                custoInsumosCentavos={custoInsumosCentavos}
                precoCentavos={parseDecimalParaCentavos(form.precoReais) || 0}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Preencha filamento, peso, tempo e preço para ver o cálculo.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Imagens:
            - criando: buffer File[] enviado depois que o POST devolve o ID
            - editando: produto já existe, reusa ImagensSection (upload imediato + delete) */}
        <Card>
          <CardHeader>
            <CardTitle>Imagens</CardTitle>
            <CardDescription>
              {editando
                ? 'Adicione, troque ou remova — alterações são salvas na hora'
                : 'Opcional · enviadas após criar o produto'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {editando && produto ? (
              <ImagensSection produtoId={produto.id} imagens={produto.imagens ?? []} />
            ) : (
              <ProdutoImagensInicial
                arquivos={imagensPendentes}
                onArquivos={setImagensPendentes}
                origem={origemImagens}
                onOrigemChange={setOrigemImagens}
                desabilitado={salvando}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
