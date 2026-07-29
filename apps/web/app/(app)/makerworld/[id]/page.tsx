'use client';

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ExternalLink, Scale, Store } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { centavosParaReais, pct, tempoRelativo } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Marketplace = 'SHOPEE' | 'ML' | 'TIKTOK';

const ROTULO_MARKETPLACE: Record<Marketplace, string> = {
  SHOPEE: 'Shopee',
  ML: 'Mercado Livre',
  TIKTOK: 'TikTok Shop',
};

// Limite de caracteres do título em cada marketplace. Serve pra mostrar quanto do
// espaço a copy usou — título curto demais desperdiça busca, longo demais é cortado.
const LIMITE_TITULO: Record<Marketplace, number> = {
  SHOPEE: 100,
  ML: 60,
  TIKTOK: 200,
};

type Anuncio = {
  id: string;
  marketplace: Marketplace;
  titulo: string;
  descricao: string;
  tags: string[];
  categoria: string | null;
  categoriaId: string | null;
  fichaTecnica: { chave: string; valor: string }[];
  precoBaseCentavos: number;
  versao: number;
  geradoEm: string;
};

type Economia = {
  canal: Marketplace;
  precoCentavos: number;
  custoCentavos: number;
  taxaMarketplaceCentavos: number;
  impostoCentavos: number;
  liquidoCentavos: number;
  margemPct: number;
  lucroPorHoraCentavos: number;
};

type PlanoAds = {
  inviavel: boolean;
  avisoInviavel: string | null;
  roasBreakeven: number;
  roasAlvoTeste: number;
  roasAlvoEscala: number;
  cpaAlvoCentavos: number;
  vendasEsperadas: number;
  orcamentoTesteTotalCentavos: number;
  investimentoDiarioTesteCentavos: number;
  cliquesEstimadosTeste: number;
  escada: { degrau: number; diaInicio: number; diaFim: number; budgetDiarioCentavos: number }[];
  avisos: string[];
};

type Detalhe = {
  id: string;
  produtoId: string | null;
  titulo: string;
  url: string;
  autor: string;
  imagemUrl: string;
  licenca: string;
  licencaVeredicto: string;
  licencaObrigacao: string;
  nicho: string;
  pesoGramas: string;
  tempoHoras: string;
  unidadesPorKit: number;
  notaIa: number;
  veredictoIa: string;
  justificativaIa: string;
  alertas: string[];
  tags: string[];
  temFotoReal: boolean;
  anuncios: Anuncio[];
  economia: Economia;
  planoAds: PlanoAds;
};

export default function DetalheModelo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: ['makerworld', id],
    queryFn: () => apiFetch<Detalhe>(`/makerworld/${id}`),
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Carregando…</p>;
  if (error || !data) {
    return <p className="p-6 text-sm text-destructive">Não foi possível carregar o modelo.</p>;
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <Link
        href="/makerworld"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Prospecção
      </Link>

      <Cabecalho modelo={data} id={id} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.imagemUrl}
            alt={data.titulo}
            className="aspect-square w-full rounded-lg border object-cover"
          />
          <CardLicenca modelo={data} />
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          <CardEconomia modelo={data} />
          <CardPlanoAds plano={data.planoAds} />
        </div>
      </div>

      <CardAnuncios anuncios={data.anuncios} />
    </div>
  );
}

