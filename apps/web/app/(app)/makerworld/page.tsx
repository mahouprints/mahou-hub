'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ExternalLink, Search, Star, Timer, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Status = 'NOVO' | 'FAVORITO' | 'DESCARTADO' | 'VIROU_PRODUTO';
type Veredicto = 'APROVADO' | 'TALVEZ' | 'REPROVADO';

type ModeloItem = {
  id: string;
  externalId: string;
  titulo: string;
  url: string;
  autor: string;
  imagemUrl: string;
  downloads: number;
  curtidas: number;
  colecoes: number;
  licenca: string;
  licencaVeredicto: string;
  licencaObrigacao: string;
  nicho: string;
  pesoGramas: string;
  tempoHoras: string;
  unidadesPorKit: number;
  custoEstimadoCentavos: number;
  precoSugeridoCentavos: number;
  margemEstimadaPct: string;
  lucroPorHoraCentavos: number;
  scoreObjetivo: number;
  notaIa: number;
  veredictoIa: Veredicto;
  justificativaIa: string;
  alertas: string[];
  temFotoReal: boolean;
  status: Status;
};

const NICHOS: Record<string, string> = {
  FLEXI_ARTICULADO: 'Flexi / articulado',
  ORGANIZACAO_SETUP: 'Organização',
  DECOR_CASA: 'Decoração',
  FIDGET_ANTISTRESS: 'Fidget',
  DATAS_FESTIVAS: 'Datas festivas',
  PERSONALIZAVEL: 'Personalizável',
  PET: 'Pet',
  ACESSORIOS_MODA: 'Acessórios',
  GADGET_ELETRONICO: 'Gadget',
  MINIATURA_TABLETOP: 'Miniatura',
  PROPS_COSPLAY: 'Cosplay',
  BRINQUEDO_INFANTIL: 'Brinquedo',
  NENHUM: 'Sem nicho',
};

// Alerta jurídico é o único que muda a decisão de forma binária — destacado em vermelho;
// o resto é ressalva de produção e fica neutro.
const ALERTAS: Record<string, { texto: string; grave: boolean }> = {
  IP_TERCEIRO: { texto: 'Possível marca/personagem licenciado', grave: true },
  PRECISA_SUPORTE: { texto: 'Precisa de suporte', grave: false },
  FRAGIL: { texto: 'Peça frágil', grave: false },
  MUITO_GENERICO: { texto: 'Muito genérico', grave: false },
  MULTICOR: { texto: 'Multicor (AMS)', grave: false },
  SO_RENDER: { texto: 'Só render, sem foto real', grave: false },
  PECA_PEQUENA_SOLTA: { texto: 'Peça pequena solta', grave: true },
  MONTAGEM: { texto: 'Precisa de peça comprada', grave: false },
};

