'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ExternalLink, Save, Search, Sparkles, Star } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Marketplace = 'SHOPEE' | 'TIKTOK' | 'ML' | 'OUTRO';
type TipoBusca = 'keyword' | 'categoria' | 'concorrente' | 'explorar';
type Fonte = 'CONCORRENTE' | 'KEYWORD' | 'CATEGORIA' | 'TOP_VENDAS';

type Candidato = {
  marketplace: Marketplace;
  externalId: string;
  productName: string;
  priceMinCentavos: number;
  priceMaxCentavos: number;
  imageUrl: string;
  productLink: string;
  vendasEstimadasMes: number;
  ratingStar: number | null;
  categoriaIds: number[];
  lojaExternalId: string | null;
  lojaNome: string | null;
  snapshotProdutoId?: string;
  concorrenteId?: string;
};

const TIPO_TO_FONTE: Record<TipoBusca, Fonte> = {
  keyword: 'KEYWORD',
  categoria: 'CATEGORIA',
  concorrente: 'CONCORRENTE',
  explorar: 'TOP_VENDAS',
};

export default function BuscarOportunidadesPage() {
  const [marketplace, setMarketplace] = useState<Marketplace>('SHOPEE');
  const [tipo, setTipo] = useState<TipoBusca>('keyword');
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [vendasMin, setVendasMin] = useState('100');
  const [precoMinReais, setPrecoMinReais] = useState('20');
  const [precoMaxReais, setPrecoMaxReais] = useState('200');
  const [ratingMin, setRatingMin] = useState('4');

  const [resultados, setResultados] = useState<Candidato[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  const buscar = useMutation({
    mutationFn: async () => {
      const filtros = {
        vendasMin: Number(vendasMin) || undefined,
        precoMinCentavos: Math.round(Number(precoMinReais) * 100) || undefined,
        precoMaxCentavos: Math.round(Number(precoMaxReais) * 100) || undefined,
        ratingMin: Number(ratingMin) || undefined,
        limit: 100,
      };
      if (tipo === 'explorar') {
        return apiFetch<Candidato[]>('/oportunidades/explorar', {
          method: 'POST',
          json: { marketplace, filtros },
        });
      }
      const params: Record<string, string> = {};
      if (tipo === 'keyword') params.keyword = keyword.trim();
      if (tipo === 'categoria') params.categoryId = categoryId.trim();
      return apiFetch<Candidato[]>('/oportunidades/buscar', {
        method: 'POST',
        json: { marketplace, tipo, params, filtros },
      });
    },
    onSuccess: (items) => {
      setResultados(items);
      setSelecionados(new Set());
      toast.success(`${items.length} candidato(s) encontrado(s)`);
    },
  });

  const salvar = useMutation({
    mutationFn: async () => {
      const escolhidos = resultados.filter((r) => selecionados.has(r.externalId));
      const fonte = TIPO_TO_FONTE[tipo];
      const fonteParam = tipo === 'keyword' ? keyword.trim() : tipo === 'categoria' ? categoryId.trim() : null;
      return apiFetch<{ count: number; ids: string[] }>('/oportunidades/bulk', {
        method: 'POST',
        json: {
          itens: escolhidos.map((c) => ({
            marketplace: c.marketplace,
            externalId: c.externalId,
            productName: c.productName,
            priceMinCentavos: c.priceMinCentavos,
            priceMaxCentavos: c.priceMaxCentavos,
            imageUrl: c.imageUrl,
            productLink: c.productLink,
            vendasEstimadasMes: c.vendasEstimadasMes,
            ratingStar: c.ratingStar,
            categoriaIds: c.categoriaIds,
            lojaExternalId: c.lojaExternalId,
            lojaNome: c.lojaNome,
            snapshotProdutoId: c.snapshotProdutoId ?? null,
            concorrenteId: c.concorrenteId ?? null,
            fonte,
            fonteParam,
            status: 'EM_ANALISE',
          })),
        },
      });
    },
    onSuccess: (res) => {
      toast.success(`${res.count} oportunidade(s) salva(s) em EM_ANALISE`);
      setSelecionados(new Set());
    },
  });

  function toggle(externalId: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId);
      else next.add(externalId);
      return next;
    });
  }

  function toggleTodos() {
    if (selecionados.size === resultados.length) setSelecionados(new Set());
    else setSelecionados(new Set(resultados.map((r) => r.externalId)));
  }

  const podeBuscar =
    (tipo === 'keyword' && keyword.trim().length > 0) ||
    (tipo === 'categoria' && categoryId.trim().length > 0) ||
    tipo === 'concorrente' ||
    tipo === 'explorar';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/oportunidades">
            <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
          </Link>
        </Button>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Buscar oportunidades</h1>
        <p className="text-sm text-muted-foreground">
          Descubra candidatos a virar produto. Resultados não persistem até você escolher salvar.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Critérios</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (podeBuscar) buscar.mutate();
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Marketplace</Label>
                <Select value={marketplace} onValueChange={(v) => setMarketplace(v as Marketplace)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SHOPEE">Shopee</SelectItem>
                    <SelectItem value="TIKTOK" disabled>
                      TikTok (em breve)
                    </SelectItem>
                    <SelectItem value="ML" disabled>
                      Mercado Livre (em breve)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de busca</Label>
                <Select value={tipo} onValueChange={(v) => setTipo(v as TipoBusca)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keyword">Por palavra-chave</SelectItem>
                    <SelectItem value="categoria">Por categoria Shopee (id)</SelectItem>
                    <SelectItem value="concorrente">Concorrentes monitorados</SelectItem>
                    <SelectItem value="explorar">Brainstorm (top vendas global)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {tipo === 'keyword' && (
              <div className="space-y-1.5">
                <Label>Palavra-chave</Label>
                <Input
                  placeholder="ex: porta controle ps5"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
            )}
            {tipo === 'categoria' && (
              <div className="space-y-1.5">
                <Label>ID da categoria Shopee</Label>
                <Input
                  placeholder="ex: 100629"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Vendas mín./mês</Label>
                <Input
                  type="number"
                  min={0}
                  value={vendasMin}
                  onChange={(e) => setVendasMin(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preço mín. (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={precoMinReais}
                  onChange={(e) => setPrecoMinReais(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preço máx. (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={precoMaxReais}
                  onChange={(e) => setPrecoMaxReais(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rating mín.</Label>
                <Input
                  type="number"
                  min={0}
                  max={5}
                  step={0.1}
                  value={ratingMin}
                  onChange={(e) => setRatingMin(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={!podeBuscar || buscar.isPending}>
                {tipo === 'explorar' ? (
                  <Sparkles className="mr-2 h-4 w-4" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {buscar.isPending ? 'Buscando…' : 'Buscar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {resultados.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle className="text-base">{resultados.length} resultado(s)</CardTitle>
              <p className="text-xs text-muted-foreground">
                {selecionados.size} selecionado(s) · serão salvos com status EM_ANALISE
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={toggleTodos}>
                {selecionados.size === resultados.length ? 'Limpar' : 'Selecionar todos'}
              </Button>
              <Button
                onClick={() => salvar.mutate()}
                disabled={selecionados.size === 0 || salvar.isPending}
              >
                <Save className="mr-2 h-4 w-4" />
                Salvar {selecionados.size} no backlog
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {resultados.map((c) => {
                const marcado = selecionados.has(c.externalId);
                return (
                  <Card
                    key={c.externalId}
                    className={`relative cursor-pointer transition-colors ${marcado ? 'border-primary ring-2 ring-primary/30' : ''}`}
                    onClick={() => toggle(c.externalId)}
                  >
                    <div className="absolute right-2 top-2 z-10">
                      <Checkbox checked={marcado} />
                    </div>
                    <div className="flex gap-3 p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.imageUrl}
                        alt=""
                        className="h-20 w-20 shrink-0 rounded border object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-medium">{c.productName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">
                            {c.priceMinCentavos === c.priceMaxCentavos
                              ? centavosParaReais(c.priceMinCentavos)
                              : `${centavosParaReais(c.priceMinCentavos)} – ${centavosParaReais(c.priceMaxCentavos)}`}
                          </span>
                          <span>·</span>
                          <span className="tabular-nums">
                            {c.vendasEstimadasMes.toLocaleString('pt-BR')} v/mês
                          </span>
                          {c.ratingStar != null && (
                            <>
                              <span>·</span>
                              <span className="inline-flex items-center gap-0.5">
                                <Star className="h-3 w-3 fill-amber-400 stroke-amber-500" />
                                {c.ratingStar.toFixed(1)}
                              </span>
                            </>
                          )}
                        </div>
                        {c.lojaNome && (
                          <p className="mt-1 truncate text-xs text-muted-foreground">{c.lojaNome}</p>
                        )}
                        <a
                          href={c.productLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