function Cabecalho({ modelo, id }: { modelo: Detalhe; id: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const anunciei = useMutation({
    mutationFn: () => apiFetch(`/makerworld/${id}/anunciei`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['makerworld'] });
      queryClient.invalidateQueries({ queryKey: ['vitrine'] });
      toast.success('Produto criado e na vitrine');
      router.push('/vitrine');
    },
  });

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold leading-tight">{modelo.titulo}</h1>
        <p className="text-sm text-muted-foreground">por {modelo.autor}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{modelo.nicho}</Badge>
        <Badge variant="outline">nota {modelo.notaIa}</Badge>
        <a
          href={modelo.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          MakerWorld <ExternalLink className="size-3.5" />
        </a>
        {modelo.produtoId ? (
          <Button variant="outline" size="sm" asChild>
            <Link href="/vitrine">
              <Store className="size-4" /> Já está na vitrine
            </Link>
          </Button>
        ) : (
          <Button size="sm" onClick={() => anunciei.mutate()} disabled={anunciei.isPending}>
            <Store className="size-4" />
            {anunciei.isPending ? 'Criando…' : 'Anunciei este produto'}
          </Button>
        )}
      </div>
    </div>
  );
}

function CardLicenca({ modelo }: { modelo: Detalhe }) {
  // CC0 é o único caso sem obrigação nenhuma. Todo o resto exige algo na descrição
  // do anúncio, e é o tipo de detalhe que só aparece depois do takedown.
  const exigeAtencao = modelo.licencaVeredicto !== 'LIVRE';

  return (
    <Card className={exigeAtencao ? 'border-amber-500/50' : undefined}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Scale className="size-4" /> Licença · {modelo.licenca}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className={exigeAtencao ? 'text-amber-600 dark:text-amber-500' : undefined}>
          {modelo.licencaObrigacao}
        </p>

        {modelo.alertas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {modelo.alertas.map((alerta) => (
              <Badge key={alerta} variant="destructive" className="text-[10px]">
                {alerta}
              </Badge>
            ))}
          </div>
        )}

        {!modelo.temFotoReal && (
          <p className="flex gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="size-4 shrink-0" />
            Sem foto real — a imagem é render do autor. Confirme o acabamento antes de
            usar como foto de anúncio.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CardEconomia({ modelo }: { modelo: Detalhe }) {
  const e = modelo.economia;
  const linhas = [
    ['Preço sugerido', centavosParaReais(e.precoCentavos)],
    ['Custo de produção', `− ${centavosParaReais(e.custoCentavos)}`],
    ['Taxa Shopee', `− ${centavosParaReais(e.taxaMarketplaceCentavos)}`],
    ['Imposto', `− ${centavosParaReais(e.impostoCentavos)}`],
  ] as const;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Economia · Shopee</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <dl className="flex flex-col gap-1">
          {linhas.map(([rotulo, valor]) => (
            <div key={rotulo} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{rotulo}</dt>
              <dd className="tabular-nums">{valor}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-4 border-t pt-2 font-medium">
            <dt>Líquido por venda</dt>
            <dd className="tabular-nums">{centavosParaReais(e.liquidoCentavos)}</dd>
          </div>
        </dl>

        <div className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
          <Metrica rotulo="Margem" valor={pct(e.margemPct)} />
          {/* Com uma impressora só, é esta a métrica que decide a fila — não a margem. */}
          <Metrica rotulo="Lucro por hora" valor={centavosParaReais(e.lucroPorHoraCentavos)} />
          <Metrica rotulo="Tempo" valor={`${modelo.tempoHoras} h`} />
          <Metrica
            rotulo="Peso"
            valor={
              modelo.unidadesPorKit > 1
                ? `${modelo.pesoGramas} g · kit de ${modelo.unidadesPorKit}`
                : `${modelo.pesoGramas} g`
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CardPlanoAds({ plano }: { plano: PlanoAds }) {
  if (plano.inviavel) {
    return (
      <Card className="border-destructive/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plano de anúncio</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-destructive">
          {plano.avisoInviavel ?? 'A margem não paga anúncio nenhum neste preço.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Plano de anúncio · Shopee Ads</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <p className="font-medium">Teste</p>
            <Metrica rotulo="ROAS alvo" valor={plano.roasAlvoTeste.toFixed(2)} />
            <Metrica
              rotulo="Investimento diário"
              valor={centavosParaReais(plano.investimentoDiarioTesteCentavos)}
            />
            <Metrica
              rotulo="Orçamento total"
              valor={centavosParaReais(plano.orcamentoTesteTotalCentavos)}
            />
            <Metrica rotulo="CPA máximo" valor={centavosParaReais(plano.cpaAlvoCentavos)} />
            <Metrica rotulo="Cliques previstos" valor={String(plano.cliquesEstimadosTeste)} />
            <p className="text-xs text-muted-foreground">
              No teste você compra informação, não lucro: empatar já aprova.
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border p-3">
            <p className="font-medium">Escala</p>
            <Metrica rotulo="ROAS alvo" valor={plano.roasAlvoEscala.toFixed(2)} />
            <Metrica
              rotulo="Budget inicial"
              valor={
                plano.escada.length > 0
                  ? centavosParaReais(plano.escada[0]!.budgetDiarioCentavos)
                  : '—'
              }
            />
            <Metrica
              rotulo="Budget final"
              valor={
                plano.escada.length > 0
                  ? centavosParaReais(plano.escada[plano.escada.length - 1]!.budgetDiarioCentavos)
                  : '—'
              }
            />
            <Metrica rotulo="Degraus" valor={String(plano.escada.length)} />
            <p className="text-xs text-muted-foreground">
              Aqui sim se exige folga — o orçamento sobe e o erro fica caro.
            </p>
          </div>
        </div>

        {plano.avisos.length > 0 && (
          <ul className="flex flex-col gap-1 border-t pt-3 text-xs text-amber-600 dark:text-amber-500">
            {plano.avisos.map((aviso) => (
              <li key={aviso} className="flex gap-2">
                <AlertTriangle className="size-3.5 shrink-0" />
                {aviso}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CardAnuncios({ anuncios }: { anuncios: Anuncio[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Anúncio</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {anuncios.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma copy gerada ainda. Ela é escrita pela skill{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">gerar-descricao</code>, fora
            do Hub, e gravada aqui depois.
          </p>
        ) : (
          anuncios.map((anuncio) => <BlocoAnuncio key={anuncio.id} anuncio={anuncio} />)
        )}
      </CardContent>
    </Card>
  );
}

function BlocoAnuncio({ anuncio }: { anuncio: Anuncio }) {
  const limite = LIMITE_TITULO[anuncio.marketplace];

  return (
    <section className="flex flex-col gap-2 border-t pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{ROTULO_MARKETPLACE[anuncio.marketplace]}</p>
        <p className="text-xs text-muted-foreground">
          v{anuncio.versao} · {tempoRelativo(anuncio.geradoEm)} · preço base{' '}
          {centavosParaReais(anuncio.precoBaseCentavos)}
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm">{anuncio.titulo}</p>
        <p className="text-xs text-muted-foreground">
          {anuncio.titulo.length}/{limite} caracteres
        </p>
      </div>

      {anuncio.categoria && (
        <p className="text-xs text-muted-foreground">
          Categoria: <span className="text-foreground">{anuncio.categoria}</span>
          {anuncio.categoriaId && (
            <span className="ml-1 font-mono text-[10px]">({anuncio.categoriaId})</span>
          )}
        </p>
      )}

      <pre className="whitespace-pre-wrap rounded-lg bg-muted p-3 text-xs leading-relaxed">
        {anuncio.descricao}
      </pre>

      {anuncio.fichaTecnica.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <tbody>
              {anuncio.fichaTecnica.map((campo) => (
                <tr key={campo.chave} className="border-b last:border-0">
                  <td className="py-1 pr-4 text-muted-foreground">{campo.chave}</td>
                  <td className="py-1">{campo.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {anuncio.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {anuncio.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </section>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex justify-between gap-2 sm:flex-col sm:justify-start">
      <p className="text-xs text-muted-foreground">{rotulo}</p>
      <p className="text-sm font-medium tabular-nums">{valor}</p>
    </div>
  );
}