function corDaNota(nota: number): string {
  if (nota >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (nota >= 60) return 'text-sky-600 dark:text-sky-400';
  if (nota >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-muted-foreground';
}

export default function MakerWorldPage() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [nicho, setNicho] = useState<string>('todos');
  const [status, setStatus] = useState<string>('NOVO');
  const [notaMinima, setNotaMinima] = useState<string>('60');
  const [esconderIp, setEsconderIp] = useState(true);
  const [pagina, setPagina] = useState(0);

  // 24 por página não é escolha estética: as imagens vêm do CDN do MakerWorld em
  // resolução cheia, e pedir 120 de uma vez faz o CDN dropar a maioria — a tela
  // aparecia com blocos cinza no lugar das fotos.
  const POR_PAGINA = 24;
  const params = new URLSearchParams({
    limit: String(POR_PAGINA),
    offset: String(pagina * POR_PAGINA),
    ordenarPor: 'notaIa',
  });
  if (busca) params.set('q', busca);
  if (nicho !== 'todos') params.set('nicho', nicho);
  if (status !== 'todos') params.set('status', status);
  if (notaMinima !== 'todas') params.set('notaMinima', notaMinima);
  if (esconderIp) params.append('semAlertas', 'IP_TERCEIRO');

  const { data, isLoading } = useQuery({
    queryKey: ['makerworld', params.toString()],
    placeholderData: (anterior) => anterior,
    queryFn: () =>
      apiFetch<{ itens: ModeloItem[]; total: number }>(`/makerworld?${params}`),
  });

  const mudarStatus = useMutation({
    mutationFn: ({ id, novo }: { id: string; novo: Status }) =>
      apiFetch(`/makerworld/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: novo }),
      }),
    onSuccess: (_, { novo }) => {
      queryClient.invalidateQueries({ queryKey: ['makerworld'] });
      toast.success(novo === 'FAVORITO' ? 'Favoritado' : 'Descartado');
    },
  });

  const itens = data?.itens ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Prospecção MakerWorld</h1>
        <p className="text-sm text-muted-foreground">
          Modelos com licença que permite venda, já filtrados por viabilidade de produção e
          avaliados por IA. Favorite o que quiser produzir.
        </p>
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, tag ou autor"
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPagina(0); }}
            className="pl-9"
          />
        </div>

        <Select value={nicho} onValueChange={(v) => { setNicho(v); setPagina(0); }}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Nicho" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os nichos</SelectItem>
            {Object.entries(NICHOS).map(([chave, rotulo]) => (
              <SelectItem key={chave} value={chave}>
                {rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => { setStatus(v); setPagina(0); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NOVO">Não revisados</SelectItem>
            <SelectItem value="FAVORITO">Favoritos</SelectItem>
            <SelectItem value="DESCARTADO">Descartados</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={notaMinima} onValueChange={(v) => { setNotaMinima(v); setPagina(0); }}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="80">Nota 80+</SelectItem>
            <SelectItem value="60">Nota 60+</SelectItem>
            <SelectItem value="40">Nota 40+</SelectItem>
            <SelectItem value="todas">Qualquer nota</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant={esconderIp ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setEsconderIp((v) => !v); setPagina(0); }}
        >
          <AlertTriangle className="mr-1.5 size-4" />
          Esconder risco de marca
        </Button>

        <span className="ml-auto text-sm text-muted-foreground">
          {data?.total
            ? `${pagina * POR_PAGINA + 1}–${Math.min((pagina + 1) * POR_PAGINA, data.total)} de ${data.total}`
            : '0 modelos'}
        </span>
      </Card>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      {!isLoading && itens.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nada aqui com esses filtros. Rode o bot em{' '}
          <code className="rounded bg-muted px-1">scripts/makerworld</code> para importar
          modelos novos.
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {itens.map((modelo) => (
          <Card key={modelo.id} className="flex flex-col overflow-hidden">
            <a
              href={modelo.url}
              target="_blank"
              rel="noreferrer"
              className="relative block aspect-square bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={modelo.imagemUrl}
                alt={modelo.titulo}
                loading="lazy"
                className="size-full object-cover transition-transform hover:scale-105"
              />
              <span
                className={`absolute right-2 top-2 rounded-md bg-background/90 px-2 py-1 text-sm font-semibold ${corDaNota(modelo.notaIa)}`}
              >
                {modelo.notaIa}
              </span>
            </a>

            <div className="flex flex-1 flex-col gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                {/* Título abre o detalhe no Hub; a imagem e o ícone continuam indo
                    pro MakerWorld, que é pra onde eles sempre foram. */}
                <Link
                  href={`/makerworld/${modelo.id}`}
                  className="line-clamp-2 text-sm font-medium leading-snug hover:underline"
                >
                  {modelo.titulo}
                </Link>
                <a href={modelo.url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                </a>
              </div>

              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  {NICHOS[modelo.nicho] ?? modelo.nicho}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {modelo.licenca}
                </Badge>
              </div>

              <p className="line-clamp-2 text-xs text-muted-foreground">
                {modelo.justificativaIa}
              </p>

              <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                <dt className="text-muted-foreground">Preço sug.</dt>
                <dd className="text-right font-medium">
                  {centavosParaReais(modelo.precoSugeridoCentavos)}
                </dd>
                <dt className="text-muted-foreground">Margem</dt>
                <dd className="text-right">{modelo.margemEstimadaPct}%</dd>
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <Timer className="size-3" /> R$/hora
                </dt>
                <dd className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                  {centavosParaReais(modelo.lucroPorHoraCentavos)}
                </dd>
                <dt className="text-muted-foreground">
                  {modelo.unidadesPorKit > 1 ? `Kit de ${modelo.unidadesPorKit}` : 'Impressão'}
                </dt>
                <dd className="text-right">
                  {Number(modelo.pesoGramas)}g · {Number(modelo.tempoHoras)}h
                </dd>
                <dt className="text-muted-foreground">Downloads</dt>
                <dd className="text-right">{modelo.downloads.toLocaleString('pt-BR')}</dd>
              </dl>

              {modelo.alertas.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {modelo.alertas.map((alerta) => {
                    const info = ALERTAS[alerta];
                    return (
                      <span
                        key={alerta}
                        title={info?.texto ?? alerta}
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          info?.grave
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {info?.texto ?? alerta}
                      </span>
                    );
                  })}
                </div>
              )}

              {modelo.licencaVeredicto !== 'LIVRE' && (
                <p className="rounded bg-muted/50 p-1.5 text-[10px] leading-snug text-muted-foreground">
                  {modelo.licencaObrigacao}
                </p>
              )}

              <div className="mt-auto flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant={modelo.status === 'FAVORITO' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => mudarStatus.mutate({ id: modelo.id, novo: 'FAVORITO' })}
                >
                  <Star className="mr-1 size-3.5" />
                  Quero
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => mudarStatus.mutate({ id: modelo.id, novo: 'DESCARTADO' })}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {(data?.total ?? 0) > POR_PAGINA && (
        <div className="flex items-center justify-center gap-3 pb-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pagina === 0}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {pagina + 1} de {Math.ceil((data?.total ?? 0) / POR_PAGINA)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={(pagina + 1) * POR_PAGINA >= (data?.total ?? 0)}
            onClick={() => setPagina((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </div>
  );
}
